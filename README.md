# ExifScrub (`image-metadata-stripper`)

Remove EXIF, GPS, XMP, IPTC and MakerNotes metadata from JPEG, PNG, HEIC, PDF, MP3 and MP4 — privacy presets and prove-clean reports.

## Features

- **In-browser** processing for JPEG, PNG, HEIC, WebP, TIFF, GIF, and AVIF — your image never leaves your device
- **Server worker** (optional) for PDF, MP3, FLAC, MP4, MOV, and WAV via ExifTool
- **Privacy presets**: Strip all, Strip GPS + author, Keep orientation only, Custom field selection
- **Prove-clean** PDF + JSON attestation with cryptographic signature (Ed25519 in browser, HMAC on worker)
- Before/after metadata diff view with table UI
- **Batch ZIP** processing via worker
- Sample files, URL loading (server-side fetch for external URLs)
- CLI: `npx @exifscrub/cli scrub photo.jpg --preset all`

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

Copy `.env.example` to `.env` and set `VITE_WORKER_URL` for production deployments.

### GitHub Pages

Enable **Settings → Pages → GitHub Actions** as the source. Pushes to `main` build with `VITE_BASE=/image-metadata-stripper/` and deploy when Pages is configured. The deploy job uses `continue-on-error` until Pages is enabled so CI stays green.

## Worker API

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `POST /v1/read` | Read metadata |
| `POST /v1/scrub` | Scrub file (supports `preset`, `custom` JSON) |
| `POST /v1/batch` | Batch process ZIP |
| `POST /v1/fetch` | Fetch file from URL (server-side) |

## Monorepo layout

```
packages/core/   Browser metadata read, scrub, diff, prove-clean
packages/web/    Vite + React playground
packages/cli/    CLI wrapper
apps/worker/     Python FastAPI + ExifTool (AGPL-3.0)
samples/         Test fixtures with real metadata
```

## Development

```bash
pnpm test          # Unit tests
pnpm --filter @exifscrub/web test:e2e   # Playwright e2e
pnpm typecheck
pnpm build
```

## License

- `packages/core`, `packages/web`, `packages/cli`: **MIT** ([LICENSE](LICENSE))
- `apps/worker`: **AGPL-3.0** ([apps/worker/LICENSE](apps/worker/LICENSE))

## Topics

`exif` `metadata` `metadata-remover` `gps` `privacy` `xmp` `iptc` `makernotes` `exif-scrubber` `image-privacy` `pdf-metadata` `mp4-metadata` `id3` `online-tool`

## Links

- GitHub: [chayprabs/image-metadata-stripper](https://github.com/chayprabs/image-metadata-stripper)
- Maintainer: [@chayprabs](https://x.com/chayprabs)
- Website: [chaitanyaprabuddha.com](https://www.chaitanyaprabuddha.com)
