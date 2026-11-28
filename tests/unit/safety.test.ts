import { describe, it, expect } from 'vitest'
import { DefaultSafetyLayer } from '../../src/safety/index.js'
import { createEmptyProjectModel } from '../../src/types/project-model.js'
import type { Hardener, ChangePlan } from '../../src/types/hardener.js'

const stubHardener = { name: 'stub', description: 'stub' } as Hardener

describe('DefaultSafetyLayer', () => {
  const safety = new DefaultSafetyLayer()

  it('blocks protected .env paths', async () => {
    const model = createEmptyProjectModel('/tmp/repo')
    const plan: ChangePlan = {
      hardenerName: 'stub',
      description: 'bad',
      risk: 'high',
      requiresConfirmation: true,
      changes: [{ path: '.env', content: 'SECRET=1', reason: 'nope' }],
    }
    const result = await safety.evaluate(stubHardener, plan, model, '/tmp/repo')
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('protected') || e.includes('.env'))).toBe(true)
  })

  it('blocks path traversal', async () => {
    const model = createEmptyProjectModel('/tmp/repo')
    const plan: ChangePlan = {
      hardenerName: 'stub',
      description: 'bad',
      risk: 'high',
      requiresConfirmation: true,
      changes: [{ path: '../outside.txt', content: 'x', reason: 'nope' }],
    }
    const result = await safety.evaluate(stubHardener, plan, model, '/tmp/repo')
    expect(result.ok).toBe(false)
  })

  it('allows normal relative paths', async () => {
    const model = createEmptyProjectModel('/tmp/repo')
    const plan: ChangePlan = {
      hardenerName: 'stub',
      description: 'ok',
      risk: 'low',
      requiresConfirmation: false,
      changes: [{
        path: '.github/workflows/ci.yml',
        content: 'name: CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n',
        reason: 'ci',
      }],
    }
    const result = await safety.evaluate(stubHardener, plan, model, '/tmp/repo')
    expect(result.ok).toBe(true)
  })
})
