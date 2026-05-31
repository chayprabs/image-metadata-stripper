# Changelog

## 1.0.0 — 2026-05-31

### Added
- In-browser metadata scrub for JPEG, PNG, WebP, GIF, AVIF, HEIC
- Server worker for PDF, MP3, MP4, MOV, WAV via ExifTool
- Privacy presets: Strip all, GPS+author, orientation only, custom
- Prove-clean PDF + JSON attestations with cryptographic signatures
- Batch ZIP processing via worker
- Sample files, URL loading (server fetch for external URLs)
- SEO landing pages, privacy policy, terms & conditions
- CLI (`exifscrub`), Docker compose, GitHub Actions CI

### Fixed
- Prove-clean attestation accuracy for partial presets
- Worker custom preset support
- PNG orientation-only preset behavior
