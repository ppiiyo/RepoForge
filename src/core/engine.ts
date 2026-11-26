/**
 * RepoForge Engine — orchestrates the full hardening pipeline.
 * Guarantees: dry-run by default, snapshot safety, validation before accept.
 */

import { randomUUID } from 'node:crypto'
import type { ProjectModel } from '../types/project-model.js'
import type { Hardener, ChangePlan, ApplyResult } from '../types/hardener.js'
import type { RepoForgeReport, HardenerReport } from '../types/report.js'
import type { Analyzer } from '../analyzer/types.js'
import type { SafetyLayer } from '../safety/types.js'

export interface EngineOptions {
  apply?: boolean
  force?: boolean
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

      if (options.apply && this.deps.safety.snapshot) {
        log('Creating safety snapshot…')
        const snap = await this.deps.safety.snapshot(rootDir)
        if (snap) {
          report.diagnostics.push(`Git snapshot created: ${snap}`)
          log(`Snapshot: ${snap}`)
        } else {
          report.diagnostics.push('Could not create git snapshot (not a git repo or git unavailable)')
        }
      }

      for (const hardener of this.deps.hardeners) {
        const hr = await this.runHardener(hardener, model, rootDir, options, log)
        report.hardeners.push(hr)
      }

      const applied = report.hardeners.filter((h) => h.status === 'applied').length
      const failed = report.hardeners.filter((h) => h.status === 'failed').length
      const planned = report.hardeners.filter((h) => h.status === 'planned').length

      report.success = failed === 0
      report.summary = options.apply
        ? `Applied ${applied} hardener(s), ${failed} failed.`
        : `Dry-run complete. ${planned} hardener(s) produced plans. Re-run with --apply to write changes.`

      log(report.summary)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      report.fatalErrors.push(message)
      report.summary = `Fatal error: ${message}`
      log(report.summary)
    } finally {
      report.finishedAt = new Date().toISOString()
    }

    return report
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
        log(`↪ ${hardener.name}: plan ready (${plan.risk} risk, ${plan.changes.length} changes) — confirmation required`)
        hr.status = 'planned'
        return hr
      }

      log(`↪ ${hardener.name}: validating plan…`)
      const safetyResult = await this.deps.safety.evaluate(hardener, plan, model, rootDir)

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
