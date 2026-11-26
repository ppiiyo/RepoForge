# RepoForge

**Production-grade repository hardening engine.**

Turns any repository into something you can ship: CI, tests, Docker, docs, and a security baseline — with dry-run, validation, rollback, and optional PR mode.

## Features (v0.2)

| Capability | Detail |
|------------|--------|
| **Analyze** | Languages, frameworks, tests, CI, Docker, docs, secrets (paths only), quality score 0–100 |
| **Hardeners** | docs · CI (Node/Python/Go) · tests (vitest/jest/pytest) · Docker · security |
| **Safety** | Dry-run by default · protected files · path guards · temp simulation · git snapshot + rollback |
| **PR mode** | `--pr` → branch → apply → commit → push → `gh pr create` |
| **Idempotency** | Second pass reports whether the tree is stable |
| **Reports** | Terminal + Markdown + JSON |

## Quick start

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

## Safety contract

1. Never modifies `.env*`, keys, PEM, credential JSON
2. Never writes outside the repo root
3. Never touches `.git/` internals
4. Prefers skip over overwrite for existing CI/Docker/tests
5. On validation failure → rollback

## License

MIT
