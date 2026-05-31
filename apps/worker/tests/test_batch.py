import base64
import io
import json
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
SAMPLES = Path(__file__).resolve().parents[3] / "samples"


def test_batch_zip_includes_prove_clean_manifest():
    jpg = SAMPLES / "geotagged.jpg"
    assert jpg.exists()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("geotagged.jpg", jpg.read_bytes())
    buf.seek(0)

    res = client.post(
        "/v1/batch",
        files={"file": ("batch.zip", buf.read(), "application/zip")},
        data={"preset": "all"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["manifest"]
    assert data["manifest"][0]["proveCleanPath"].startswith("prove-clean/")

    out = io.BytesIO(base64.b64decode(data["zipBase64"]))
    with zipfile.ZipFile(out) as zf:
        names = zf.namelist()
        assert any(n.startswith("clean_") for n in names)
        prove_files = [n for n in names if n.startswith("prove-clean/")]
        assert prove_files
        prove = json.loads(zf.read(prove_files[0]))
        assert prove["signature"]
        assert prove["cleanedSha256"]
