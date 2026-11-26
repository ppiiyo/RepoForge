/**
 * Hardener contract — every improvement module must implement this interface.
 * Design goal: isolated, testable, reversible units of work.
 */

import type { ProjectModel } from './project-model.js'

export interface HardenerFindings {
  summary: string
  details: Record<string, unknown>
  addressableIssueIds: string[]
}

export interface FileChange {
  path: string
  content?: string
  delete?: boolean
  reason: string
}

export interface ChangePlan {
  hardenerName: string
  description: string
  changes: FileChange[]
  risk: 'low' | 'medium' | 'high'
  requiresConfirmation: boolean
}

export interface ApplyContext {
  project: ProjectModel
  plan: ChangePlan
  workDir: string
  dryRun: boolean
}

export interface ApplyResult {
  hardenerName: string
  success: boolean
  appliedChanges: FileChange[]
  skippedChanges: FileChange[]
  errors: string[]
  logs: string[]
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export interface Hardener {
  readonly name: string
  readonly description: string
  supports(project: ProjectModel): boolean
  analyze(project: ProjectModel): Promise<HardenerFindings>
  plan(project: ProjectModel, findings: HardenerFindings): Promise<ChangePlan>
  apply(ctx: ApplyContext): Promise<ApplyResult>
  validate(result: ApplyResult, ctx: ApplyContext): Promise<ValidationResult>
}
