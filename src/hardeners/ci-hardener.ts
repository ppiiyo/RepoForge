/**
 * CIHardener — adds a solid GitHub Actions workflow when none exists.
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

function buildGithubActionsWorkflow(model: ProjectModel): string {
  const isNode = model.packageManagers.some((p) =>
    ['npm', 'pnpm', 'yarn', 'bun'].includes(p)
  )

  if (isNode) {
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
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm test --if-present

      - name: Build
        run: npm run build --if-present
`
  }

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

export class CIHardener implements Hardener {
  readonly name = 'ci'
  readonly description = 'Adds GitHub Actions CI workflow when no CI is detected'

  supports(project: ProjectModel): boolean {
    return !project.hasCI
  }

  async analyze(project: ProjectModel): Promise<HardenerFindings> {
    return {
      summary: project.hasCI
        ? 'CI already configured'
        : 'No CI configuration detected',
      details: {
        hasCI: project.hasCI,
        providers: project.ciProviders,
      },
      addressableIssueIds: project.hasCI ? [] : ['no-ci'],
    }
  }

  async plan(project: ProjectModel, _findings: HardenerFindings): Promise<ChangePlan> {
    if (project.hasCI) {
      return {
        hardenerName: this.name,
        description: 'No CI changes needed',
        changes: [],
        risk: 'low',
        requiresConfirmation: false,
      }
    }

    return {
      hardenerName: this.name,
      description: 'Add GitHub Actions CI workflow',
      changes: [
        {
          path: '.github/workflows/ci.yml',
          content: buildGithubActionsWorkflow(project),
          reason: 'Provide baseline CI for lint, test and build',
        },
      ],
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
      if (!change.content) {
        skipped.push(change)
        continue
      }

      const target = path.join(ctx.workDir, change.path)

      if (ctx.dryRun) {
        logs.push(`[dry-run] would write ${change.path}`)
        applied.push(change)
        continue
      }

      try {
        await fs.mkdir(path.dirname(target), { recursive: true })
        try {
          await fs.access(target)
          logs.push(`skip ${change.path}: already exists`)
          skipped.push(change)
          continue
        } catch {
          // does not exist
        }

        await fs.writeFile(target, change.content, 'utf8')
        logs.push(`wrote ${change.path}`)
        applied.push(change)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${change.path}: ${msg}`)
      }
    }

    return {
      hardenerName: this.name,
      success: errors.length === 0,
      appliedChanges: applied,
      skippedChanges: skipped,
      errors,
      logs,
    }
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
        if (!content.includes('runs-on:')) {
          errors.push(`${change.path} does not look like a valid GitHub Actions workflow`)
        }
      } catch {
        errors.push(`${change.path} missing after apply`)
      }
    }

    return { ok: errors.length === 0, errors, warnings }
  }
}
