import base64
import hashlib
import hmac
import json
import os
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="ExifScrub Worker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_PRESETS = {"all", "gps_author", "orientation_only", "custom"}
NON_METADATA_NAMESPACES = {"ExifTool", "System", "File", "Composite"}


def field_keys(blocks: list[dict]) -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    for block in blocks:
        ns = block["namespace"]
        if ns in NON_METADATA_NAMESPACES:
            continue
        for field in block["fields"]:
            keys.add((ns, field))
    return keys

HMAC_SECRET = os.environ.get("EXIFSCRUB_HMAC_SECRET", "dev-secret-change-me").encode()
RETENTION_SECONDS = int(os.environ.get("RETENTION_SECONDS", "300"))
MAX_FILE_BYTES = int(os.environ.get("MAX_FILE_BYTES", str(100 * 1024 * 1024)))
SKIP_METADATA_NAMESPACES = frozenset({"System", "ExifTool", "File"})
SKIP_METADATA_FIELDS = frozenset({"SourceFile", "ExifToolVersion"})
VALID_SCRUB_PRESETS = frozenset({"all", "gps_author", "orientation_only", "custom"})


def safe_upload_name(name: str | None) -> str:
    base = Path(name or "upload.bin").name
    if not base or base in (".", ".."):
        return "upload.bin"
    return base


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def run_exiftool(args: list[str], timeout: int = 120) -> None:
    result = subprocess.run(
        ["exiftool", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "ExifTool processing failed").strip()
        raise HTTPException(500, detail[:500])


def run_ffmpeg(args: list[str], timeout: int = 120) -> None:
    result = subprocess.run(
        ["ffmpeg", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "FFmpeg processing failed").strip()
        raise HTTPException(500, detail[:500])


def is_mp3(path: Path) -> bool:
    return path.suffix.lower() == ".mp3"


def parse_custom_fields(preset: str, custom: str | None) -> list[dict] | None:
    if preset != "custom":
        return None
    if not custom:
        raise HTTPException(400, "custom preset requires JSON field list in 'custom' form field")
    try:
        fields = json.loads(custom)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"invalid custom JSON: {exc}") from exc
    if not isinstance(fields, list) or not fields:
        raise HTTPException(400, "custom preset requires a non-empty JSON array")
    return fields


def scrub_mp3(path: Path, out_path: Path, preset: str, custom_fields: list[dict] | None) -> None:
    tmp = out_path.with_name(f"{out_path.stem}_ffmpeg{out_path.suffix}")
    try:
        if preset == "all" or preset == "gps_author":
            run_ffmpeg(
                ["-y", "-i", str(path), "-map_metadata", "-1", "-codec", "copy", str(tmp)],
            )
        elif preset == "orientation_only":
            shutil.copy2(path, tmp)
        elif preset == "custom" and custom_fields:
            args = ["-y", "-i", str(path), "-codec", "copy"]
            for item in custom_fields:
                field = item.get("field", "").lower()
                if "artist" in field or "author" in field:
                    args.extend(["-metadata", "artist="])
                if "title" in field:
                    args.extend(["-metadata", "title="])
                if "album" in field:
                    args.extend(["-metadata", "album="])
            if len(args) == 6:
                run_ffmpeg(["-y", "-i", str(path), "-map_metadata", "-1", "-codec", "copy", str(tmp)])
            else:
                args.append(str(tmp))
                run_ffmpeg(args)
        else:
            shutil.copy2(path, tmp)
        tmp.replace(out_path)
    finally:
        tmp.unlink(missing_ok=True)


def read_metadata(path: Path, name: str, mime: str) -> dict[str, Any]:
    result = subprocess.run(
        ["exiftool", "-json", "-a", "-G1", str(path)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    blocks: list[dict[str, Any]] = []
    if result.returncode == 0 and result.stdout.strip():
        data = json.loads(result.stdout)
        if data and isinstance(data, list):
            fields = data[0]
            by_ns: dict[str, dict[str, Any]] = {}
            for key, value in fields.items():
                ns = key.split(":", 1)[0] if ":" in key else "EXIF"
                field = key.split(":", 1)[-1]
                if ns in SKIP_METADATA_NAMESPACES or field in SKIP_METADATA_FIELDS:
                    continue
                by_ns.setdefault(ns, {})[field] = value
            blocks = [{"namespace": k, "fields": v} for k, v in by_ns.items()]

    return {
        "file": {
            "name": name,
            "sha256": sha256_file(path),
            "mime": mime,
            "size": path.stat().st_size,
        },
        "blocks": blocks,
        "thumbnails": [],
    }


def scrub_file(path: Path, preset: str, custom_fields: list[dict] | None = None) -> tuple[Path, list[dict], list[dict]]:
    before = read_metadata(path, path.name, "application/octet-stream")
    stripped_entries: list[dict] = []
    for block in before["blocks"]:
        for field, value in block["fields"].items():
            stripped_entries.append(
                {"namespace": block["namespace"], "field": field, "value": value}
            )

    out_path = path.with_name(f"{path.stem}_clean{path.suffix}")
    shutil.copy2(path, out_path)

    if is_mp3(path):
        scrub_mp3(path, out_path, preset, custom_fields)
    elif preset == "all":
        run_exiftool(["-all=", "-overwrite_original", str(out_path)])
    elif preset == "gps_author":
        run_exiftool(
            [
                "-GPS:all=",
                "-XMP:Creator=",
                "-XMP:Author=",
                "-Creator=",
                "-PDF:Creator=",
                "-Artist=",
                "-Author=",
                "-OwnerName=",
                "-Copyright=",
                "-overwrite_original",
                str(out_path),
            ]
        )
    elif preset == "orientation_only":
        run_exiftool(["-all=", "-tagsfromfile", "@", "-orientation", "-overwrite_original", str(out_path)])
    elif preset == "custom" and custom_fields:
        args = ["-overwrite_original"]
        for item in custom_fields:
            field = item.get("field", "")
            if field:
                args.append(f"-{field}=")
        args.append(str(out_path))
        run_exiftool(args)
    elif preset == "custom":
        raise HTTPException(400, "custom preset requires JSON field list in 'custom' form field")
    else:
        raise HTTPException(400, f"Unknown preset: {preset}")

    after = read_metadata(out_path, path.name, "application/octet-stream")
    retained_list: list[dict] = []
    for block in after["blocks"]:
        for field, value in block["fields"].items():
            retained_list.append({"namespace": block["namespace"], "field": field, "value": value})

    before_keys = field_keys(before["blocks"])
    after_keys = field_keys(after["blocks"])

    stripped = [
        entry for entry in stripped_entries
        if (entry["namespace"], entry["field"]) in before_keys - after_keys
    ]

    retained = [
        entry for entry in retained_list
        if (entry["namespace"], entry["field"]) in after_keys
    ]

    return out_path, stripped, retained


def sign_payload(payload: dict[str, Any]) -> str:
    canonical = json.dumps(
        {
            "version": payload["version"],
            "filename": payload["filename"],
            "cleanedSha256": payload["cleanedSha256"],
            "stripped": payload["stripped"],
            "retained": payload["retained"],
            "timestamp": payload["timestamp"],
            "signatureAlgorithm": payload["signatureAlgorithm"],
        },
        sort_keys=True,
    )
    return hmac.new(HMAC_SECRET, canonical.encode(), hashlib.sha256).hexdigest()


@app.post("/v1/read")
async def v1_read(file: UploadFile = File(...)) -> JSONResponse:
    job_dir = tempfile.mkdtemp(prefix="exifscrub-")
    try:
        upload_name = safe_upload_name(file.filename)
        dest = Path(job_dir) / upload_name
        content = await file.read()
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(413, "File too large")
        dest.write_bytes(content)
        report = read_metadata(dest, upload_name, file.content_type or "application/octet-stream")
        return JSONResponse(report)
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


@app.post("/v1/scrub")
async def v1_scrub(
    file: UploadFile = File(...),
    preset: str = Form("all"),
    custom: str = Form(None),
) -> JSONResponse:
    if preset not in VALID_SCRUB_PRESETS:
        raise HTTPException(400, f"Invalid preset: {preset}")

    custom_fields = parse_custom_fields(preset, custom)

    job_dir = tempfile.mkdtemp(prefix="exifscrub-")
    try:
        upload_name = safe_upload_name(file.filename)
        dest = Path(job_dir) / upload_name
        content = await file.read()
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(413, "File too large")
        dest.write_bytes(content)

        cleaned_path, stripped, retained = scrub_file(dest, preset, custom_fields)
        cleaned_bytes = cleaned_path.read_bytes()
        cleaned_sha = hashlib.sha256(cleaned_bytes).hexdigest()

        prove = {
            "version": "1",
            "filename": upload_name,
            "cleanedSha256": cleaned_sha,
            "stripped": stripped,
            "retained": retained,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "signatureAlgorithm": "HMAC-SHA256",
            "signature": "",
        }
        prove["signature"] = sign_payload(prove)

        return JSONResponse(
            {
                "cleanedBase64": base64.b64encode(cleaned_bytes).decode(),
                "mime": file.content_type or "application/octet-stream",
                "cleaned": {
                    "sha256": cleaned_sha,
                    "mime": file.content_type or "application/octet-stream",
                    "size": len(cleaned_bytes),
                },
                "stripped": stripped,
                "retained": retained,
                "proveCleanJson": prove,
            }
        )
    finally:
        time.sleep(0)
        shutil.rmtree(job_dir, ignore_errors=True)


@app.post("/v1/batch")
async def v1_batch(
    file: UploadFile = File(...),
    preset: str = Form("all"),
    custom: str = Form(None),
) -> JSONResponse:
    import io
    import zipfile

    if preset not in VALID_SCRUB_PRESETS:
        raise HTTPException(400, f"Invalid preset: {preset}")

    custom_fields = parse_custom_fields(preset, custom)

    content = await file.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "File too large")

    job_dir = tempfile.mkdtemp(prefix="exifscrub-batch-")
    try:
        input_zip = Path(job_dir) / "input.zip"
        input_zip.write_bytes(content)
        extract_dir = Path(job_dir) / "extracted"
        extract_dir.mkdir()

        try:
            with zipfile.ZipFile(input_zip) as zf:
                for member in zf.namelist():
                    target = (extract_dir / member).resolve()
                    if not str(target).startswith(str(extract_dir.resolve())):
                        raise HTTPException(400, "Invalid zip entry path")
                zf.extractall(extract_dir)
        except zipfile.BadZipFile:
            raise HTTPException(400, "Invalid zip file")

        manifest: list[dict[str, Any]] = []
        output_buf = io.BytesIO()

        with zipfile.ZipFile(output_buf, "w", zipfile.ZIP_DEFLATED) as out_zip:
            for fpath in sorted(extract_dir.rglob("*")):
                if not fpath.is_file():
                    continue
                cleaned_path, stripped, retained = scrub_file(fpath, preset, custom_fields)
                cleaned_bytes = cleaned_path.read_bytes()
                cleaned_sha = hashlib.sha256(cleaned_bytes).hexdigest()
                rel = fpath.relative_to(extract_dir)
                out_zip.writestr(f"clean_{rel}", cleaned_bytes)

                prove = {
                    "version": "1",
                    "filename": str(rel),
                    "cleanedSha256": cleaned_sha,
                    "stripped": stripped,
                    "retained": retained,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "signatureAlgorithm": "HMAC-SHA256",
                    "signature": "",
                }
                prove["signature"] = sign_payload(prove)
                prove_path = Path("prove-clean") / f"{rel}.prove-clean.json"
                out_zip.writestr(str(prove_path), json.dumps(prove, indent=2))

                manifest.append({
                    "filename": str(rel),
                    "sha256": cleaned_sha,
                    "preset": preset,
                    "stripped_count": len(stripped),
                    "retained_count": len(retained),
                    "proveCleanPath": str(prove_path),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            manifest.sort(key=lambda x: x["filename"])
            out_zip.writestr("manifest.json", json.dumps(manifest, indent=2))

        return JSONResponse(
            {
                "manifest": manifest,
                "zipBase64": base64.b64encode(output_buf.getvalue()).decode(),
            }
        )
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


@app.post("/v1/fetch")
async def v1_fetch(url: str = Form(...)) -> JSONResponse:
    import httpx

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        try:
            response = await client.get(url)
        except Exception as exc:
            raise HTTPException(400, f"Failed to fetch URL: {exc}") from exc
    if response.status_code != 200:
        raise HTTPException(400, f"URL returned {response.status_code}")

    filename = url.split("/")[-1].split("?")[0] or "download"
    content_type = response.headers.get("content-type", "application/octet-stream")
    return JSONResponse(
        {
            "filename": filename,
            "mime": content_type,
            "base64": base64.b64encode(response.content).decode(),
            "size": len(response.content),
        }
    )
