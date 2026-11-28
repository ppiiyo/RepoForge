# Contributing to RepoForge

Thanks for helping improve the repository hardening engine.

## Development setup

```bash
git clone https://github.com/ppiiyo/RepoForge.git
cd RepoForge
nvm use   # Node 22 (.nvmrc)
npm ci
npm test
npm run typecheck
npm run build
```

## Workflow

1. Open an issue or pick an existing one before large changes.
2. Branch from `main`: `git checkout -b feat/short-name`.
3. Keep changes focused (one hardener / one concern per PR).
4. Add or extend golden fixtures under `tests/golden/` when behavior changes.
5. Ensure `npm test`, `npm run typecheck`, and `npm run build` pass.
6. Open a PR with a clear description of *what* and *why*.

## Code guidelines

- TypeScript strict mode — no `any` without justification.
- Hardeners implement the full contract: `supports` → `analyze` → `plan` → `apply` → `validate`.
- Prefer **skip** over overwrite for existing user files.
- Never write secrets, never leave the repo root, never touch `.git/`.
- Smoke tests in `scripts/smoke-test.mjs` must stay green.

## Safety

RepoForge is a **scaffolding** tool. PRs that weaken path protection, secret patterns, or dry-run defaults will be rejected.

## License

By contributing you agree that your contributions are licensed under the MIT License.
