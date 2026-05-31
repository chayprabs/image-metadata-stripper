# ExifScrub Qualification Report

**Tool:** ExifScrub (`image-metadata-stripper`)  
**Repo:** https://github.com/chayprabs/image-metadata-stripper  
**Run at:** 2026-05-31 (final pass)  
**Verifier:** Cursor Cloud Agent  

## Summary

| Metric | Count |
|--------|-------|
| Total checks (Section 6) | 45+ |
| Passed | 42 |
| Failed | 0 (code) |
| Verify-deferred | 3 (Lighthouse on prod URL, Docker runtime on agent host, npm publish) |

**Verdict:** QUALIFIED for repository v1. Enable GitHub Pages in repo settings to activate live deploy.

## Passed evidence

- `pnpm install && pnpm build && pnpm test` — success on main
- Playwright e2e — 6/6 pass (sample load + browser scrub)
- Worker pytest — 6/6 pass (batch prove-clean manifest)
- CLI vitest smoke — scrubs geotagged.jpg with prove-clean outputs
- Hybrid layout: `packages/core`, `packages/web`, `packages/cli`, `apps/worker`
- MIT + AGPL LICENSE split
- Browser JPEG scrub + prove-clean signature (in-session Ed25519)
- Worker `/health`, `/v1/read`, `/v1/scrub`, `/v1/batch`, `/v1/fetch` with ExifTool
- Batch ZIP includes `prove-clean/*.prove-clean.json` per file
- Frontend: white theme, topbar, SEO bar, home tool, privacy/terms, SEO routes
- Samples: geotagged.jpg, pdf-with-author.pdf, mp3-with-id3.mp3, video-with-meta.mp4
- No AuthOS references
- CI workflow green on push to main
- GitHub Pages build config (`VITE_BASE`, 404.html, absolute sitemap)
- `.env.example` committed

## Verify-deferred

- Lighthouse >= 95 on production URL (requires deployed host)
- Docker compose up on agent host (no Docker daemon in cloud VM)
- npm package publish to registry

## Rerun commands

```bash
pnpm install && pnpm build && pnpm test
pnpm --filter @exifscrub/web test:e2e
cd apps/worker && PYTHONPATH=. python3 -m pytest tests -q
docker compose up --build
```

## Enable live site

1. GitHub repo **Settings → Pages → Build and deployment → GitHub Actions**
2. Re-run the Deploy workflow or push to `main`
3. Site URL: https://chayprabs.github.io/image-metadata-stripper/
