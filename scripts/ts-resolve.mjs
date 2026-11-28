/**
 * Maps .js import specifiers to sibling .ts files for Node --experimental-strip-types.
 */
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('.') || specifier.startsWith('/')) &&
    specifier.endsWith('.js')
  ) {
    const parent = context.parentURL
      ? fileURLToPath(context.parentURL)
      : process.cwd()
    const parentDir = path.dirname(parent)
    const absJs = path.resolve(parentDir, specifier)
    const absTs = absJs.replace(/\.js$/, '.ts')
    if (existsSync(absTs)) {
      return nextResolve(pathToFileURL(absTs).href, context)
    }
  }
  return nextResolve(specifier, context)
}
