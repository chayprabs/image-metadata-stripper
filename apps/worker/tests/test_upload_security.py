from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app, safe_upload_name

client = TestClient(app)


def test_safe_upload_name_strips_path_components():
    assert safe_upload_name("../../../tmp/pwned.wav") == "pwned.wav"
    assert safe_upload_name("/etc/passwd") == "passwd"
    assert safe_upload_name(None) == "upload.bin"
    assert safe_upload_name("..") == "upload.bin"


def test_read_rejects_path_traversal_filename(tmp_path, monkeypatch):
    job_dir = tmp_path / "job"
    job_dir.mkdir()

    def fake_mkdtemp(**_kwargs):
        return str(job_dir)

    monkeypatch.setattr("app.main.tempfile.mkdtemp", fake_mkdtemp)
    payload = b"RIFF...."
    r = client.post(
        "/v1/read",
        files={"file": ("../../../tmp/pwned.wav", payload, "audio/wav")},
    )
    assert r.status_code == 200
    assert r.json()["file"]["name"] == "pwned.wav"
    assert not Path("/tmp/pwned.wav").exists()
