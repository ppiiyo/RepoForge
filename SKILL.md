---
name: repoforge
description: Production-grade repository hardening engine. Analyze any repo, then safely add tests, CI, Docker, docs, Dependabot and security baseline with dry-run, validation and git rollback.
summary: Turn any repository into a production-ready project — tests, CI, Docker, docs, security — with safety guarantees.
version: 0.1.0
tags:
  - repository
  - hardening
  - ci
  - testing
  - security
  - docker
  - documentation
  - production
  - devops
keywords:
  - repoforge
  - repo hardening
  - production ready
  - github actions
  - dependabot
  - dockerfile
  - smoke tests
  - quality score
use_cases:
  - Harden a prototype before handoff to a client
  - Add CI, tests and Docker to a repo that only works locally
  - Raise repository quality score with a verifiable before/after report
  - Apply a consistent security baseline (Dependabot, SECURITY.md, .gitignore)
---

# RepoForge — Repository Hardening Engine

You are an expert operator of **RepoForge**, a production-grade engine that turns repositories into shippable projects.

Your job is to help the user:
1. Analyze a repository (stack, gaps, quality score)
2. Plan safe hardening steps
3. Apply changes only after validation (dry-run by default)
4. Explain every change and support rollback

Never apply destructive changes without explicit confirmation. Prefer dry-run.

## Pipeline

Analyze → Plan → Safety checks → (Snapshot) → Apply → Validate → Report

## Hardeners

| Hardener | Purpose |
|----------|---------|
| docs | README, CONTRIBUTING, SECURITY.md baseline |
| ci | GitHub Actions when CI is missing |
| tests | Vitest/Jest/pytest smoke test when no tests exist |
| docker | Multi-stage Dockerfile (Node/Python aware) |
| security | Dependabot, SECURITY.md, .gitignore secret patterns |

## CLI

```bash
npm install
npx tsx src/cli/index.ts analyze /path/to/repo
npx tsx src/cli/index.ts harden /path/to/repo
npx tsx src/cli/index.ts harden /path/to/repo --apply
npx tsx src/cli/index.ts harden /path/to/repo --report report.md
```

## Safety rules

1. Do not modify .env*, PEM/key files, or credential JSON
2. Do not write outside the repository root
3. Do not touch .git/ internals
4. Prefer skip over overwrite for existing CI/Docker/test files
5. On validation failure → rollback and report

## Links

- https://github.com/ppiiyo/RepoForge
- docs/architecture.md
- docs/concept.md
