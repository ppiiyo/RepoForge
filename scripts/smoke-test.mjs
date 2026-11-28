/**
 * End-to-end smoke tests without vitest.
 * Usage: node --experimental-strip-types --experimental-loader ./scripts/ts-resolve.mjs scripts/smoke-test.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { DefaultAnalyzer } from '../src/analyzer/index.js'
import { RepoForgeEngine } from '../src/core/engine.js'
import { DefaultSafetyLayer } from '../src/safety/index.js'
import { DocsHardener } from '../src/hardeners/docs-hardener.js'
import { CIHardener } from '../src/hardeners/ci-hardener.js'
import { TestsHardener } from '../src/hardeners/tests-hardener.js'
import { DockerHardener } from '../src/hardeners/docker-hardener.js'
import { SecurityHardener } from '../src/hardeners/security-hardener.js'
import {
  createEmptyProjectModel,
  ProjectModelSchema,
} from '../src/types/project-model.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const golden = (name) => path.join(root, 'tests/golden', name)

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✔ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✖ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : err}`)
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

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true })
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) await copyDir(from, to)
    else await fs.copyFile(from, to)
  }
}

console.log('\nRepoForge smoke tests\n')

await test('ProjectModel schema accepts empty model', async () => {
  const m = createEmptyProjectModel('/tmp/x')
  const p = ProjectModelSchema.safeParse(m)
  assert(p.success, 'schema failed')
  assert(m.qualityScore === 0, 'score should be 0')
})

await test('ProjectModel rejects invalid score', async () => {
  const m = { ...createEmptyProjectModel('/tmp/x'), qualityScore: 150 }
  assert(!ProjectModelSchema.safeParse(m).success, 'should reject')
})

await test('analyze bare-node', async () => {
  const m = await new DefaultAnalyzer().analyze(golden('bare-node'))
  assert(m.packageManagers.includes('npm'), 'npm expected')
  assert(!m.hasTests, 'no tests')
  assert(!m.hasCI, 'no ci')
  assert(m.issues.some((i) => i.id === 'no-tests'), 'no-tests issue')
})

await test('analyze bare-python', async () => {
  const m = await new DefaultAnalyzer().analyze(golden('bare-python'))
  assert(m.languages.includes('python'), 'python language')
  assert(m.packageManagers.includes('pip'), 'pip')
})

await test('analyze bare-go', async () => {
  const m = await new DefaultAnalyzer().analyze(golden('bare-go'))
  assert(m.languages.includes('go'), 'go language')
})

await test('safety blocks .env', async () => {
  const safety = new DefaultSafetyLayer()
  const plan = {
    hardenerName: 'stub',
    description: 'bad',
    risk: 'high',
    requiresConfirmation: true,
    changes: [{ path: '.env', content: 'X=1', reason: 'no' }],
  }
  const r = await safety.evaluate(
    { name: 'stub', description: 's' },
    plan,
    createEmptyProjectModel('/tmp/repo'),
    '/tmp/repo'
  )
  assert(!r.ok, 'should block')
})

await test('safety blocks path traversal', async () => {
  const safety = new DefaultSafetyLayer()
  const plan = {
    hardenerName: 'stub',
    description: 'bad',
    risk: 'high',
    requiresConfirmation: true,
    changes: [{ path: '../outside', content: 'x', reason: 'no' }],
  }
  const r = await safety.evaluate(
    { name: 'stub', description: 's' },
    plan,
    createEmptyProjectModel('/tmp/repo'),
    '/tmp/repo'
  )
  assert(!r.ok, 'should block traversal')
})

await test('dry-run bare-node plans hardeners', async () => {
  const report = await createEngine().run(golden('bare-node'), { apply: false })
  assert(report.fatalErrors.length === 0, `fatal: ${report.fatalErrors}`)
  assert(report.appliedChangeCount === 0, 'no writes in dry-run')
  assert(report.plannedChangeCount > 0, 'should plan changes')
  const by = Object.fromEntries(report.hardeners.map((h) => [h.name, h]))
  assert(by.ci?.status === 'planned', 'ci planned')
  assert(by.tests?.status === 'planned', 'tests planned')
  assert(by.docker?.status === 'planned', 'docker planned')
  for (const h of report.hardeners) {
    assert(h.status !== 'failed', `${h.name} failed`)
  }
})

await test('dry-run bare-python plans python CI', async () => {
  const report = await createEngine().run(golden('bare-python'), { apply: false })
  assert(report.fatalErrors.length === 0, 'fatal')
  const ci = report.hardeners.find((h) => h.name === 'ci')
  assert(ci?.status === 'planned', 'ci planned')
  const content = ci?.plan?.changes?.[0]?.content ?? ''
  assert(/python|pytest/i.test(content), 'python workflow')
})

await test('dry-run bare-go plans go CI', async () => {
  const report = await createEngine().run(golden('bare-go'), { apply: false })
  assert(report.fatalErrors.length === 0, 'fatal')
  const ci = report.hardeners.find((h) => h.name === 'ci')
  assert(ci?.status === 'planned', 'ci planned')
  const content = ci?.plan?.changes?.[0]?.content ?? ''
  assert(/setup-go|go test/i.test(content), 'go workflow')
})

await test('apply on temp bare-node writes CI and improves score', async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'repoforge-'))
  try {
    await copyDir(golden('bare-node'), work)
    const before = await new DefaultAnalyzer().analyze(work)
    assert(!before.hasCI, 'before no ci')
    const report = await createEngine().run(work, { apply: true, force: true })
    assert(report.fatalErrors.length === 0, `fatal: ${report.fatalErrors}`)
    assert(report.appliedChangeCount > 0, 'applied > 0')
    assert(!report.hardeners.some((h) => h.status === 'failed'), 'no failed')
    await fs.access(path.join(work, '.github/workflows/ci.yml'))
    const after = await new DefaultAnalyzer().analyze(work)
    assert(after.hasCI, 'after has ci')
    assert(after.qualityScore >= before.qualityScore, 'score not worse')
    const second = await createEngine().run(work, { apply: false })
    const ci = second.hardeners.find((h) => h.name === 'ci')
    assert(
      ci?.status === 'skipped' || (ci?.plan?.changes?.length ?? 0) === 0,
      'ci should be stable on second pass'
    )
    assert(
      second.plannedChangeCount === 0 ||
        second.idempotent === true ||
        second.plannedChangeCount <= 1,
      'second pass nearly idle'
    )
    const secondApply = await createEngine().run(work, { apply: true, force: true })
    assert(secondApply.appliedChangeCount === 0, 'second apply should write nothing')
  } finally {
    await fs.rm(work, { recursive: true, force: true })
  }
})

console.log(`\nResults: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
