# RepoForge

**Repository hardening engine** — analyze a repo and safely add the missing production basics: CI, smoke tests, Docker, docs, and a security baseline.

> Scope is intentional and limited. RepoForge scaffolds **infrastructure**, not business logic or a full security audit.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What it does

| Hardener | Action when missing |
|----------|---------------------|
| **docs** | README / CONTRIBUTING / SECURITY stubs |
| **ci** | GitHub Actions for Node, Python, or Go |
| **tests** | Vitest/Jest or pytest **smoke** test |
| **docker** | Multi-stage Dockerfile template |
| **security** | Dependabot + hardened `.gitignore` entries |

Plus: quality score 0–100, dry-run by default, path protection, optional git snapshot/rollback, optional `--pr`, idempotency probe after apply.

## What it does **not** do

- Full SAST/SCA (use CodeQL, Snyk, etc.)
- Generate real unit tests for domain logic
- Rewrite application source code
- Guarantee a finished “production product” — only a stronger **repo baseline**

## Requirements

- Node.js ≥ 20
- Optional: `git`, GitHub CLI (`gh`) for `--pr`

## Install & run

```bash
git clone https://github.com/ppiiyo/RepoForge.git
cd RepoForge
npm install

npx tsx src/cli/index.ts analyze /path/to/repo
npx tsx src/cli/index.ts harden /path/to/repo
npx tsx src/cli/index.ts harden /path/to/repo --apply
npx tsx src/cli/index.ts harden /path/to/repo --pr
npx tsx src/cli/index.ts harden /path/to/repo --report report.md
```

```bash
npm run build
node dist/cli/index.js harden /path/to/repo --apply
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

### Golden fixtures

- `tests/golden/bare-node` — minimal npm package
- `tests/golden/bare-python` — `main.py` + `requirements.txt`
- `tests/golden/bare-go` — `main.go` + `go.mod`

## Safety contract

1. Never modifies `.env*`, keys, PEM, credential JSON
2. Never writes outside the repo root
3. Never touches `.git/` internals
4. Prefers **skip** over overwrite for existing CI / Docker / tests
5. On validation failure → rollback when a snapshot exists

## Status

**v0.3.0** — CLI with unit/integration tests, golden fixtures, and self-CI. Early but intentional.

## License

MIT — see [LICENSE](LICENSE)
