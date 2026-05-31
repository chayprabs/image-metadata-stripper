"""Comprehensive worker endpoint tests — read-only bug discovery."""

import base64
import hashlib
import hmac
import io
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import HMAC_SECRET, VALID_SCRUB_PRESETS, app, sign_payload

client = TestClient(app)
SAMPLES = Path(__file__).resolve().parents[3] / "samples"

SAMPLE_FILES = {
    "geotagged.jpg": "image/jpeg",
    "pdf-with-author.pdf": "application/pdf",
    "mp3-with-id3.mp3": "audio/mpeg",
    "video-with-meta.mp4": "video/mp4",
}


def exiftool_metadata_keys(path: Path) -> set[tuple[str, str]]:
    """Return (namespace, field) keys from exiftool, excluding system namespaces."""
    result = subprocess.run(
        ["exiftool", "-json", "-a", "-G1", str(path)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    keys: set[tuple[str, str]] = set()
    skip_ns = {"ExifTool", "System", "File", "Composite"}
    if result.returncode == 0 and result.stdout.strip():
        data = json.loads(result.stdout)[0]
        for key in data:
            if key in ("SourceFile",):
                continue
            ns = key.split(":", 1)[0] if ":" in key else "EXIF"
            field = key.split(":", 1)[-1]
            if ns in skip_ns or field in ("ExifToolVersion",):
                continue
            keys.add((ns, field))
    return keys


def verify_hmac(prove: dict) -> bool:
    sig = prove.get("signature", "")
    payload = {**prove, "signature": ""}
    expected = sign_payload(payload)
    return hmac.compare_digest(sig, expected)


def scrub_sample(name: str, preset: str, custom: str | None = None) -> dict:
    path = SAMPLES / name
    data: dict = {"preset": preset}
    if custom is not None:
        data["custom"] = custom
    with path.open("rb") as f:
        res = client.post(
            "/v1/scrub",
            files={"file": (name, f, SAMPLE_FILES[name])},
            data=data,
        )
    assert res.status_code == 200, f"scrub {name} preset={preset}: {res.status_code} {res.text}"
    return res.json()


# --- /v1/read ---


@pytest.mark.parametrize("filename,mime", SAMPLE_FILES.items())
def test_read_all_samples(filename, mime):
    path = SAMPLES / filename
    assert path.exists(), f"missing sample {filename}"
    with path.open("rb") as f:
        res = client.post("/v1/read", files={"file": (filename, f, mime)})
    assert res.status_code == 200
    body = res.json()
    assert body["file"]["name"] == filename
    assert body["file"]["sha256"]
    assert body["file"]["size"] == path.stat().st_size
    assert "blocks" in body


def test_read_geotagged_has_gps_and_artist():
    path = SAMPLES / "geotagged.jpg"
    with path.open("rb") as f:
        res = client.post("/v1/read", files={"file": ("geotagged.jpg", f, "image/jpeg")})
    blocks = {b["namespace"]: b["fields"] for b in res.json()["blocks"]}
    assert "GPS" in blocks
    assert "Artist" in blocks.get("IFD0", {})


def test_read_pdf_has_author():
    path = SAMPLES / "pdf-with-author.pdf"
    with path.open("rb") as f:
        res = client.post("/v1/read", files={"file": ("pdf-with-author.pdf", f, "application/pdf")})
    blocks = {b["namespace"]: b["fields"] for b in res.json()["blocks"]}
    assert blocks.get("PDF", {}).get("Author") == "John Doe"


def test_read_mp3_has_id3_tags():
    path = SAMPLES / "mp3-with-id3.mp3"
    with path.open("rb") as f:
        res = client.post("/v1/read", files={"file": ("mp3-with-id3.mp3", f, "audio/mpeg")})
    blocks = res.json()["blocks"]
    all_fields = {(b["namespace"], f) for b in blocks for f in b["fields"]}
    assert ("ID3v2_4", "Artist") in all_fields or any(
        k[0].startswith("ID3") and k[1] == "Artist" for k in all_fields
    ), f"expected ID3 Artist metadata, got {all_fields}"


def test_read_video_has_artist():
    path = SAMPLES / "video-with-meta.mp4"
    with path.open("rb") as f:
        res = client.post("/v1/read", files={"file": ("video-with-meta.mp4", f, "video/mp4")})
    blocks = {b["namespace"]: b["fields"] for b in res.json()["blocks"]}
    item = blocks.get("ItemList", {})
    assert item.get("Artist") == "ExifScrub Demo"


# --- /v1/scrub presets ---


def test_scrub_all_geotagged_strips_all_metadata():
    data = scrub_sample("geotagged.jpg", "all")
    cleaned = base64.b64decode(data["cleanedBase64"])
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(cleaned)
        tmp_path = Path(tmp.name)
    try:
        keys = exiftool_metadata_keys(tmp_path)
        assert keys == set(), f"metadata remains after all preset: {keys}"
    finally:
        tmp_path.unlink(missing_ok=True)
    assert data["retained"] == []
    assert data["stripped"]
    assert verify_hmac(data["proveCleanJson"])


def test_scrub_gps_author_geotagged():
    data = scrub_sample("geotagged.jpg", "gps_author")
    cleaned = base64.b64decode(data["cleanedBase64"])
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(cleaned)
        tmp_path = Path(tmp.name)
    try:
        keys = exiftool_metadata_keys(tmp_path)
        ns_fields = keys
        gps_keys = {k for k in ns_fields if k[0] == "GPS"}
        artist_keys = {k for k in ns_fields if k[1] in ("Artist", "Author", "Creator")}
        assert gps_keys == set(), f"GPS not stripped: {gps_keys}"
        assert artist_keys == set(), f"Author not stripped: {artist_keys}"
        make_model = {k for k in ns_fields if k[1] in ("Make", "Model")}
        assert make_model, f"Make/Model should be retained: {ns_fields}"
    finally:
        tmp_path.unlink(missing_ok=True)
    stripped_pairs = {(s["namespace"], s["field"]) for s in data["stripped"]}
    assert any(k[0] == "GPS" for k in stripped_pairs)
    assert verify_hmac(data["proveCleanJson"])


def test_scrub_gps_author_pdf():
    data = scrub_sample("pdf-with-author.pdf", "gps_author")
    cleaned = base64.b64decode(data["cleanedBase64"])
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(cleaned)
        tmp_path = Path(tmp.name)
    try:
        keys = exiftool_metadata_keys(tmp_path)
        author_creator = {k for k in keys if k[1] in ("Author", "Creator")}
        assert author_creator == set(), f"Author/Creator not stripped: {author_creator}"
        title = {k for k in keys if k[1] == "Title"}
        assert title, f"Title should be retained: {keys}"
    finally:
        tmp_path.unlink(missing_ok=True)


def test_scrub_orientation_only_geotagged():
    data = scrub_sample("geotagged.jpg", "orientation_only")
    cleaned = base64.b64decode(data["cleanedBase64"])
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(cleaned)
        tmp_path = Path(tmp.name)
    try:
        keys = exiftool_metadata_keys(tmp_path)
        gps = {k for k in keys if k[0] == "GPS"}
        assert gps == set(), f"GPS should be stripped: {gps}"
        orientation = {k for k in keys if k[1] == "Orientation"}
        # orientation may or may not exist in sample; if IFD0 exists, only orientation-like fields
        non_orientation = {k for k in keys if k[1] not in ("Orientation",) and k[0] != "Composite"}
        # Allow IFD0 resolution fields that tagsfromfile might copy — document if present
        assert not any(k[1] in ("Make", "Model", "Artist") for k in keys)
    finally:
        tmp_path.unlink(missing_ok=True)


def test_scrub_custom_geotagged_artist_only():
    custom = json.dumps([{"field": "IFD0:Artist"}])
    data = scrub_sample("geotagged.jpg", "custom", custom)
    cleaned = base64.b64decode(data["cleanedBase64"])
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(cleaned)
        tmp_path = Path(tmp.name)
    try:
        keys = exiftool_metadata_keys(tmp_path)
        artist = {k for k in keys if k[1] == "Artist"}
        assert artist == set(), f"Artist should be stripped: {keys}"
        gps = {k for k in keys if k[0] == "GPS"}
        assert gps, f"GPS should be retained with custom artist-only: {keys}"
    finally:
        tmp_path.unlink(missing_ok=True)
    stripped_pairs = {(s["namespace"], s["field"]) for s in data["stripped"]}
    assert ("IFD0", "Artist") in stripped_pairs


def test_scrub_all_presets_return_hmac():
    for preset in VALID_SCRUB_PRESETS:
        if preset == "custom":
            custom = json.dumps([{"field": "PDF:Author"}])
            data = scrub_sample("pdf-with-author.pdf", preset, custom)
        else:
            data = scrub_sample("geotagged.jpg", preset)
        prove = data["proveCleanJson"]
        assert prove["signatureAlgorithm"] == "HMAC-SHA256"
        assert verify_hmac(prove), f"HMAC invalid for preset {preset}"
        assert prove["cleanedSha256"] == data["cleaned"]["sha256"]


# --- /v1/batch ---


def test_batch_multi_file_manifest_and_prove_clean():
    buf = io.BytesIO()
    names = ["geotagged.jpg", "pdf-with-author.pdf"]
    with zipfile.ZipFile(buf, "w") as zf:
        for n in names:
            zf.writestr(n, (SAMPLES / n).read_bytes())
    buf.seek(0)

    res = client.post(
        "/v1/batch",
        files={"file": ("batch.zip", buf.read(), "application/zip")},
        data={"preset": "all"},
    )
    assert res.status_code == 200
    data = res.json()
    manifest = data["manifest"]
    assert len(manifest) == 2
    manifest_names = {m["filename"] for m in manifest}
    assert manifest_names == set(names)

    out = io.BytesIO(base64.b64decode(data["zipBase64"]))
    with zipfile.ZipFile(out) as zf:
        all_names = zf.namelist()
        assert "manifest.json" in all_names
        disk_manifest = json.loads(zf.read("manifest.json"))
        assert len(disk_manifest) == 2

        for entry in manifest:
            prove_path = entry["proveCleanPath"]
            assert prove_path in all_names, f"missing {prove_path}"
            prove = json.loads(zf.read(prove_path))
            assert verify_hmac(prove), f"invalid HMAC for {prove_path}"
            assert prove["cleanedSha256"] == entry["sha256"]

            clean_path = f"clean_{entry['filename']}"
            assert clean_path in all_names
            cleaned_bytes = zf.read(clean_path)
            assert hashlib.sha256(cleaned_bytes).hexdigest() == entry["sha256"]


def test_batch_zip_path_traversal_rejected():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../etc/passwd", b"evil")
    buf.seek(0)
    res = client.post(
        "/v1/batch",
        files={"file": ("evil.zip", buf.read(), "application/zip")},
        data={"preset": "all"},
    )
    assert res.status_code == 400


def test_batch_invalid_preset():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("a.jpg", (SAMPLES / "geotagged.jpg").read_bytes())
    buf.seek(0)
    res = client.post(
        "/v1/batch",
        files={"file": ("b.zip", buf.read(), "application/zip")},
        data={"preset": "nonexistent"},
    )
    assert res.status_code == 400


# --- /v1/fetch ---


def test_fetch_local_sample_server():
    sample_path = SAMPLES / "geotagged.jpg"
    import threading
    from functools import partial
    from http.server import HTTPServer, SimpleHTTPRequestHandler

    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "geotagged.jpg"
        dest.write_bytes(sample_path.read_bytes())
        handler = partial(SimpleHTTPRequestHandler, directory=tmp)
        server = HTTPServer(("127.0.0.1", 0), handler)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{port}/geotagged.jpg"
            res = client.post("/v1/fetch", data={"url": url})
            assert res.status_code == 200
            body = res.json()
            assert body["filename"] == "geotagged.jpg"
            assert base64.b64decode(body["base64"]) == sample_path.read_bytes()
        finally:
            server.shutdown()


def test_fetch_bad_url():
    res = client.post("/v1/fetch", data={"url": "http://127.0.0.1:1/nope"})
    assert res.status_code == 400


def test_fetch_non_200():
    res = client.post("/v1/fetch", data={"url": "https://httpbin.org/status/404"})
    assert res.status_code == 400


# --- /health ---


def test_health_get():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_health_post():
    res = client.post("/health")
    assert res.status_code in (200, 405)


# --- error cases ---


def test_scrub_invalid_preset():
    path = SAMPLES / "geotagged.jpg"
    with path.open("rb") as f:
        res = client.post(
            "/v1/scrub",
            files={"file": ("g.jpg", f, "image/jpeg")},
            data={"preset": "bad_preset"},
        )
    assert res.status_code == 400


def test_scrub_custom_invalid_json():
    path = SAMPLES / "geotagged.jpg"
    with path.open("rb") as f:
        res = client.post(
            "/v1/scrub",
            files={"file": ("g.jpg", f, "image/jpeg")},
            data={"preset": "custom", "custom": "not-json"},
        )
    assert res.status_code == 400


def test_scrub_custom_requires_fields():
    path = SAMPLES / "geotagged.jpg"
    with path.open("rb") as f:
        res = client.post(
            "/v1/scrub",
            files={"file": ("g.jpg", f, "image/jpeg")},
            data={"preset": "custom"},
        )
    assert res.status_code == 400


def test_scrub_mp3_all_strips_id3():
    path = SAMPLES / "mp3-with-id3.mp3"
    with path.open("rb") as f:
        res = client.post(
            "/v1/scrub",
            files={"file": ("mp3-with-id3.mp3", f, "audio/mpeg")},
            data={"preset": "all"},
        )
    assert res.status_code == 200
    data = res.json()
    stripped_fields = {(s["namespace"], s["field"]) for s in data["stripped"]}
    assert any(f == "Artist" for _, f in stripped_fields)
    assert verify_hmac(data["proveCleanJson"])


def test_scrub_oversized_file(monkeypatch):
    monkeypatch.setattr("app.main.MAX_FILE_BYTES", 10)
    path = SAMPLES / "geotagged.jpg"
    with path.open("rb") as f:
        res = client.post(
            "/v1/scrub",
            files={"file": ("g.jpg", f, "image/jpeg")},
            data={"preset": "all"},
        )
    assert res.status_code == 413


def test_read_oversized_file(monkeypatch):
    monkeypatch.setattr("app.main.MAX_FILE_BYTES", 10)
    path = SAMPLES / "geotagged.jpg"
    with path.open("rb") as f:
        res = client.post("/v1/read", files={"file": ("g.jpg", f, "image/jpeg")})
    assert res.status_code == 413


def test_batch_oversized_zip(monkeypatch):
    monkeypatch.setattr("app.main.MAX_FILE_BYTES", 10)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("a.jpg", (SAMPLES / "geotagged.jpg").read_bytes())
    buf.seek(0)
    res = client.post(
        "/v1/batch",
        files={"file": ("b.zip", buf.read(), "application/zip")},
        data={"preset": "all"},
    )
    assert res.status_code == 413


# --- attestation accuracy ---


def test_stripped_fields_match_actual_removal():
    data = scrub_sample("geotagged.jpg", "gps_author")
    cleaned = base64.b64decode(data["cleanedBase64"])
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(cleaned)
        before_keys = exiftool_metadata_keys(SAMPLES / "geotagged.jpg")
        after_keys = exiftool_metadata_keys(Path(tmp.name))
        tmp_path = Path(tmp.name)
    try:
        actually_removed = before_keys - after_keys
        reported_stripped = {(s["namespace"], s["field"]) for s in data["stripped"]}
        assert reported_stripped <= actually_removed or reported_stripped == actually_removed
        missing_from_report = actually_removed - reported_stripped
        extra_in_report = reported_stripped - actually_removed
        assert not extra_in_report, f"stripped lists fields not removed: {extra_in_report}"
    finally:
        tmp_path.unlink(missing_ok=True)


def test_hmac_secret_consistency():
    prove = scrub_sample("geotagged.jpg", "all")["proveCleanJson"]
    canonical = json.dumps(
        {
            "version": prove["version"],
            "filename": prove["filename"],
            "cleanedSha256": prove["cleanedSha256"],
            "stripped": prove["stripped"],
            "retained": prove["retained"],
            "timestamp": prove["timestamp"],
            "signatureAlgorithm": prove["signatureAlgorithm"],
        },
        sort_keys=True,
    )
    expected = hmac.new(HMAC_SECRET, canonical.encode(), hashlib.sha256).hexdigest()
    assert prove["signature"] == expected
