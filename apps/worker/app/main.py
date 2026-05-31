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

HMAC_SECRET = os.environ.get("EXIFSCRUB_HMAC_SECRET", "dev-secret-change-me").encode()
RETENTION_SECONDS = int(os.environ.get("RETENTION_SECONDS", "300"))
MAX_FILE_BYTES = int(os.environ.get("MAX_FILE_BYTES", str(100 * 1024 * 1024)))
SKIP_METADATA_NAMESPACES = frozenset({"System", "ExifTool", "File"})
SKIP_METADATA_FIELDS = frozenset({"SourceFile", "ExifToolVersion"})
VALID_SCRUB_PRESETS = frozenset({"all", "gps_author", "orientation_only"})


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
        raise HTTPException(500, "ExifTool processing failed")


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


def scrub_file(path: Path, preset: str) -> tuple[Path, list[dict], list[dict]]:
    before = read_metadata(path, path.name, "application/octet-stream")
    stripped_entries: list[dict] = []
    for block in before["blocks"]:
        for field, value in block["fields"].items():
            stripped_entries.append(
                {"namespace": block["namespace"], "field": field, "value": value}
            )

    out_path = path.with_name(f"{path.stem}_clean{path.suffix}")
    shutil.copy2(path, out_path)

    if preset == "all":
        run_exiftool(["-all=", "-overwrite_original", str(out_path)])
    elif preset == "gps_author":
        run_exiftool(
            [
                "-GPS:all=",
                "-XMP:Creator=",
                "-XMP:Author=",
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
    else:
        run_exiftool(["-all=", "-overwrite_original", str(out_path)])

    after = read_metadata(out_path, path.name, "application/octet-stream")
    retained: list[dict] = []
    for block in after["blocks"]:
        for field, value in block["fields"].items():
            retained.append({"namespace": block["namespace"], "field": field, "value": value})

    if preset == "all":
        stripped = stripped_entries
    else:
        retained_keys = {(r["namespace"], r["field"]) for r in retained}
        stripped = [
            s
            for s in stripped_entries
            if (s["namespace"], s["field"]) not in retained_keys
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
) -> JSONResponse:
    if preset not in VALID_SCRUB_PRESETS:
        raise HTTPException(400, f"Invalid preset: {preset}")

    job_dir = tempfile.mkdtemp(prefix="exifscrub-")
    try:
        upload_name = safe_upload_name(file.filename)
        dest = Path(job_dir) / upload_name
        content = await file.read()
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(413, "File too large")
        dest.write_bytes(content)

        cleaned_path, stripped, retained = scrub_file(dest, preset)
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
async def v1_batch(file: UploadFile = File(...)) -> JSONResponse:
    raise HTTPException(501, "Batch endpoint available in Pro tier; use single-file scrub for now.")
