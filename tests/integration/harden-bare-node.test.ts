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
const fixture = path.resolve(__dirname, '../golden/bare-node')

describe('harden bare-node fixture (dry-run)', () => {
  it('analyzes and plans multiple hardeners without writing', async () => {
    const engine = new RepoForgeEngine({
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

    const report = await engine.run(fixture, { apply: false })

    expect(report.fatalErrors).toEqual([])
    expect(report.modelBefore.languages.length).toBeGreaterThan(0)
    expect(report.modelBefore.hasTests).toBe(false)
    expect(report.modelBefore.hasCI).toBe(false)
    expect(report.plannedChangeCount).toBeGreaterThan(0)
    expect(report.appliedChangeCount).toBe(0)

    const byName = Object.fromEntries(report.hardeners.map((h) => [h.name, h]))
    expect(byName.ci?.status).toBe('planned')
    expect(byName.tests?.status).toBe('planned')
    expect(byName.docker?.status).toBe('planned')
    expect(byName.security?.supported).toBe(true)

    for (const h of report.hardeners) {
      expect(h.status).not.toBe('failed')
      expect(h.status).not.toBe('rolled_back')
    }
  }, 30_000)
})
