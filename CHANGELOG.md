# Changelog

## [0.3.1] — 2026-11-28

### Added
- Multi-stage `Dockerfile` (Node 22, non-root) + `.dockerignore`
- `package-lock.json` for reproducible installs (`npm ci`)
- `.nvmrc` (22), `.editorconfig`
- `CONTRIBUTING.md`
- CI: `npm ci` + Docker image build job
- `package.json` `exports` field, `prepublishOnly`

### Fixed
- Security hardener idempotency (`.gitignore` baseline marker)
- Strict TypeScript unused-parameter compliance
- CI without lockfile cache failures

## [0.3.0] — 2026-11-28

### Added
- Smoke test runner (Node strip-types, no vitest required for CI)
- Golden fixtures: bare-node, bare-python, bare-go
- PR mode, quality score re-analysis, idempotency probe
- Dependabot, SECURITY.md, LICENSE, honest README scope

### Hardeners
- docs, ci (Node/Python/Go), tests, docker, security
