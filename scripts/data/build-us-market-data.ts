import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAndPersistUsMarketData } from './us-market-builder'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_FROM = '2018-01-01'

function cliValue(name: string): string | null {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : null
}

function assertIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must use YYYY-MM-DD`)
  }
  return value
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`)
  return value
}

async function main(): Promise<void> {
  const from = assertIsoDate(cliValue('from') ?? process.env.MARKET_DATA_FROM ?? DEFAULT_FROM, 'from')
  const to = assertIsoDate(
    cliValue('to') ?? process.env.MARKET_DATA_TO ?? new Date().toISOString().slice(0, 10),
    'to',
  )
  if (from > to) throw new Error('from must not be after to')

  const summary = await buildAndPersistUsMarketData({
    from,
    to,
    sourceMapPath: process.env.MARKET_SOURCE_MAP_PATH ?? join(ROOT, '.private', 'market-source-map.json'),
    outputRoot: join(ROOT, 'public', 'data'),
    cacheRoot: join(ROOT, '.cache', 'market-data'),
    force: process.argv.includes('--force'),
    requestDelayMs: envNumber('NASDAQ_REQUEST_DELAY_MS', 80),
  })

  console.log('Nasdaq U.S. history build complete')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
