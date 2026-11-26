import type { Hardener, ChangePlan } from '../types/hardener.js'
import type { ProjectModel } from '../types/project-model.js'

export interface SafetyEvaluation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export interface SafetyLayer {
  evaluate(
    hardener: Hardener,
    plan: ChangePlan,
    project: ProjectModel,
    rootDir: string
  ): Promise<SafetyEvaluation>

  snapshot?(rootDir: string): Promise<string | null>

  rollback(rootDir: string): Promise<void>
}
