# RepoForge Architecture

> Reference-grade repository hardening engine.
> Design principle: **never break a repository, always be able to explain and reverse every change**.

## 1. Core Pipeline

```
Ingestion → Analyzer → Planner → Hardener Engine → Safety Layer → Apply → Verify → Report
```

Every stage is explicit, testable and observable.

### Stages

| Stage | Responsibility | Failure Mode |
|-------|----------------|--------------|
| **Ingestion** | Obtain repository (git clone / zip / local path), normalize file tree | Abort with clear error |
| **Analyzer** | Build deterministic `ProjectModel` | Partial model + low confidence score |
| **Planner** | Decide which Hardeners to run and in what order | Empty plan (safe no-op) |
| **Hardener Engine** | Generate changes via independent modules | Module skipped, others continue |
| **Safety Layer** | Simulate, validate, snapshot | Block apply, return diagnostics |
| **Apply** | Write files / create branch / open PR | Rollback to snapshot |
| **Verify** | Post-apply checks | Rollback + report |
| **Report** | Human + machine readable output | Always produced |

## 2. Reliability Contract

1. **No silent mutation** — every change is recorded and explainable.
2. **Snapshot before apply** — git branch or full copy.
3. **Dry-run by default** — real write only with explicit confirmation or `--apply`.
4. **Self-diagnosis** — system can detect its own incorrect assumptions.
5. **Idempotency** — running twice on an already hardened repo produces minimal/no changes.
6. **Conservative when uncertain** — prefer skipping over guessing.

## 3. ProjectModel (Source of Truth)

The Analyzer produces a single structured model that all subsequent stages consume.
No Hardener is allowed to re-parse the repository from scratch for core facts.

See `src/types/project-model.ts`.

## 4. Hardener Contract

Every Hardener must implement:

```ts
interface Hardener {
  readonly name: string
  readonly description: string
  supports(project: ProjectModel): boolean
  analyze(project: ProjectModel): Promise<HardenerFindings>
  plan(project: ProjectModel, findings: HardenerFindings): Promise<ChangePlan>
  apply(ctx: ApplyContext): Promise<ApplyResult>
  validate(result: ApplyResult, ctx: ApplyContext): Promise<ValidationResult>
}
```

If `validate()` fails → changes from that Hardener are discarded.

## 5. Safety Layer

- **Simulation**: apply plan to a temporary copy of the repo.
- **Validation**: syntax, schema, basic executable checks.
- **Self-Diagnosis**: detect conflicting Hardeners, low-confidence analysis, broken invariants.
- **Rollback**: automatic on any post-apply verification failure.

## 6. Extension Points

- New languages → extend Analyzer detectors
- New capabilities → add Hardener modules
- New output formats → extend Reporter

Core pipeline remains stable.

## 7. Non-Goals (v0.1)

- Full language-server level understanding
- Automatic large-scale refactoring
- Guaranteed semantic correctness of generated tests (best-effort + validation)
- Multi-repo / org-level orchestration (later)
