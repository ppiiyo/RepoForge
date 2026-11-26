# Agensi Listing — RepoForge

Copy-paste ready materials for https://www.agensi.io

---

## Title

RepoForge — Make Any Repo Production-Ready

## One-line summary

Analyze a repository and safely add CI, tests, Docker, docs, and a security baseline — with dry-run, rollback, and optional PR mode.

## Price recommendation

- **One-time:** $24–$29
- **Alternative:** $15 with free updates for 90 days

## Tags / keywords

repository, hardening, CI, GitHub Actions, tests, Docker, security, Dependabot, production-ready, devops, agent-ready, quality score

## Full description

**RepoForge** turns incomplete repositories into shippable projects.

Most tools only *find* problems. RepoForge **adds the missing production infrastructure** in one controlled pass:

- GitHub Actions CI (Node, Python, Go)
- Smoke tests (Vitest / Jest / pytest)
- Multi-stage Dockerfile
- README / SECURITY.md / CONTRIBUTING baseline
- Dependabot + hardened `.gitignore`
- Quality score 0–100 (before and after)

### Safety first

- Dry-run by default (`--apply` or `--pr` to write)
- Never touches `.env`, keys, or credentials
- Temp-copy simulation before apply
- Git snapshot + rollback on validation failure
- Idempotent: second run plans zero extra changes when stable

### Commands

```bash
npx tsx src/cli/index.ts analyze .
npx tsx src/cli/index.ts harden .              # dry-run
npx tsx src/cli/index.ts harden . --apply      # write files
npx tsx src/cli/index.ts harden . --pr         # branch + PR via gh
npx tsx src/cli/index.ts harden . --report out.md
```

### Who it is for

- Freelancers preparing client handoff
- Agencies standardizing delivery quality
- Solo founders shipping MVP repos
- Teams making repos agent-ready (build/test/docker)

### What it is not

Not a SAST/SCA scanner (Snyk/Sonar).
Not a full test generator for business logic.
Smoke tests and solid templates — honest about limits.

### Repository

https://github.com/ppiiyo/RepoForge

---

## Short bio

Production-grade repository hardening engine. One command to add CI, tests, Docker, docs, and security baseline — with dry-run, validation, and PR mode.

## Use cases

1. Harden a prototype before client handoff
2. Add CI, tests, and Docker to a repo that only works locally
3. Raise repository quality score with a before/after report
4. Apply a consistent security baseline (Dependabot, SECURITY.md, .gitignore)
5. Open a ready-to-review PR instead of writing files on main

## Demo script (60–90 seconds)

1. Show bare repo: no CI, no tests, low score
2. Run `analyze` → quality ~25–40
3. Run `harden` (dry-run) → list planned files
4. Run `harden --apply` → files appear
5. Run `analyze` again → score jumped
6. Optional: `harden --pr` on a git repo with remote

## Category suggestions

- Developer Tools
- DevOps / CI
- Code Quality
- GitHub / Git

## Screenshots to capture

1. Terminal: `analyze` output with quality score
2. Terminal: dry-run plan (list of paths)
3. Terminal: after `--apply` + higher score
4. Optional: opened GitHub PR from `--pr`

## Listing checklist

- [ ] Title + summary filled
- [ ] SKILL.md attached / linked from repo
- [ ] Price set ($24–29)
- [ ] 2–3 screenshots
- [ ] Link to https://github.com/ppiiyo/RepoForge
- [ ] Clear “not a full security scanner” disclaimer
