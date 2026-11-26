/**
 * ProjectModel — the single source of truth produced by the Analyzer.
 */

import { z } from 'zod'

export const IssueSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info'])
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>

export const IssueSchema = z.object({
  id: z.string(),
  severity: IssueSeveritySchema,
  category: z.string(),
  message: z.string(),
  file: z.string().optional(),
  recommendation: z.string().optional(),
})
export type Issue = z.infer<typeof IssueSchema>

export const DependencySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  latest: z.string().optional(),
  ecosystem: z.string().optional(),
})
export type Dependency = z.infer<typeof DependencySchema>

export const SecurityInfoSchema = z.object({
  hasDependabot: z.boolean(),
  hasCodeowners: z.boolean(),
  hasSecurityMd: z.boolean(),
  hasSecretsInCode: z.boolean(),
  secretsFindings: z.array(z.string()).default([]),
  outdatedDependencies: z.array(DependencySchema).default([]),
})
export type SecurityInfo = z.infer<typeof SecurityInfoSchema>

export const StructureInfoSchema = z.object({
  isMonorepo: z.boolean(),
  packageDirs: z.array(z.string()).default([]),
  entrypoints: z.array(z.string()).default([]),
  hasSrcLayout: z.boolean(),
  deadCodeCandidates: z.array(z.string()).default([]),
})
export type StructureInfo = z.infer<typeof StructureInfoSchema>

export const ProjectModelSchema = z.object({
  rootDir: z.string(),
  languages: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  packageManagers: z.array(z.string()).default([]),
  hasTests: z.boolean(),
  testFrameworks: z.array(z.string()).default([]),
  testFileCount: z.number().int().nonnegative().default(0),
  hasCI: z.boolean(),
  ciProviders: z.array(z.string()).default([]),
  hasDocker: z.boolean(),
  hasDockerCompose: z.boolean(),
  hasReadme: z.boolean(),
  hasContributing: z.boolean(),
  hasLicense: z.boolean(),
  hasChangelog: z.boolean(),
  security: SecurityInfoSchema,
  structure: StructureInfoSchema,
  qualityScore: z.number().min(0).max(100),
  issues: z.array(IssueSchema).default([]),
  confidence: z.number().min(0).max(1).default(1),
  analyzedAt: z.string(),
  signals: z.record(z.unknown()).default({}),
})

export type ProjectModel = z.infer<typeof ProjectModelSchema>

export function createEmptyProjectModel(rootDir: string): ProjectModel {
  return {
    rootDir,
    languages: [],
    frameworks: [],
    packageManagers: [],
    hasTests: false,
    testFrameworks: [],
    testFileCount: 0,
    hasCI: false,
    ciProviders: [],
    hasDocker: false,
    hasDockerCompose: false,
    hasReadme: false,
    hasContributing: false,
    hasLicense: false,
    hasChangelog: false,
    security: {
      hasDependabot: false,
      hasCodeowners: false,
      hasSecurityMd: false,
      hasSecretsInCode: false,
      secretsFindings: [],
      outdatedDependencies: [],
    },
    structure: {
      isMonorepo: false,
      packageDirs: [],
      entrypoints: [],
      hasSrcLayout: false,
      deadCodeCandidates: [],
    },
    qualityScore: 0,
    issues: [],
    confidence: 0,
    analyzedAt: new Date().toISOString(),
    signals: {},
  }
}
