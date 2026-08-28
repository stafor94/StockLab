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

interface SensitiveToken {
  value: string
  shortSymbol: boolean
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

function containsToken(text: string, token: SensitiveToken, publicJson: boolean): boolean {
  if (token.shortSymbol && !publicJson) return false
  if (token.shortSymbol) {
    const escaped = token.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|[\"'])${escaped}(?:[\"']|$)`).test(text)
  }
  return text.includes(token.value)
}

async function main(): Promise<void> {
  const sourceMap = await loadMarketSourceMap(SOURCE_MAP_PATH, true)
  const sensitive = new Map<string, SensitiveToken>()
  for (const source of sourceMap.assets.values()) {
    sensitive.set(source.symbol, { value: source.symbol, shortSymbol: source.provider === 'NASDAQ' && source.symbol.length <= 2 })
    if (source.provider === 'KRX' && source.isin) sensitive.set(source.isin, { value: source.isin, shortSymbol: false })
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
    const cik = resolveSecCikForTicker(secTickers, source.symbol)
    sensitive.set(cik, { value: cik, shortSymbol: false })
    sensitive.set(cik.replace(/^0+/, ''), { value: cik.replace(/^0+/, ''), shortSymbol: false })
  }

  const files = await trackedTextFiles(ROOT)
  for (const path of files) {
    const rel = relative(ROOT, path).replaceAll('\\', '/')
    const publicJson = rel.startsWith('public/data/') && rel.endsWith('.json')
    const text = await readFile(path, 'utf8')
    for (const token of sensitive.values()) {
      if (!token.value || !containsToken(text, token, publicJson)) continue
      throw new Error(`${rel}: private market identity leaked into tracked/public text`)
    }
  }
  console.log(`Validated private market identities against ${files.length} tracked/public text files without exposing identity values.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
