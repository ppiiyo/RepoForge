/**
 * Report types — machine and human readable output of a RepoForge run.
 */

import type { ProjectModel } from './project-model.js'
import type { ChangePlan, ApplyResult, ValidationResult } from './hardener.js'

export interface HardenerReport {
  name: string
  supported: boolean
  findingsSummary?: string
  plan?: ChangePlan
  applyResult?: ApplyResult
  validation?: ValidationResult
  status: 'skipped' | 'planned' | 'applied' | 'failed' | 'rolled_back'
}

export interface RepoForgeReport {
  runId: string
  startedAt: string
  finishedAt: string
  rootDir: string
  modelBefore: ProjectModel
  modelAfter?: ProjectModel
  qualityScoreBefore: number
  qualityScoreAfter?: number
  hardeners: HardenerReport[]
  success: boolean
  summary: string
  diagnostics: string[]
  fatalErrors: string[]
  plannedChangeCount: number
  appliedChangeCount: number
  idempotent?: boolean
  prBranch?: string
  prUrl?: string
}
