/**
 * RepoForge Engine — orchestrates the full hardening pipeline.
 * Guarantees: dry-run by default, snapshot safety, validation, optional PR mode.
 */

import { randomUUID } from 'node:crypto'
import type { ProjectModel } from '../types/project-model.js'
import type { Hardener } from '../types/hardener.js'
import type { RepoForgeReport, HardenerReport } from '../types/report.js'
import type { Analyzer } from '../analyzer/types.js'
import type { SafetyLayer } from '../safety/types.js'
import {
  isGitRepo,
  hasGhCli,
  createWorkingBranch,
  commitAll,
  pushBranch,
  createPullRequest,
  defaultPrBranchName,
} from '../git/pr.js'

export interface EngineOptions {
  apply?: boolean
  force?: boolean
  pr?: boolean
  prBranch?: string
  onProgress?: (message: string) => void
}

export interface EngineDependencies {
  analyzer: Analyzer
  hardeners: Hardener[]
  safety: SafetyLayer
}

export class RepoForgeEngine {
  constructor(private readonly deps: EngineDependencies) {}

  async run(rootDir: string, options: EngineOptions = {}): Promise<RepoForgeReport> {
    const runId = randomUUID()
    const startedAt = new Date().toISOString()
    const log = (msg: string) => options.onProgress?.(msg)

    const wantPr = Boolean(options.pr)
    const wantApply = Boolean(options.apply) || wantPr

    const report: RepoForgeReport = {
      runId,
      startedAt,
      finishedAt: '',
      rootDir,
      modelBefore: null as unknown as ProjectModel,
      qualityScoreBefore: 0,
      hardeners: [],
      success: false,
      summary: '',
      diagnostics: [],
      fatalErrors: [],
      plannedChangeCount: 0,
      appliedChangeCount: 0,
    }

    try {
      log('Analyzing repository…')
      const model = await this.deps.analyzer.analyze(rootDir)
      report.modelBefore = model
      report.qualityScoreBefore = model.qualityScore

      if (model.confidence < 0.4) {
        report.diagnostics.push(
          `Low analyzer confidence (${model.confidence.toFixed(2)}). Running in conservative mode.`
        )
      }

      if (wantPr) {
        const git = await isGitRepo(rootDir)
        if (!git) {
          report.fatalErrors.push('PR mode requires a git repository')
          report.summary = 'Fatal: not a git repository'
          return this.finish(report)
        }
        const branch = options.prBranch?.trim() || defaultPrBranchName()
        log(`Creating branch ${branch}…`)
        const br = await createWorkingBranch(rootDir, branch)
        if (!br.ok) {
          report.fatalErrors.push(br.error || 'failed to create branch')
          report.summary = `Fatal: ${br.error}`
          return this.finish(report)
        }
        report.prBranch = branch
        report.diagnostics.push(`Working branch: ${branch}`)
      }

      if (wantApply && this.deps.safety.snapshot && !wantPr) {
        log('Creating safety snapshot…')
        const snap = await this.deps.safety.snapshot(rootDir)
        if (snap) {
          report.diagnostics.push(`Git snapshot created: ${snap}`)
          log(`Snapshot: ${snap}`)
        } else {
          report.diagnostics.push(
            'Could not create git snapshot (not a git repo or git unavailable)'
          )
        }
      }

      for (const hardener of this.deps.hardeners) {
        const hr = await this.runHardener(
          hardener,
          model,
          rootDir,
          { ...options, apply: wantApply },
          log
        )
        report.hardeners.push(hr)
        if (hr.plan?.changes?.length) {
          report.plannedChangeCount += hr.plan.changes.length
        }
        if (hr.applyResult?.appliedChanges?.length) {
          report.appliedChangeCount += hr.applyResult.appliedChanges.length
        }
      }

      if (wantApply && report.hardeners.some((h) => h.status === 'applied')) {
        log('Re-analyzing after apply…')
        try {
          const after = await this.deps.analyzer.analyze(rootDir)
          report.modelAfter = after
          report.qualityScoreAfter = after.qualityScore
          report.diagnostics.push(
            `Quality score: ${report.qualityScoreBefore} → ${after.qualityScore}`
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          report.diagnostics.push(`Post-apply re-analysis failed: ${msg}`)
        }
      }

      if (wantApply) {
        try {
          const probe = await this.probeIdempotent(rootDir)
          report.idempotent = probe
          report.diagnostics.push(
            probe
              ? 'Idempotency check: second plan is empty (stable)'
              : 'Idempotency check: further changes still planned (may need second pass)'
          )
        } catch {
          // non-fatal
        }
      } else {
        report.idempotent = report.plannedChangeCount === 0
      }

      if (wantPr && report.appliedChangeCount > 0 && report.prBranch) {
        await this.finalizePr(rootDir, report, log)
      } else if (wantPr && report.appliedChangeCount === 0) {
        report.diagnostics.push('PR mode: no files applied — PR not opened')
      }

      const applied = report.hardeners.filter((h) => h.status === 'applied').length
      const failed = report.hardeners.filter((h) => h.status === 'failed').length
      const planned = report.hardeners.filter((h) => h.status === 'planned').length

      report.success = failed === 0 && report.fatalErrors.length === 0

      if (wantPr) {
        report.summary = report.prUrl
          ? `PR opened with ${report.appliedChangeCount} change(s): ${report.prUrl}`
          : `PR mode finished. Applied ${report.appliedChangeCount} change(s)` +
            (report.prBranch ? ` on ${report.prBranch}` : '') +
            (failed ? `, ${failed} hardener(s) failed` : '')
      } else if (wantApply) {
        report.summary = `Applied ${applied} hardener(s), ${report.appliedChangeCount} file change(s), ${failed} failed.`
        if (report.qualityScoreAfter != null) {
          report.summary += ` Quality ${report.qualityScoreBefore}→${report.qualityScoreAfter}.`
        }
      } else {
        report.summary = `Dry-run complete. ${planned} hardener(s) planned ${report.plannedChangeCount} change(s). Re-run with --apply or --pr.`
      }

      log(report.summary)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      report.fatalErrors.push(message)
      report.summary = `Fatal error: ${message}`
      log(report.summary)
    }

    return this.finish(report)
  }

  private finish(report: RepoForgeReport): RepoForgeReport {
    report.finishedAt = new Date().toISOString()
    return report
  }

  private async probeIdempotent(rootDir: string): Promise<boolean> {
    const model = await this.deps.analyzer.analyze(rootDir)
    for (const hardener of this.deps.hardeners) {
      if (!hardener.supports(model)) continue
      const findings = await hardener.analyze(model)
      const plan = await hardener.plan(model, findings)
      if (plan.changes.length > 0) return false
    }
    return true
  }

  private async finalizePr(
    rootDir: string,
    report: RepoForgeReport,
    log: (msg: string) => void
  ): Promise<void> {
    const branch = report.prBranch!
    log('Committing changes…')
    const commit = await commitAll(
      rootDir,
      `chore: harden repository with RepoForge\n\nRun ${report.runId}\nQuality ${report.qualityScoreBefore} → ${report.qualityScoreAfter ?? report.qualityScoreBefore}`
    )
    if (!commit.ok) {
      report.diagnostics.push(`git commit failed: ${commit.error}`)
      return
    }
    if (!commit.committed) {
      report.diagnostics.push('Nothing to commit for PR')
      return
    }

    log(`Pushing ${branch}…`)
    const push = await pushBranch(rootDir, branch)
    if (!push.ok) {
      report.diagnostics.push(
        `git push failed: ${push.error}. Branch ${branch} is local — push manually and open a PR.`
      )
      return
    }

    if (!(await hasGhCli(rootDir))) {
      report.diagnostics.push(
        'gh CLI not found — branch pushed; open a PR manually on GitHub'
      )
      return
    }

    log('Opening pull request…')
    const body = [
      '## RepoForge hardening',
      '',
      report.summary,
      '',
      `Quality score: **${report.qualityScoreBefore}** → **${report.qualityScoreAfter ?? 'n/a'}**`,
      '',
      '### Hardeners',
      ...report.hardeners.map(
        (h) =>
          `- **${h.name}**: ${h.status}${h.findingsSummary ? ` — ${h.findingsSummary}` : ''}`
      ),
      '',
      '_Generated by [RepoForge](https://github.com/ppiiyo/RepoForge)_',
    ].join('\n')

    const pr = await createPullRequest(
      rootDir,
      'chore: harden repository (RepoForge)',
      body
    )
    if (pr.ok && pr.url) {
      report.prUrl = pr.url
      log(`PR: ${pr.url}`)
    } else {
      report.diagnostics.push(`gh pr create failed: ${pr.error}`)
    }
  }

  private async runHardener(
    hardener: Hardener,
    model: ProjectModel,
    rootDir: string,
    options: EngineOptions,
    log: (msg: string) => void
  ): Promise<HardenerReport> {
    const hr: HardenerReport = {
      name: hardener.name,
      supported: false,
      status: 'skipped',
    }

    if (!hardener.supports(model)) {
      log(`↪ ${hardener.name}: not applicable, skipped`)
      return hr
    }
    hr.supported = true

    try {
      const findings = await hardener.analyze(model)
      hr.findingsSummary = findings.summary

      const plan = await hardener.plan(model, findings)
      hr.plan = plan

      if (plan.changes.length === 0) {
        log(`↪ ${hardener.name}: nothing to do`)
        hr.status = 'skipped'
        return hr
      }

      if (plan.requiresConfirmation && !options.force && !options.apply) {
        log(
          `↪ ${hardener.name}: plan ready (${plan.risk} risk, ${plan.changes.length} changes) — confirmation required`
        )
        hr.status = 'planned'
        return hr
      }

      log(`↪ ${hardener.name}: validating plan…`)
      const safetyResult = await this.deps.safety.evaluate(
        hardener,
        plan,
        model,
        rootDir
      )

      if (!safetyResult.ok) {
        hr.status = 'failed'
        hr.validation = {
          ok: false,
          errors: safetyResult.errors,
          warnings: safetyResult.warnings,
        }
        log(`✖ ${hardener.name}: safety checks failed`)
        return hr
      }

      if (!options.apply) {
        hr.status = 'planned'
        log(`✔ ${hardener.name}: plan validated (dry-run)`)
        return hr
      }

      log(`↪ ${hardener.name}: applying…`)
      const applyResult = await hardener.apply({
        project: model,
        plan,
        workDir: rootDir,
        dryRun: false,
      })
      hr.applyResult = applyResult

      const validation = await hardener.validate(applyResult, {
        project: model,
        plan,
        workDir: rootDir,
        dryRun: false,
      })
      hr.validation = validation

      if (!validation.ok || !applyResult.success) {
        await this.deps.safety.rollback(rootDir)
        hr.status = 'rolled_back'
        log(`✖ ${hardener.name}: apply/validation failed — rolled back`)
        return hr
      }

      hr.status = 'applied'
      log(`✔ ${hardener.name}: applied ${applyResult.appliedChanges.length} change(s)`)
      return hr
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      hr.status = 'failed'
      hr.validation = { ok: false, errors: [message], warnings: [] }
      log(`✖ ${hardener.name}: ${message}`)
      return hr
    }
  }
}
