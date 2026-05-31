from fastapi.testclient import TestClient
from pathlib import Path

from app.main import app

client = TestClient(app)
SAMPLES = Path(__file__).resolve().parents[3] / "samples"


def test_scrub_pdf_all():
    pdf = SAMPLES / "pdf-with-author.pdf"
    assert pdf.exists(), "pdf sample required"
    with pdf.open("rb") as f:
        res = client.post(
            "/v1/scrub",
            files={"file": ("test.pdf", f, "application/pdf")},
            data={"preset": "all"},
        )
    assert res.status_code == 200
    data = res.json()
    assert "cleanedBase64" in data
    assert data["proveCleanJson"]["signature"]
    assert data["stripped"]


def test_batch_invalid_zip():
    res = client.post(
        "/v1/batch",
        files={"file": ("bad.zip", b"not a zip", "application/zip")},
        data={"preset": "all"},
    )
    assert res.status_code == 400
