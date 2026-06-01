"""Second verification pass — full matrix against exiftool ground truth."""

import base64
import hashlib
import io
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import VALID_SCRUB_PRESETS, app, sign_payload

client = TestClient(app)
SAMPLES = Path(__file__).resolve().parents[3] / "samples"

SAMPLE_FILES = {
    "geotagged.jpg": "image/jpeg",
    "pdf-with-author.pdf": "application/pdf",
    "mp3-with-id3.mp3": "audio/mpeg",
    "video-with-meta.mp4": "video/mp4",
}

SKIP_NS = {"ExifTool", "System", "File", "Composite"}
SKIP_FIELDS = {"SourceFile", "ExifToolVersion"}
PII_FIELDS = frozenset({"Artist", "Author", "Creator", "Title", "Comment", "GPSLatitude", "GPSLongitude"})
GPS_AUTHOR_FIELDS = frozenset({"Artist", "Author", "Creator"})


def exiftool_keys(path: Path) -> set[tuple[str, str]]:
    result = subprocess.run(
        ["exiftool", "-json", "-a", "-G1", str(path)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    keys: set[tuple[str, str]] = set()
    if result.returncode == 0 and result.stdout.strip():
        data = json.loads(result.stdout)[0]
        for key in data:
            ns = key.split(":", 1)[0] if ":" in key else "EXIF"
            field = key.split(":", 1)[-1]
            if ns in SKIP_NS or field in SKIP_FIELDS:
                continue
            keys.add((ns, field))
    return keys


def pii_keys(keys: set[tuple[str, str]]) -> set[tuple[str, str]]:
    return {k for k in keys if k[1] in PII_FIELDS or k[0] == "GPS"}


def scrub(name: str, preset: str, custom: str | None = None):
    path = SAMPLES / name
    data: dict = {"preset": preset}
    if custom is not None:
        data["custom"] = custom
    with path.open("rb") as f:
        return client.post(
            "/v1/scrub",
            files={"file": (name, f, SAMPLE_FILES[name])},
            data=data,
        )


def write_cleaned(data: dict, suffix: str) -> Path:
    cleaned = base64.b64decode(data["cleanedBase64"])
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(cleaned)
    tmp.close()
    return Path(tmp.name)


def verify_attestation(before_path: Path, data: dict, cleaned_path: Path) -> list[str]:
    errors: list[str] = []
    before_keys = exiftool_keys(before_path)
    after_keys = exiftool_keys(cleaned_path)
    actually_stripped = before_keys - after_keys
    actually_retained = after_keys

    reported_stripped = {(s["namespace"], s["field"]) for s in data["stripped"]}
    reported_retained = {(r["namespace"], r["field"]) for r in data["retained"]}

    if reported_stripped - actually_stripped:
        errors.append(f"stripped false positive: {reported_stripped - actually_stripped}")
    if actually_stripped - reported_stripped:
        errors.append(f"stripped false negative: {actually_stripped - reported_stripped}")
    if reported_retained - actually_retained:
        errors.append(f"retained false positive: {reported_retained - actually_retained}")
    if actually_retained - reported_retained:
        errors.append(f"retained false negative: {actually_retained - reported_retained}")

    prove = data["proveCleanJson"]
    prove_copy = {**prove, "signature": ""}
    if prove["signature"] != sign_payload(prove_copy):
        errors.append("HMAC signature mismatch")
    if prove["cleanedSha256"] != hashlib.sha256(cleaned_path.read_bytes()).hexdigest():
        errors.append("cleanedSha256 mismatch")
    return errors


PRESET_MATRIX = [
    ("geotagged.jpg", "all", None),
    ("geotagged.jpg", "gps_author", None),
    ("geotagged.jpg", "orientation_only", None),
    ("geotagged.jpg", "custom", json.dumps([{"field": "IFD0:Artist"}])),
    ("pdf-with-author.pdf", "all", None),
    ("pdf-with-author.pdf", "gps_author", None),
    ("pdf-with-author.pdf", "orientation_only", None),
    ("pdf-with-author.pdf", "custom", json.dumps([{"field": "PDF:Author"}])),
    ("mp3-with-id3.mp3", "all", None),
    ("mp3-with-id3.mp3", "gps_author", None),
    ("mp3-with-id3.mp3", "orientation_only", None),
    ("mp3-with-id3.mp3", "custom", json.dumps([{"field": "ID3:Artist"}])),
    ("video-with-meta.mp4", "all", None),
    ("video-with-meta.mp4", "gps_author", None),
    ("video-with-meta.mp4", "orientation_only", None),
    ("video-with-meta.mp4", "custom", json.dumps([{"field": "ItemList:Artist"}])),
]


@pytest.mark.parametrize("filename,preset,custom", PRESET_MATRIX)
def test_scrub_matrix_status_and_attestation(filename, preset, custom):
    res = scrub(filename, preset, custom)
    assert res.status_code == 200, f"{filename}/{preset}: {res.status_code} {res.text}"
    data = res.json()
    cleaned_path = write_cleaned(data, Path(filename).suffix)
    try:
        errors = verify_attestation(SAMPLES / filename, data, cleaned_path)
        assert not errors, f"{filename}/{preset}: {errors}"
    finally:
        cleaned_path.unlink(missing_ok=True)


@pytest.mark.parametrize("filename,preset,custom", PRESET_MATRIX)
def test_scrub_matrix_pii_expectations(filename, preset, custom):
    """Verify PII scrubbing semantics (container/codec metadata may remain)."""
    res = scrub(filename, preset, custom)
    assert res.status_code == 200
    data = res.json()
    cleaned_path = write_cleaned(data, Path(filename).suffix)
    try:
        keys = exiftool_keys(cleaned_path)
        pii = pii_keys(keys)
        if preset == "all":
            assert pii == set(), f"{filename}/all: PII remains {pii}"
        elif preset == "gps_author":
            gps_author_pii = {k for k in keys if k[0] == "GPS" or k[1] in GPS_AUTHOR_FIELDS}
            assert gps_author_pii == set(), f"{filename}/gps_author: GPS/author remains {gps_author_pii}"
        elif preset == "custom" and custom and "Artist" in custom:
            assert pii == set() or not any(k[1] == "Artist" for k in pii), f"{filename}/custom: {pii}"
    finally:
        cleaned_path.unlink(missing_ok=True)


def test_batch_all_four_samples_pii_clean():
    buf = io.BytesIO()
    names = list(SAMPLE_FILES.keys())
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
    assert len(data["manifest"]) == 4

    out = io.BytesIO(base64.b64decode(data["zipBase64"]))
    with zipfile.ZipFile(out) as zf:
        for entry in data["manifest"]:
            prove = json.loads(zf.read(entry["proveCleanPath"]))
            prove_copy = {**prove, "signature": ""}
            assert prove["signature"] == sign_payload(prove_copy)
            cleaned = zf.read(f"clean_{entry['filename']}")
            assert hashlib.sha256(cleaned).hexdigest() == entry["sha256"]
            with tempfile.NamedTemporaryFile(suffix=Path(entry["filename"]).suffix, delete=False) as tmp:
                tmp.write(cleaned)
                tmp_path = Path(tmp.name)
            try:
                pii = pii_keys(exiftool_keys(tmp_path))
                assert pii == set(), f"batch all left PII in {entry['filename']}: {pii}"
            finally:
                tmp_path.unlink(missing_ok=True)


def test_mp3_ffmpeg_gps_author_strips_artist():
    res = scrub("mp3-with-id3.mp3", "gps_author")
    assert res.status_code == 200
    cleaned_path = write_cleaned(res.json(), ".mp3")
    try:
        keys = exiftool_keys(cleaned_path)
        assert not any(k[1] == "Artist" for k in keys)
    finally:
        cleaned_path.unlink(missing_ok=True)


def test_mp3_orientation_only_copies_unchanged():
    before = exiftool_keys(SAMPLES / "mp3-with-id3.mp3")
    res = scrub("mp3-with-id3.mp3", "orientation_only")
    assert res.status_code == 200
    cleaned_path = write_cleaned(res.json(), ".mp3")
    try:
        assert exiftool_keys(cleaned_path) == before
    finally:
        cleaned_path.unlink(missing_ok=True)


def test_mp3_custom_unmatched_field_should_not_noop():
    """Custom MP3 field with no ffmpeg heuristic match should not leave file unchanged."""
    res = scrub("mp3-with-id3.mp3", "custom", json.dumps([{"field": "GPS:Latitude"}]))
    assert res.status_code == 200
    data = res.json()
    assert data["stripped"], "expected metadata change for custom preset"
    cleaned_path = write_cleaned(data, ".mp3")
    try:
        assert not any(k[1] == "Artist" for k in exiftool_keys(cleaned_path))
    finally:
        cleaned_path.unlink(missing_ok=True)


def test_video_custom_artist_strips_all_artist_namespaces():
    res = scrub("video-with-meta.mp4", "custom", json.dumps([{"field": "ItemList:Artist"}]))
    assert res.status_code == 200
    cleaned_path = write_cleaned(res.json(), ".mp4")
    try:
        artist = {k for k in exiftool_keys(cleaned_path) if k[1] == "Artist"}
        assert artist == set(), f"Artist fields remain: {artist}"
    finally:
        cleaned_path.unlink(missing_ok=True)


def test_pdf_orientation_only_preserves_author():
    res = scrub("pdf-with-author.pdf", "orientation_only")
    assert res.status_code == 200
    cleaned_path = write_cleaned(res.json(), ".pdf")
    try:
        keys = exiftool_keys(cleaned_path)
        assert ("PDF", "Author") in keys, f"Author stripped by orientation_only on PDF: {keys}"
    finally:
        cleaned_path.unlink(missing_ok=True)


def test_custom_empty_array_rejected():
    path = SAMPLES / "geotagged.jpg"
    with path.open("rb") as f:
        res = client.post(
            "/v1/scrub",
            files={"file": ("g.jpg", f, "image/jpeg")},
            data={"preset": "custom", "custom": "[]"},
        )
    assert res.status_code == 400


def test_batch_custom_empty_array_rejected():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("a.jpg", (SAMPLES / "geotagged.jpg").read_bytes())
    buf.seek(0)
    res = client.post(
        "/v1/batch",
        files={"file": ("b.zip", buf.read(), "application/zip")},
        data={"preset": "custom", "custom": "[]"},
    )
    assert res.status_code == 400


def test_all_presets_defined():
    assert VALID_SCRUB_PRESETS == {"all", "gps_author", "orientation_only", "custom"}
