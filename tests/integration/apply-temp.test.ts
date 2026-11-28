import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { describe, it, expect, afterEach } from 'vitest'
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

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) await copyDir(from, to)
    else await fs.copyFile(from, to)
  }
}

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

describe('apply on temp bare-node', () => {
  let work: string | null = null
  afterEach(async () => {
    if (work) {
      await fs.rm(work, { recursive: true, force: true })
      work = null
    }
  })

  it('writes CI and improves baseline', async () => {
    work = await mkdtemp(path.join(tmpdir(), 'repoforge-'))
    await copyDir(fixture, work)
    const before = await new DefaultAnalyzer().analyze(work)
    expect(before.hasCI).toBe(false)
    const report = await createEngine().run(work, { apply: true, force: true })
    expect(report.fatalErrors).toEqual([])
    expect(report.appliedChangeCount).toBeGreaterThan(0)
    expect(report.hardeners.some((h) => h.status === 'failed')).toBe(false)
    await expect(fs.access(path.join(work, '.github/workflows/ci.yml'))).resolves.toBeUndefined()
    const after = await new DefaultAnalyzer().analyze(work)
    expect(after.hasCI).toBe(true)
    expect(after.qualityScore).toBeGreaterThanOrEqual(before.qualityScore)
    const second = await createEngine().run(work, { apply: false })
    const ciHardener = second.hardeners.find((h) => h.name === 'ci')
    expect(ciHardener?.status === 'skipped' || (ciHardener?.plan?.changes.length ?? 0) === 0).toBe(true)
  }, 60_000)
})
