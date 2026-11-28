/**
 * DocsHardener — ensures essential documentation exists and meets a minimum bar.
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

function buildReadme(model: ProjectModel): string {
  const name = path.basename(model.rootDir)
  const langs = model.languages.length ? model.languages.join(', ') : 'unknown'
  const frameworks = model.frameworks.length ? model.frameworks.join(', ') : '—'

  return `# ${name}

> Generated/updated by RepoForge

## Overview

Short description of what this project does.

## Tech Stack

- Languages: ${langs}
- Frameworks: ${frameworks}
- Package managers: ${model.packageManagers.join(', ') || '—'}

## Quick Start

\`\`\`bash
# Install dependencies
# (adjust to your package manager)

# Run
\`\`\`

## Development

\`\`\`bash
# Lint / test / build commands
\`\`\`

## License

See LICENSE file.
`
}

function buildSecurityMd(): string {
  return `# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities privately.

- Open a private security advisory on GitHub, or
- Contact the maintainers directly.

Do not open public issues for security reports.
`
}

function buildContributing(): string {
  return `# Contributing

Thank you for your interest in contributing.

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies
4. Create a feature branch
5. Make changes + add tests
6. Open a Pull Request

## Guidelines

- Keep changes focused
- Write clear commit messages
- Ensure CI passes
`
}

export class DocsHardener implements Hardener {
  readonly name = 'docs'
  readonly description = 'Ensures README, SECURITY.md and CONTRIBUTING.md exist with a solid baseline'

  supports(_project: ProjectModel): boolean {
    return true
  }

  async analyze(project: ProjectModel): Promise<HardenerFindings> {
    const missing: string[] = []
    if (!project.hasReadme) missing.push('README.md')
    if (!project.hasContributing) missing.push('CONTRIBUTING.md')
    if (!project.security.hasSecurityMd) missing.push('SECURITY.md')

    return {
      summary: missing.length
        ? `Missing documentation: ${missing.join(', ')}`
        : 'Core documentation files present',
      details: { missing },
      addressableIssueIds: ['no-readme', 'no-license'].filter((id) =>
        project.issues.some((i) => i.id === id)
      ),
    }
  }

  async plan(project: ProjectModel, findings: HardenerFindings): Promise<ChangePlan> {
    const missing = (findings.details.missing as string[]) ?? []
    const changes = []

    if (missing.includes('README.md')) {
      changes.push({
        path: 'README.md',
        content: buildReadme(project),
        reason: 'Create baseline README so newcomers understand the project',
      })
    }
    if (missing.includes('SECURITY.md')) {
      changes.push({
        path: 'SECURITY.md',
        content: buildSecurityMd(),
        reason: 'Add security policy for responsible disclosure',
      })
    }
    if (missing.includes('CONTRIBUTING.md')) {
      changes.push({
        path: 'CONTRIBUTING.md',
        content: buildContributing(),
        reason: 'Add contributing guidelines',
      })
    }

    return {
      hardenerName: this.name,
      description: 'Add missing core documentation files',
      changes,
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
      if (change.delete || !change.content) {
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
          const existing = await fs.readFile(target, 'utf8')
          if (existing.trim().length > 0 && change.path === 'README.md') {
            logs.push(`skip ${change.path}: already exists and is non-empty`)
            skipped.push(change)
            continue
          }
        } catch {
          // file does not exist
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

    if (!result.success) {
      errors.push(...result.errors)
    }

    for (const change of result.appliedChanges) {
      if (ctx.dryRun) continue
      const target = path.join(ctx.workDir, change.path)
      try {
        const content = await fs.readFile(target, 'utf8')
        if (content.trim().length < 20) {
          errors.push(`${change.path} is too short after write`)
        }
      } catch {
        errors.push(`${change.path} was not found after apply`)
      }
    }

    return { ok: errors.length === 0, errors, warnings }
  }
}
