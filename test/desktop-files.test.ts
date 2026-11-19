import { readdirSync, readFileSync } from 'node:fs'
import { matchesGlob, join, normalize } from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// The installed app only has what electron-builder's `files` lets in. A local
// module the main process imports but `files` leaves out works with
// `pnpm desktop` and crashes the installed app on start (ERR_MODULE_NOT_FOUND)
const desktop = join(__dirname, '..', 'desktop')
const { files } = createRequire(import.meta.url)(join(desktop, 'electron-builder.config.cjs')) as { files: string[] }

function localImports(file: string): string[] {
  const source = readFileSync(join(desktop, file), 'utf8')
  const found = [...source.matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*|join\(here,\s*)['"](\.{0,2}\/?[\w.-]+\.(?:mjs|cjs|js))['"]/g)].map(match => normalize(match[1]!))
  return found.filter(path => !path.startsWith('..'))
}

describe('the desktop app package', () => {
  it('includes every local module the main process loads', () => {
    const entries = readdirSync(desktop).filter(name => /\.(mjs|cjs)$/.test(name) && name !== 'electron-builder.config.cjs')
    const needed = new Set(entries.flatMap(localImports))
    expect(needed.size).toBeGreaterThan(0)
    for (const path of needed) {
      expect(files.some(pattern => matchesGlob(path, pattern)), `${path} is loaded but not in electron-builder files`).toBe(true)
    }
  })
})
