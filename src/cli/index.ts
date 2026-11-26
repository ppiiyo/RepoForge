#!/usr/bin/env node
/**
 * RepoForge CLI
 *
 * Usage:
 *   repoforge analyze [path]
 *   repoforge harden [path] [--apply] [--pr] [--force]
 */

import { Command } from 'commander'
import path from 'node:path'
import { RepoForgeEngine } from '../core/engine.js'
import { DefaultAnalyzer } from '../analyzer/index.js'
import { DefaultSafetyLayer } from '../safety/index.js'
import { DocsHardener } from '../hardeners/docs-hardener.js'
import { CIHardener } from '../hardeners/ci-hardener.js'
import { TestsHardener } from '../hardeners/tests-hardener.js'
import { DockerHardener } from '../hardeners/docker-hardener.js'
import { SecurityHardener } from '../hardeners/security-hardener.js'
import { renderMarkdownReport } from '../reporter/markdown.js'
import { promises as fs } from 'node:fs'
import type { RepoForgeReport } from '../types/report.js'

const program = new Command()

program
  .name('repoforge')
  .description('Production-grade repository hardening engine')
  .version('0.2.0')

program
  .command('analyze')
  .description('Analyze a repository and print the ProjectModel summary')
  .argument('[path]', 'Path to repository', '.')
  .action(async (targetPath: string) => {
    const rootDir = path.resolve(targetPath)
    const analyzer = new DefaultAnalyzer()
    const model = await analyzer.analyze(rootDir)

    console.log('\nRepoForge Analysis')
    console.log('==================')
    console.log(`Root:        ${model.rootDir}`)
    console.log(`Languages:   ${model.languages.join(', ') || '—'}`)
    console.log(`Frameworks:  ${model.frameworks.join(', ') || '—'}`)
    console.log(`Pkg managers:${model.packageManagers.join(', ') || '—'}`)
    console.log(`Tests:       ${model.hasTests ? `yes (${model.testFileCount} files)` : 'no'}`)
    console.log(`CI:          ${model.hasCI ? model.ciProviders.join(', ') : 'no'}`)
    console.log(`Docker:      ${model.hasDocker ? 'yes' : 'no'}`)
    console.log(`README:      ${model.hasReadme ? 'yes' : 'no'}`)
    console.log(`Quality:     ${model.qualityScore}/100`)
    console.log(`Confidence:  ${(model.confidence * 100).toFixed(0)}%`)
    console.log(`Issues:      ${model.issues.length}`)

    if (model.issues.length) {
      console.log('\nTop issues:')
      for (const issue of model.issues.slice(0, 10)) {
        console.log(`  [${issue.severity}] ${issue.message}`)
      }
    }
    console.log()
  })

program
  .command('harden')
  .description('Run hardening pipeline (dry-run by default)')
  .argument('[path]', 'Path to repository', '.')
  .option('--apply', 'Actually write changes (default is dry-run)', false)
  .option('--pr', 'Apply on a branch, commit, push and open a PR (implies --apply)', false)
  .option('--pr-branch <name>', 'Branch name for --pr mode')
  .option('--force', 'Allow medium/high risk plans without extra confirmation', false)
  .option('--json', 'Output full report as JSON', false)
  .option('--report <path>', 'Write Markdown report to file')
  .action(
    async (
      targetPath: string,
      opts: {
        apply: boolean
        pr: boolean
        prBranch?: string
        force: boolean
        json: boolean
        report?: string
      }
    ) => {
      const rootDir = path.resolve(targetPath)

      const engine = new RepoForgeEngine({
        analyzer: new DefaultAnalyzer(),
        hardeners: [
          new DocsHardener(),
          new CIHardener(),
          new TestsHardener(),
          new DockerHardener(),
          new SecurityHardener(),
        ],
        safety: new DefaultSafetyLayer(),
      })

      const report = await engine.run(rootDir, {
        apply: opts.apply || opts.pr,
        pr: opts.pr,
        prBranch: opts.prBranch,
        force: opts.force,
        onProgress: (msg) => {
          if (!opts.json) console.log(msg)
        },
      })

      if (opts.report) {
        const md = renderMarkdownReport(report)
        await fs.writeFile(path.resolve(opts.report), md, 'utf8')
        if (!opts.json) console.log(`Report written to ${opts.report}`)
      }

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2))
      } else {
        printReport(report)
      }

      process.exit(report.success ? 0 : 1)
    }
  )

function printReport(report: RepoForgeReport) {
  console.log('\n========== RepoForge Report ==========')
  console.log(`Run ID:     ${report.runId}`)
  console.log(`Root:       ${report.rootDir}`)
  console.log(`Success:    ${report.success}`)
  console.log(`Summary:    ${report.summary}`)
  console.log(
    `Quality:    ${report.qualityScoreBefore}/100` +
      (report.qualityScoreAfter != null ? ` → ${report.qualityScoreAfter}/100` : '')
  )
  console.log(`Planned:    ${report.plannedChangeCount} file change(s)`)
  console.log(`Applied:    ${report.appliedChangeCount} file change(s)`)
  if (report.idempotent != null) {
    console.log(`Idempotent: ${report.idempotent ? 'yes' : 'no'}`)
  }
  if (report.prBranch) console.log(`PR branch:  ${report.prBranch}`)
  if (report.prUrl) console.log(`PR URL:     ${report.prUrl}`)
  console.log()

  for (const h of report.hardeners) {
    const icon =
      h.status === 'applied'
        ? '✔'
        : h.status === 'planned'
          ? '○'
          : h.status === 'failed' || h.status === 'rolled_back'
            ? '✖'
            : '·'
    console.log(
      `${icon} ${h.name.padEnd(12)} ${h.status}${h.findingsSummary ? ` — ${h.findingsSummary}` : ''}`
    )
    if (h.plan && h.plan.changes.length) {
      for (const c of h.plan.changes) {
        console.log(`    • ${c.path} — ${c.reason}`)
      }
    }
    if (h.validation?.errors?.length) {
      for (const e of h.validation.errors) {
        console.log(`    ! ${e}`)
      }
    }
  }

  if (report.diagnostics.length) {
    console.log('\nDiagnostics:')
    for (const d of report.diagnostics) console.log(`  - ${d}`)
  }
  if (report.fatalErrors.length) {
    console.log('\nFatal errors:')
    for (const e of report.fatalErrors) console.log(`  - ${e}`)
  }
  console.log('======================================\n')
}

program.parse()
