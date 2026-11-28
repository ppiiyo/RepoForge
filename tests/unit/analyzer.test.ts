import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { DefaultAnalyzer } from '../../src/analyzer/index.js'
import { ProjectModelSchema } from '../../src/types/project-model.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const golden = (name: string) => path.resolve(__dirname, '../golden', name)

describe('DefaultAnalyzer', () => {
  it('analyzes bare-node', async () => {
    const model = await new DefaultAnalyzer().analyze(golden('bare-node'))
    const parsed = ProjectModelSchema.safeParse(model)
    expect(parsed.success).toBe(true)
    expect(model.packageManagers).toContain('npm')
    expect(model.hasTests).toBe(false)
    expect(model.hasCI).toBe(false)
    expect(model.qualityScore).toBeGreaterThanOrEqual(0)
    expect(model.qualityScore).toBeLessThanOrEqual(100)
    expect(model.issues.some((i) => i.id === 'no-tests')).toBe(true)
  })

  it('analyzes bare-python', async () => {
    const model = await new DefaultAnalyzer().analyze(golden('bare-python'))
    expect(model.languages).toContain('python')
    expect(model.packageManagers).toContain('pip')
  })

  it('analyzes bare-go', async () => {
    const model = await new DefaultAnalyzer().analyze(golden('bare-go'))
    expect(model.languages).toContain('go')
    expect(model.packageManagers).toContain('go')
  })
})
