import type { ProjectModel } from '../types/project-model.js'

export interface Analyzer {
  analyze(rootDir: string): Promise<ProjectModel>
}
