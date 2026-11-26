/**
 * Default Analyzer implementation.
 * Deterministic first, LLM-assisted signals later.
 */

import path from 'node:path'
import type { Analyzer } from './types.js'
import {
  createEmptyProjectModel,
  type ProjectModel,
  type Issue,
} from '../types/project-model.js'
import { detectFiles, listFiles, pathExists, readTextFile, scanForSecretPatterns } from './filesystem.js'

const TEST_GLOBS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/test_*.py',
  '**/*_test.go',
  '**/tests/**/*.py',
  '**/__tests__/**',
]

const CI_PATHS = [
  '.github/workflows',
  '.gitlab-ci.yml',
  'bitbucket-pipelines.yml',
  'azure-pipelines.yml',
  'Jenkinsfile',
  '.circleci/config.yml',
]

export class DefaultAnalyzer implements Analyzer {
  async analyze(rootDir: string): Promise<ProjectModel> {
    const model = createEmptyProjectModel(path.resolve(rootDir))
    const issues: Issue[] = []
    const signals: Record<string, unknown> = {}

    const pkgJson = await readTextFile(path.join(rootDir, 'package.json'))
    if (pkgJson) {
      model.packageManagers.push('npm')
      model.languages.push('javascript')
      try {
        const pkg = JSON.parse(pkgJson)
        signals.packageJson = {
          name: pkg.name,
          scripts: Object.keys(pkg.scripts ?? {}),
          dependencies: Object.keys(pkg.dependencies ?? {}),
          devDependencies: Object.keys(pkg.devDependencies ?? {}),
        }
        if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) {
          model.languages.push('typescript')
        }
        if (pkg.dependencies?.react || pkg.devDependencies?.react) {
          model.frameworks.push('react')
        }
        if (pkg.dependencies?.next || pkg.devDependencies?.next) {
          model.frameworks.push('next')
        }
        if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
          model.frameworks.push('vue')
        }
      } catch {
        issues.push({
          id: 'pkg-json-parse',
          severity: 'medium',
          category: 'structure',
          message: 'package.json exists but is not valid JSON',
        })
      }
    }

    if (await pathExists(path.join(rootDir, 'pnpm-lock.yaml'))) {
      model.packageManagers.push('pnpm')
    }
    if (await pathExists(path.join(rootDir, 'yarn.lock'))) {
      model.packageManagers.push('yarn')
    }
    if (await pathExists(path.join(rootDir, 'bun.lockb'))) {
      model.packageManagers.push('bun')
    }
    if (await pathExists(path.join(rootDir, 'requirements.txt')) ||
        await pathExists(path.join(rootDir, 'pyproject.toml'))) {
      model.languages.push('python')
      model.packageManagers.push('pip')
    }
    if (await pathExists(path.join(rootDir, 'go.mod'))) {
      model.languages.push('go')
      model.packageManagers.push('go')
    }
    if (await pathExists(path.join(rootDir, 'Cargo.toml'))) {
      model.languages.push('rust')
      model.packageManagers.push('cargo')
    }

    model.languages = [...new Set(model.languages)]
    model.packageManagers = [...new Set(model.packageManagers)]
    model.frameworks = [...new Set(model.frameworks)]

    const testFiles = await listFiles(rootDir, TEST_GLOBS)
    model.testFileCount = testFiles.length
    model.hasTests = testFiles.length > 0
    signals.testFiles = testFiles.slice(0, 30)

    if (pkgJson) {
      try {
        const pkg = JSON.parse(pkgJson)
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (allDeps.vitest) model.testFrameworks.push('vitest')
        if (allDeps.jest) model.testFrameworks.push('jest')
        if (allDeps.mocha) model.testFrameworks.push('mocha')
        if (allDeps.pytest) model.testFrameworks.push('pytest')
      } catch { /* already handled */ }
    }

    if (!model.hasTests) {
      issues.push({
        id: 'no-tests',
        severity: 'high',
        category: 'testing',
        message: 'No test files detected',
        recommendation: 'Add at least basic unit tests for core modules',
      })
    }

    for (const ciPath of CI_PATHS) {
      if (await pathExists(path.join(rootDir, ciPath))) {
        model.hasCI = true
        if (ciPath.startsWith('.github')) model.ciProviders.push('github-actions')
        else if (ciPath.includes('gitlab')) model.ciProviders.push('gitlab-ci')
        else if (ciPath.includes('circle')) model.ciProviders.push('circleci')
        else model.ciProviders.push(ciPath)
      }
    }
    model.ciProviders = [...new Set(model.ciProviders)]

    if (!model.hasCI) {
      issues.push({
        id: 'no-ci',
        severity: 'high',
        category: 'ci',
        message: 'No CI configuration detected',
        recommendation: 'Add GitHub Actions (or equivalent) for lint, test and build',
      })
    }

    model.hasDocker = await pathExists(path.join(rootDir, 'Dockerfile'))
    model.hasDockerCompose =
      (await pathExists(path.join(rootDir, 'docker-compose.yml'))) ||
      (await pathExists(path.join(rootDir, 'docker-compose.yaml')))

    if (!model.hasDocker && model.languages.length > 0) {
      issues.push({
        id: 'no-docker',
        severity: 'medium',
        category: 'packaging',
        message: 'No Dockerfile found',
        recommendation: 'Add a multi-stage Dockerfile for reproducible builds',
      })
    }

    model.hasReadme = await pathExists(path.join(rootDir, 'README.md'))
    model.hasContributing = await pathExists(path.join(rootDir, 'CONTRIBUTING.md'))
    model.hasLicense =
      (await pathExists(path.join(rootDir, 'LICENSE'))) ||
      (await pathExists(path.join(rootDir, 'LICENSE.md')))
    model.hasChangelog =
      (await pathExists(path.join(rootDir, 'CHANGELOG.md'))) ||
      (await pathExists(path.join(rootDir, 'CHANGES.md')))

    if (!model.hasReadme) {
      issues.push({
        id: 'no-readme',
        severity: 'high',
        category: 'documentation',
        message: 'No README.md found',
        recommendation: 'Add a README with purpose, quick start, and usage',
      })
    }
    if (!model.hasLicense) {
      issues.push({
        id: 'no-license',
        severity: 'medium',
        category: 'documentation',
        message: 'No LICENSE file found',
      })
    }

    model.security.hasDependabot =
      (await pathExists(path.join(rootDir, '.github/dependabot.yml'))) ||
      (await pathExists(path.join(rootDir, '.github/dependabot.yaml')))
    model.security.hasCodeowners = await pathExists(path.join(rootDir, 'CODEOWNERS')) ||
      await pathExists(path.join(rootDir, '.github/CODEOWNERS'))
    model.security.hasSecurityMd = await pathExists(path.join(rootDir, 'SECURITY.md'))

    if (!model.security.hasDependabot && model.packageManagers.includes('npm')) {
      issues.push({
        id: 'no-dependabot',
        severity: 'medium',
        category: 'security',
        message: 'Dependabot is not configured',
        recommendation: 'Add .github/dependabot.yml for automated dependency updates',
      })
    }

    const secretFindings = await scanForSecretPatterns(rootDir)
    if (secretFindings.length > 0) {
      model.security.hasSecretsInCode = true
      model.security.secretsFindings = secretFindings
      issues.push({
        id: 'possible-secrets',
        severity: 'critical',
        category: 'security',
        message: `Possible secrets detected in ${secretFindings.length} location(s)`,
        recommendation: 'Remove secrets from the repo, rotate credentials, add patterns to .gitignore',
      })
    }

    model.structure.hasSrcLayout = await pathExists(path.join(rootDir, 'src'))
    const pkgDirs = await detectFiles(rootDir, ['packages', 'apps', 'services'])
    model.structure.isMonorepo = pkgDirs.length > 0
    model.structure.packageDirs = pkgDirs

    let score = 0
    if (model.hasReadme) score += 15
    if (model.hasLicense) score += 10
    if (model.hasTests) score += 25
    if (model.hasCI) score += 20
    if (model.hasDocker) score += 10
    if (model.security.hasDependabot) score += 10
    if (model.hasContributing) score += 5
    if (model.security.hasSecurityMd) score += 5
    model.qualityScore = Math.min(100, score)

    let confidence = 0.5
    if (model.languages.length > 0) confidence += 0.2
    if (model.packageManagers.length > 0) confidence += 0.15
    if (pkgJson || model.languages.includes('python') || model.languages.includes('go')) {
      confidence += 0.15
    }
    model.confidence = Math.min(1, confidence)

    model.issues = issues
    model.signals = signals
    model.analyzedAt = new Date().toISOString()

    return model
  }
}
