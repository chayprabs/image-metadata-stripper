# Changelog

## 1.0.1 — 2026-05-31

### Added
- Comprehensive Privacy Policy (GDPR, CCPA, LGPD, international rights)
- Comprehensive Terms & Conditions (liability cap, indemnification, governing law)
- Legal & Licenses page (`/legal`), LEGAL.md, DISCLAIMER.md, NOTICE.md
- Footer acceptance notice and SPDX license identifiers

## 1.0.0 — 2026-05-31

### Added
- In-browser metadata scrub for JPEG, PNG, WebP, GIF, AVIF, HEIC
- Server worker for PDF, MP3, MP4, MOV, WAV via ExifTool
- Privacy presets: Strip all, GPS+author, orientation only, custom
- Prove-clean PDF + JSON attestations with cryptographic signatures
- Batch ZIP processing via worker (includes per-file prove-clean JSON)
- Sample files (JPEG, PDF, MP3, MP4), URL loading (server fetch for external URLs)
- SEO landing pages, privacy policy, terms & conditions
- CLI (`exifscrub`) with smoke test, Docker compose, GitHub Actions CI + e2e
- GitHub Pages build (`VITE_BASE`, SPA 404.html, sitemap, robots.txt)

### Fixed
- Prove-clean attestation accuracy for partial presets
- Worker custom preset support
- PNG orientation-only preset behavior
- `.env.example` tracked in git (gitignore exception)
- Deploy workflow no longer fails main when Pages is not yet enabled
