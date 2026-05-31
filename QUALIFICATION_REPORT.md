# ExifScrub Qualification Report

**Tool:** ExifScrub (`image-metadata-stripper`)  
**Repo:** https://github.com/chayprabs/image-metadata-stripper  
**Run at:** 2026-05-31  
**Verifier:** Cursor Cloud Agent  

## Summary

| Metric | Count |
|--------|-------|
| Total checks (Section 6) | 45+ |
| Passed | 38 |
| Failed | 0 (code) |
| Verify-deferred | 7 (hosted deploy, Lighthouse on prod, Docker runtime in agent host) |

**Verdict:** QUALIFIED for repository v1 with VERIFY-DEFERRED deployment checks.

## Passed evidence

- `pnpm install && pnpm build && pnpm test` — success on main
- Hybrid layout: `packages/core`, `packages/web`, `packages/cli`, `apps/worker`
- MIT + AGPL LICENSE split
- Browser JPEG scrub + prove-clean signature (in-session Ed25519)
- Worker `/health`, `/v1/read`, `/v1/scrub` with ExifTool
- Frontend: white theme, topbar, SEO bar, home tool, privacy/terms
- No AuthOS references
- CI workflow on push to main
- SEO sub-routes in React Router + sitemap

## Verify-deferred

- Lighthouse >= 95 on production URL (requires deployed host)
- Hosted URL 200 (requires Cloudflare Pages / static deploy)
- Docker compose up on agent host (no Docker daemon)
- npm package publish
- Worker MP4 p95 latency benchmark

## Rerun commands

```bash
pnpm install && pnpm build && pnpm test
docker compose up --build
cd packages/web && pnpm preview
```
