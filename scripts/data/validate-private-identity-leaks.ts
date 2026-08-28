import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { fetchSecCompanyTickers, resolveSecCikForTicker } from './providers/sec-edgar'
import { loadMarketSourceMap } from './source-map'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SOURCE_MAP_PATH = process.env.MARKET_SOURCE_MAP_PATH ?? join(ROOT, '.private', 'market-source-map.json')
const CACHE_ROOT = join(ROOT, '.cache', 'market-data')
const SEC_USER_AGENT = process.env.SEC_USER_AGENT?.trim() || 'StockLab private-identity validator (+https://github.com/stafor94/StockLab)'
const EXCLUDED_DIRS = new Set(['.git', '.private', '.cache', 'node_modules', 'dist', 'playwright-report', 'test-results'])
const TEXT_EXTENSIONS = new Set(['.json', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md', '.yml', '.yaml', '.html', '.css'])
const BANNED_PUBLIC_IDENTITY_KEYS = new Set(['ticker', 'symbol', 'isin', 'cik'])

interface SensitiveToken {
  value: string
  scanTrackedText: boolean
}

function extension(path: string): string {
  const slash = path.lastIndexOf('/')
  const dot = path.lastIndexOf('.')
  return dot > slash ? path.slice(dot) : ''
}

async function trackedTextFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue
    const path = join(dir, entry)
    const info = await stat(path)
    if (info.isDirectory()) files.push(...await trackedTextFiles(path))
    else if (TEXT_EXTENSIONS.has(extension(path))) files.push(path)
  }
  return files
}

function assertPublicJsonClean(value: unknown, path: string, sensitiveValues: ReadonlySet<string>): void {
  if (typeof value === 'string') {
    if (sensitiveValues.has(value)) throw new Error(`${path}: private market identity leaked into public JSON`)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) assertPublicJsonClean(item, path, sensitiveValues)
    return
  }
  if (typeof value !== 'object' || value === null) return
  for (const [key, child] of Object.entries(value)) {
    if (BANNED_PUBLIC_IDENTITY_KEYS.has(key.toLowerCase())) {
      throw new Error(`${path}: public JSON contains a forbidden private-identity field`)
    }
    assertPublicJsonClean(child, path, sensitiveValues)
  }
}

function containsTrackedToken(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`).test(text)
}

async function main(): Promise<void> {
  const sourceMap = await loadMarketSourceMap(SOURCE_MAP_PATH, true)
  const sensitive = new Map<string, SensitiveToken>()
  for (const source of sourceMap.assets.values()) {
    const alphabeticSymbol = source.provider === 'NASDAQ' && /^[A-Za-z]+$/.test(source.symbol)
    sensitive.set(source.symbol, { value: source.symbol, scanTrackedText: alphabeticSymbol && source.symbol.length >= 3 })
    if (source.provider === 'KRX' && source.isin) sensitive.set(source.isin, { value: source.isin, scanTrackedText: true })
  }

  const secTickers = await fetchSecCompanyTickers({
    cacheRoot: CACHE_ROOT,
    force: false,
    delayMs: 0,
    userAgent: SEC_USER_AGENT,
  })
  for (const asset of ASSET_CATALOG.filter((item) => item.market === 'US' && item.kind === 'stock')) {
    const source = sourceMap.assets.get(asset.id)
    if (!source || source.provider !== 'NASDAQ') continue
    const cik = String(resolveSecCikForTicker(secTickers, source.symbol)).padStart(10, '0')
    sensitive.set(cik, { value: cik, scanTrackedText: false })
    const unpadded = cik.replace(/^0+/, '')
    if (unpadded) sensitive.set(unpadded, { value: unpadded, scanTrackedText: false })
  }

  const sensitiveValues = new Set([...sensitive.keys()])
  const files = await trackedTextFiles(ROOT)
  for (const path of files) {
    const rel = relative(ROOT, path).replaceAll('\\', '/')
    const text = await readFile(path, 'utf8')
    if (rel.startsWith('public/data/') && rel.endsWith('.json')) {
      assertPublicJsonClean(JSON.parse(text) as unknown, rel, sensitiveValues)
      continue
    }
    for (const token of sensitive.values()) {
      if (!token.scanTrackedText || !containsTrackedToken(text, token.value)) continue
      throw new Error(`${rel}: private market identity leaked into tracked text`)
    }
  }
  console.log(`Validated private market identities against ${files.length} tracked/public text files without exposing identity values.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
