# RepoForge

**Production-grade repository hardening engine.**

RepoForge turns any repository into a production-ready project — with tests, CI, security baseline, documentation and a verifiable quality score.

It is designed as a **reference system**: deterministic analysis first, safe application of changes, self-validation, and clear before/after reporting.

> Not a linter. Not a simple generator. A hardening engine with safety guarantees.

---

## Status

**v0.1.0 — Foundation (active)**

- [x] Core engine pipeline (analyze → plan → safety → apply → verify)
- [x] ProjectModel (structured repository understanding)
- [x] Hardener contract + validation
- [x] Safety layer (path protection, risk gates)
- [x] DocsHardener
- [x] CIHardener
- [x] TestsHardener
- [x] DockerHardener
- [x] SecurityHardener
- [x] CLI (`analyze`, `harden`)
- [x] Git snapshot before apply + rollback hook
- [x] Temp-copy simulation before accept
- [x] Secret pattern scan (paths + light content heuristics)
- [x] Agensi SKILL.md packaging
- [x] Golden fixture + integration test (bare-node)
- [ ] Broader language support in Tests/Docker hardeners
- [ ] Outdated dependency version resolution

---

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Analyze any repository
npx tsx src/cli/index.ts analyze /path/to/repo

# Dry-run hardening (default — no writes)
npx tsx src/cli/index.ts harden /path/to/repo

# Actually apply changes
npx tsx src/cli/index.ts harden /path/to/repo --apply

# Write Markdown report
npx tsx src/cli/index.ts harden /path/to/repo --report report.md
```

---

## Design Principles

1. **Never break a repository** — dry-run by default, validation, rollback hooks
2. **Deterministic core** — stack detection and gap analysis do not depend on LLM
3. **Explain every change** — each file change carries a reason
4. **Idempotent** — re-running on an already hardened repo is safe
5. **Modular Hardeners** — new capabilities = new modules, not core rewrites

See [docs/architecture.md](./docs/architecture.md) and [docs/concept.md](./docs/concept.md).

---

## Architecture (short)

```
Ingestion → Analyzer → Planner → Hardener Engine → Safety Layer → Apply → Verify → Report
```

Each Hardener implements a strict contract (`supports` → `analyze` → `plan` → `apply` → `validate`).

---

## License

MIT
