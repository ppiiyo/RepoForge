/**
 * Low-level filesystem helpers used by the Analyzer.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { glob } from 'glob'

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function readTextFile(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8')
  } catch {
    return null
  }
}

export async function listFiles(
  rootDir: string,
  patterns: string[],
  ignore: string[] = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/coverage/**']
): Promise<string[]> {
  const results: string[] = []
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: rootDir,
      ignore,
      nodir: true,
      absolute: false,
    })
    results.push(...matches)
  }
  return [...new Set(results)]
}

export async function detectFiles(rootDir: string, names: string[]): Promise<string[]> {
  const found: string[] = []
  for (const name of names) {
    if (await pathExists(path.join(rootDir, name))) {
      found.push(name)
    }
  }
  return found
}

export async function scanForSecretPatterns(rootDir: string): Promise<string[]> {
  const patterns = [
    '**/.env',
    '**/.env.*',
    '**/credentials.json',
    '**/secrets.json',
    '**/*service-account*.json',
    '**/id_rsa',
    '**/id_ed25519',
    '**/*.pem',
  ]

  const pathHits = await listFiles(rootDir, patterns, [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.env.example',
  ])

  const contentTargets = await listFiles(
    rootDir,
    ['**/*.{ts,js,py,go,env,yml,yaml,json,toml}'],
    ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/package-lock.json', '**/pnpm-lock.yaml']
  )

  const contentPatterns: RegExp[] = [
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/,
    /ghp_[A-Za-z0-9]{36,}/,
    /sk-[A-Za-z0-9]{20,}/,
  ]

  const findings = new Set<string>(pathHits)

  for (const rel of contentTargets.slice(0, 200)) {
    const full = path.join(rootDir, rel)
    const text = await readTextFile(full)
    if (!text) continue
    if (text.length > 200_000) continue
    for (const re of contentPatterns) {
      if (re.test(text)) {
        findings.add(rel)
        break
      }
    }
  }

  return [...findings]
}
