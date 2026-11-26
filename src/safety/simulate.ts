/**
 * Temp-copy simulation: apply a ChangePlan on an isolated directory,
 * run hardener.validate(), then discard the copy.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { Hardener, ChangePlan, ApplyResult } from '../types/hardener.js'
import type { ProjectModel } from '../types/project-model.js'

export interface SimulationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  applyResult?: ApplyResult
}

export async function simulatePlan(
  hardener: Hardener,
  plan: ChangePlan,
  project: ProjectModel,
  _rootDir: string
): Promise<SimulationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  let tmpDir: string | null = null

  try {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repoforge-sim-'))

    const applyResult = await hardener.apply({
      project,
      plan,
      workDir: tmpDir,
      dryRun: false,
    })

    const validation = await hardener.validate(applyResult, {
      project,
      plan,
      workDir: tmpDir,
      dryRun: false,
    })

    if (!applyResult.success) {
      errors.push(...applyResult.errors)
    }
    if (!validation.ok) {
      errors.push(...validation.errors)
    }
    warnings.push(...validation.warnings)

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      applyResult,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      errors: [`Simulation failed: ${message}`],
      warnings,
    }
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
