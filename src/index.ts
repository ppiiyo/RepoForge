/**
 * Public API surface of RepoForge.
 */

export { RepoForgeEngine } from './core/engine.js'
export type { EngineOptions, EngineDependencies } from './core/engine.js'

export { DefaultAnalyzer } from './analyzer/index.js'
export type { Analyzer } from './analyzer/types.js'

export { DefaultSafetyLayer } from './safety/index.js'
export type { SafetyLayer, SafetyEvaluation } from './safety/types.js'

export { DocsHardener } from './hardeners/docs-hardener.js'
export { CIHardener } from './hardeners/ci-hardener.js'
export { TestsHardener } from './hardeners/tests-hardener.js'
export { DockerHardener } from './hardeners/docker-hardener.js'
export { SecurityHardener } from './hardeners/security-hardener.js'

export type { ProjectModel, Issue, IssueSeverity } from './types/project-model.js'
export type {
  Hardener,
  HardenerFindings,
  ChangePlan,
  FileChange,
  ApplyContext,
  ApplyResult,
  ValidationResult,
} from './types/hardener.js'
export type { RepoForgeReport, HardenerReport } from './types/report.js'
