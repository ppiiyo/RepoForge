# RepoForge

**Repository hardening engine** — analyze a repo and safely add the missing production basics: CI, smoke tests, Docker, docs, and a security baseline.

> Scope is intentional and limited. RepoForge scaffolds **infrastructure**, not business logic or a full security audit.

[![CI](https://github.com/ppiiyo/RepoForge/actions/workflows/ci.yml/badge.svg)](https://github.com/ppiiyo/RepoForge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

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

- Node.js ≥ 20 (CI and Docker use **22**)
- Optional: `git`, GitHub CLI (`gh`) for `--pr`

## Install & run

```bash
git clone https://github.com/ppiiyo/RepoForge.git
cd RepoForge
npm install   # or npm ci when package-lock.json is present
npm run build

npx tsx src/cli/index.ts analyze /path/to/repo
npx tsx src/cli/index.ts harden /path/to/repo              # dry-run
npx tsx src/cli/index.ts harden /path/to/repo --apply
npx tsx src/cli/index.ts harden /path/to/repo --pr
npx tsx src/cli/index.ts harden /path/to/repo --report report.md
```

```bash
node dist/cli/index.js harden /path/to/repo --apply
```

### Docker

```bash
docker build -t repoforge:0.3 .
docker run --rm -v "$PWD":/work -w /work repoforge:0.3 analyze .
docker run --rm -v "$PWD":/work -w /work repoforge:0.3 harden . --apply
```

## Development

```bash
nvm use        # 22
npm install
npm run typecheck
npm test
npm run build
```

### Golden fixtures

- `tests/golden/bare-node` — minimal npm package
- `tests/golden/bare-python` — `main.py` + `requirements.txt`
- `tests/golden/bare-go` — `main.go` + `go.mod`

Measured on bare-node: quality score **0 → 90** after one `--apply`.

## Safety contract

1. Never modifies `.env*`, keys, PEM, credential JSON
2. Never writes outside the repo root
3. Never touches `.git/` internals
4. Prefers **skip** over overwrite for existing CI / Docker / tests
5. On validation failure → rollback when a snapshot exists

## Architecture

```
Analyze → Plan → Safety (simulate) → [Snapshot] → Apply → Validate → Report
                                                      └─ optional PR
```

See [docs/architecture.md](docs/architecture.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
