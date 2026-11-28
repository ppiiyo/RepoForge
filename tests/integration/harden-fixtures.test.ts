import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { RepoForgeEngine } from '../../src/core/engine.js'
import { DefaultAnalyzer } from '../../src/analyzer/index.js'
import { DefaultSafetyLayer } from '../../src/safety/index.js'
import { DocsHardener } from '../../src/hardeners/docs-hardener.js'
import { CIHardener } from '../../src/hardeners/ci-hardener.js'
import { TestsHardener } from '../../src/hardeners/tests-hardener.js'
import { DockerHardener } from '../../src/hardeners/docker-hardener.js'
import { SecurityHardener } from '../../src/hardeners/security-hardener.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const golden = (name: string) => path.resolve(__dirname, '../golden', name)

function createEngine() {
  return new RepoForgeEngine({
    analyzer: new DefaultAnalyzer(),
    hardeners: [
      new DocsHardener(),
      new CIHardener(),
      new TestsHardener(),
      new DockerHardener(),
      new SecurityHardener(),
    ],
    safety: new DefaultSafetyLayer(),
  })
}

describe('golden fixtures (dry-run)', () => {
  it('bare-node: plans CI, tests, docker, security', async () => {
    const report = await createEngine().run(golden('bare-node'), { apply: false })
    expect(report.fatalErrors).toEqual([])
    expect(report.success).toBe(true)
    expect(report.appliedChangeCount).toBe(0)
    expect(report.plannedChangeCount).toBeGreaterThan(0)
    expect(report.modelBefore.hasTests).toBe(false)
    expect(report.modelBefore.hasCI).toBe(false)
    expect(report.modelBefore.packageManagers).toContain('npm')
    const byName = Object.fromEntries(report.hardeners.map((h) => [h.name, h]))
    expect(byName.ci?.status).toBe('planned')
    expect(byName.tests?.status).toBe('planned')
    expect(byName.docker?.status).toBe('planned')
    for (const h of report.hardeners) {
      expect(h.status).not.toBe('failed')
      expect(h.status).not.toBe('rolled_back')
    }
  })

  it('bare-python: detects python and plans CI + tests', async () => {
    const report = await createEngine().run(golden('bare-python'), { apply: false })
    expect(report.fatalErrors).toEqual([])
    expect(report.modelBefore.languages).toContain('python')
    expect(report.modelBefore.hasCI).toBe(false)
    expect(report.modelBefore.hasTests).toBe(false)
    const byName = Object.fromEntries(report.hardeners.map((h) => [h.name, h]))
    expect(byName.ci?.status).toBe('planned')
    expect(byName.tests?.status).toBe('planned')
    expect(byName.ci?.plan?.changes[0]?.content).toMatch(/python|pytest/i)
  })

  it('bare-go: detects go and plans CI', async () => {
    const report = await createEngine().run(golden('bare-go'), { apply: false })
    expect(report.fatalErrors).toEqual([])
    expect(report.modelBefore.languages).toContain('go')
    expect(report.modelBefore.hasCI).toBe(false)
    const byName = Object.fromEntries(report.hardeners.map((h) => [h.name, h]))
    expect(byName.ci?.status).toBe('planned')
    expect(byName.ci?.plan?.changes[0]?.content).toMatch(/setup-go|go test/i)
  })
})
