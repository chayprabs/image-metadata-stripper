# Third-Party Notices

ExifScrub includes or depends on the following third-party software. This list is not exhaustive; see `package.json`, `requirements.txt`, and lockfiles for complete dependency trees.

## Runtime dependencies (summary)

| Component | License | Notes |
|-----------|---------|-------|
| [ExifTool](https://exiftool.org/) | GPL-1.0+ / Artistic-1.0-Perl | Used by worker; separate install when self-hosting |
| [FFmpeg](https://ffmpeg.org/) | LGPL-2.1+ / GPL-2+ | Used by worker for MP3 metadata stripping |
| [exifr](https://www.npmjs.com/package/exifr) | MIT | Browser metadata reading |
| [piexifjs](https://www.npmjs.com/package/piexifjs) | MIT | JPEG EXIF manipulation |
| [pdf-lib](https://pdf-lib.js.org/) | MIT | Prove-clean PDF generation |
| [heic2any](https://www.npmjs.com/package/heic2any) | MIT | HEIC conversion in browser |
| [React](https://react.dev/) | MIT | Web UI |
| [FastAPI](https://fastapi.tiangolo.com/) | MIT | Worker API |
| [ExifScrub worker app](apps/worker/) | AGPL-3.0 | Network copyleft when deployed as a service |

## Your obligations

When you **self-host** the worker, you are responsible for complying with ExifTool, FFmpeg, and other dependency licenses in your jurisdiction. AGPL-3.0 applies to modified worker deployments offered as a network service.

## MIT License (project core)

The MIT License text for `packages/core`, `packages/web`, and `packages/cli` is in [LICENSE](LICENSE).

## AGPL-3.0 (worker)

The worker license notice is in [apps/worker/LICENSE](apps/worker/LICENSE). Full license text: https://www.gnu.org/licenses/agpl-3.0.html
