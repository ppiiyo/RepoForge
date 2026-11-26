/**
 * Git helpers for PR mode: branch, commit, push, open PR via `gh` when available.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function run(
  cwd: string,
  cmd: string,
  args: string[]
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    return { ok: true, stdout: stdout.toString().trim(), stderr: stderr.toString().trim() }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      stdout: (e.stdout ?? '').toString().trim(),
      stderr: (e.stderr ?? e.message ?? '').toString().trim(),
    }
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  const r = await run(cwd, 'git', ['rev-parse', '--is-inside-work-tree'])
  return r.ok && r.stdout === 'true'
}

export async function hasGhCli(cwd: string): Promise<boolean> {
  const r = await run(cwd, 'gh', ['--version'])
  return r.ok
}

export async function createWorkingBranch(
  cwd: string,
  branchName: string
): Promise<{ ok: boolean; error?: string }> {
  const checkout = await run(cwd, 'git', ['checkout', '-B', branchName])
  if (!checkout.ok) {
    return { ok: false, error: checkout.stderr || 'failed to create branch' }
  }
  return { ok: true }
}

export async function commitAll(
  cwd: string,
  message: string
): Promise<{ ok: boolean; committed: boolean; error?: string }> {
  const add = await run(cwd, 'git', ['add', '-A'])
  if (!add.ok) return { ok: false, committed: false, error: add.stderr }

  const status = await run(cwd, 'git', ['status', '--porcelain'])
  if (!status.ok) return { ok: false, committed: false, error: status.stderr }
  if (!status.stdout) return { ok: true, committed: false }

  const commit = await run(cwd, 'git', [
    '-c',
    'user.email=repoforge@local',
    '-c',
    'user.name=RepoForge',
    'commit',
    '-m',
    message,
  ])
  if (!commit.ok) return { ok: false, committed: false, error: commit.stderr }
  return { ok: true, committed: true }
}

export async function pushBranch(
  cwd: string,
  branchName: string
): Promise<{ ok: boolean; error?: string }> {
  const r = await run(cwd, 'git', ['push', '-u', 'origin', branchName])
  if (!r.ok) return { ok: false, error: r.stderr || 'git push failed' }
  return { ok: true }
}

export async function createPullRequest(
  cwd: string,
  title: string,
  body: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const r = await run(cwd, 'gh', ['pr', 'create', '--title', title, '--body', body])
  if (!r.ok) return { ok: false, error: r.stderr || 'gh pr create failed' }
  const url = r.stdout.split(/\s+/).find((t) => t.startsWith('http')) ?? r.stdout
  return { ok: true, url: url || undefined }
}

export function defaultPrBranchName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `repoforge/${stamp}`
}
