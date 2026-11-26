import { describe, it, expect } from 'vitest'
import {
  createEmptyProjectModel,
  ProjectModelSchema,
} from '../../src/types/project-model.js'

describe('ProjectModel', () => {
  it('createEmptyProjectModel returns a valid shape', () => {
    const model = createEmptyProjectModel('/tmp/demo-repo')
    const parsed = ProjectModelSchema.safeParse(model)
    expect(parsed.success).toBe(true)
    expect(model.rootDir).toBe('/tmp/demo-repo')
    expect(model.qualityScore).toBe(0)
    expect(model.hasTests).toBe(false)
    expect(model.issues).toEqual([])
  })

  it('rejects invalid quality scores', () => {
    const model = createEmptyProjectModel('/tmp/x')
    const bad = { ...model, qualityScore: 150 }
    const parsed = ProjectModelSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })
})
