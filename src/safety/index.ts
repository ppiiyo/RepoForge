/**
 * SafetyLayer — prevents RepoForge from damaging repositories.
 *
 * Guarantees:
 * - Protected files (.env, keys, credentials) are never modified
 * - No path traversal / absolute paths
 * - Temp-copy simulation of plans before real apply
 * - Optional git snapshot before apply
 * - Rollback via git when snapshot exists
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Hardener, ChangePlan } from '../types/hardener.js'
import type { ProjectModel } from '../types/project-model.js'
import type { SafetyEvaluation, SafetyLayer } from './types.js'
import { simulatePlan } from './simulate.js'

const execFileAsync = promisify(execFile)

const PROTECTED_FILES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'credentials.json',
  'secrets.json',
  'id_rsa',
  'id_ed25519',
  'id_rsa.pub',
  'id_ed25519.pub',
])

const PROTECTED_BASENAME_PATTERNS = [
  /^\.env\./,
  /service-account.*\.json$/i,
  /\.pem$/i,
  /\.p12$/i,
]

async function isGitRepo(rootDir: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: rootDir,
    })
    return true
  } catch {
    return false
  }
}

async function createGitSnapshot(rootDir: string): Promise<string | null> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const branch = `repoforge-snapshot-${stamp}`
    await execFileAsync('git', ['branch', branch], { cwd: rootDir })
    await fs.writeFile(path.join(rootDir, '.repoforge-snapshot'), branch + '\n', 'utf8')
    return branch
  } catch {
    return null
  }
}

export class DefaultSafetyLayer implements SafetyLayer {
  async evaluate(
    hardener: Hardener,
    plan: ChangePlan,
    project: ProjectModel,
    rootDir: string
  ): Promise<SafetyEvaluation> {
    const errors: string[] = []
    const warnings: string[] = []
    const rootResolved = path.resolve(rootDir)

    for (const change of plan.changes) {
      const base = path.basename(change.path)

      if (PROTECTED_FILES.has(base) || PROTECTED_BASENAME_PATTERNS.some((re) => re.test(base))) {
        errors.push(`Refusing to modify protected file: ${change.path}`)
        continue
      }

      if (path.isAbsolute(change.path)) {
        errors.push(`Absolute paths are not allowed: ${change.path}`)
        continue
      }

      const resolved = path.resolve(rootDir, change.path)
      if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
        errors.push(`Path traversal detected: ${change.path}`)
        continue
      }

      if (change.path === '.git' || change.path.startsWith('.git/')) {
        errors.push(`Refusing to modify .git path: ${change.path}`)
        continue
      }

      if (change.content && change.content.length > 500_000) {
        warnings.push(`Large file generated (${change.path}, ${change.content.length} bytes)`)
      }

      if (change.delete) {
        warnings.push(`Plan includes deletion of ${change.path}`)
      }
    }

    if (plan.risk === 'high') {
      warnings.push('Plan is marked as high risk')
    }

    const git = await isGitRepo(rootDir)
    if (!git) {
      warnings.push('Not a git repository — rollback via git snapshot unavailable')
    }

    if (errors.length > 0) {
      return { ok: false, errors, warnings }
    }

    if (plan.changes.length > 0) {
      const sim = await simulatePlan(hardener, plan, project, rootDir)
      if (!sim.ok) {
        errors.push(...sim.errors.map((e) => `[simulate] ${e}`))
      }
      warnings.push(...sim.warnings.map((w) => `[simulate] ${w}`))
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
    }
  }

  async snapshot(rootDir: string): Promise<string | null> {
    if (!(await isGitRepo(rootDir))) return null
    return createGitSnapshot(rootDir)
  }

  async rollback(rootDir: string): Promise<void> {
    const marker = path.join(rootDir, '.repoforge-snapshot')
    try {
      const branch = (await fs.readFile(marker, 'utf8')).trim()
      if (!branch) return
      await execFileAsync('git', ['reset', '--hard', branch], { cwd: rootDir })
      await fs.unlink(marker).catch(() => {})
    } catch {
      // cannot roll back safely
    }
  }
}
