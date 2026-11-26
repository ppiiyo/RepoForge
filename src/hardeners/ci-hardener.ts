/**
 * CIHardener — Node, Python, Go, generic GitHub Actions workflows.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  Hardener,
  HardenerFindings,
  ChangePlan,
  ApplyContext,
  ApplyResult,
  ValidationResult,
} from '../types/hardener.js'
import type { ProjectModel } from '../types/project-model.js'

function isNode(model: ProjectModel): boolean {
  return model.packageManagers.some((p) =>
    ['npm', 'pnpm', 'yarn', 'bun'].includes(p)
  ) || model.languages.includes('typescript') || model.languages.includes('javascript')
}

function isPython(model: ProjectModel): boolean {
  return model.languages.includes('python') || model.packageManagers.includes('pip')
}

function isGo(model: ProjectModel): boolean {
  return model.languages.includes('go') || model.packageManagers.includes('go')
}

function buildNodeWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
      - name: Install dependencies
        run: |
          if [ -f package-lock.json ]; then npm ci
          elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile
          elif [ -f yarn.lock ]; then yarn install --frozen-lockfile
          else npm install
          fi
      - name: Lint
        run: npm run lint --if-present
      - name: Test
        run: npm test --if-present
      - name: Build
        run: npm run build --if-present
`
}

function buildPythonWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.12']
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
          if [ -f pyproject.toml ]; then pip install -e \".[dev]\" 2>/dev/null || pip install -e . 2>/dev/null || true; fi
          pip install pytest
      - name: Test
        run: pytest -q
`
}

function buildGoWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - name: Download modules
        run: go mod download
      - name: Vet
        run: go vet ./...
      - name: Test
        run: go test ./...
`
}

function buildGenericWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Placeholder
        run: echo "Add language-specific build/test steps"
`
}

function pickWorkflow(model: ProjectModel): string {
  if (isNode(model)) return buildNodeWorkflow()
  if (isPython(model)) return buildPythonWorkflow()
  if (isGo(model)) return buildGoWorkflow()
  return buildGenericWorkflow()
}

export class CIHardener implements Hardener {
  readonly name = 'ci'
  readonly description = 'Adds GitHub Actions CI workflow when no CI is detected'

  supports(project: ProjectModel): boolean {
    return !project.hasCI
  }

  async analyze(project: ProjectModel): Promise<HardenerFindings> {
    return {
      summary: project.hasCI ? 'CI already configured' : 'No CI configuration detected',
      details: {
        hasCI: project.hasCI,
        providers: project.ciProviders,
        stack: isNode(project) ? 'node' : isPython(project) ? 'python' : isGo(project) ? 'go' : 'generic',
      },
      addressableIssueIds: project.hasCI ? [] : ['no-ci'],
    }
  }

  async plan(project: ProjectModel, _findings: HardenerFindings): Promise<ChangePlan> {
    if (project.hasCI) {
      return { hardenerName: this.name, description: 'No CI changes needed', changes: [], risk: 'low', requiresConfirmation: false }
    }
    return {
      hardenerName: this.name,
      description: 'Add GitHub Actions CI workflow',
      changes: [{ path: '.github/workflows/ci.yml', content: pickWorkflow(project), reason: 'Provide baseline CI for lint, test and build' }],
      risk: 'low',
      requiresConfirmation: false,
    }
  }

  async apply(ctx: ApplyContext): Promise<ApplyResult> {
    const applied = []
    const skipped = []
    const errors: string[] = []
    const logs: string[] = []
    for (const change of ctx.plan.changes) {
      if (!change.content) { skipped.push(change); continue }
      const target = path.join(ctx.workDir, change.path)
      if (ctx.dryRun) { logs.push(`[dry-run] would write ${change.path}`); applied.push(change); continue }
      try {
        await fs.mkdir(path.dirname(target), { recursive: true })
        try { await fs.access(target); logs.push(`skip ${change.path}: already exists`); skipped.push(change); continue } catch { /* ok */ }
        await fs.writeFile(target, change.content, 'utf8')
        logs.push(`wrote ${change.path}`)
        applied.push(change)
      } catch (err) {
        errors.push(`${change.path}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return { hardenerName: this.name, success: errors.length === 0, appliedChanges: applied, skippedChanges: skipped, errors, logs }
  }

  async validate(result: ApplyResult, ctx: ApplyContext): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    if (!result.success) errors.push(...result.errors)
    for (const change of result.appliedChanges) {
      if (ctx.dryRun) continue
      const target = path.join(ctx.workDir, change.path)
      try {
        const content = await fs.readFile(target, 'utf8')
        if (!content.includes('runs-on:')) errors.push(`${change.path} does not look like a valid GitHub Actions workflow`)
      } catch { errors.push(`${change.path} missing after apply`) }
    }
    return { ok: errors.length === 0, errors, warnings }
  }
}
