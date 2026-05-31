# ExifScrub (`image-metadata-stripper`)

Remove EXIF, GPS, XMP, IPTC and MakerNotes metadata from JPEG, PNG, HEIC, PDF, MP3 and MP4 — privacy presets and prove-clean reports.

## Features

- **In-browser** processing for JPEG, PNG, HEIC, WebP, TIFF, GIF, and AVIF — your image never leaves your device.
- **Server worker** (optional) for PDF, MP3, FLAC, MP4, MOV, and WAV via ExifTool.
- Privacy presets: Strip all, Strip GPS + author, Keep orientation only.
- **Prove-clean** JSON attestation with cryptographic signature (Ed25519 in browser, HMAC on worker).
- Before/after metadata diff view.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173

### Worker (PDF / media)

```bash
docker compose up --build
```

The web app proxies `/api` to the worker on port 8080.

## Monorepo layout

```
packages/core/   Browser metadata read, scrub, diff, prove-clean
packages/web/    Vite + React playground
packages/cli/    CLI wrapper
apps/worker/     Python FastAPI + ExifTool (AGPL-3.0)
```

## License

- `packages/core`, `packages/web`, `packages/cli`: **MIT**
- `apps/worker`: **AGPL-3.0**

## Topics

`exif` `metadata` `metadata-remover` `gps` `privacy` `xmp` `iptc` `makernotes` `exif-scrubber` `image-privacy` `pdf-metadata` `mp4-metadata` `id3` `online-tool`

## Links

- Maintainer: [@chayprabs](https://x.com/chayprabs)
- Website: [chaitanyaprabuddha.com](https://www.chaitanyaprabuddha.com)
