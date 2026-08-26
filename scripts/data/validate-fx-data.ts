import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFxRateSeries } from '../../src/data/fxSchema'
import { parseMarketCalendar, parseMarketDataManifest } from '../../src/data/schema'
import { findUsdKrwRatePointForDate } from '../../src/game/exchange/exchangeEngine'
import { GAME_START_DATE } from '../../src/game/constants'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const dataRoot = join(ROOT, 'public', 'data')
const MAX_PUBLISHED_GAP_DAYS = 14

function daysBetween(left: string, right: string): number {
  return (Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 86_400_000
}

const fx = parseFxRateSeries(JSON.parse(await readFile(join(dataRoot, 'fx', 'usd-krw.json'), 'utf8')) as unknown)
const manifest = parseMarketDataManifest(JSON.parse(await readFile(join(dataRoot, 'manifest.json'), 'utf8')) as unknown)
const krCalendar = parseMarketCalendar(JSON.parse(await readFile(join(dataRoot, manifest.calendars.KR), 'utf8')) as unknown)
const usCalendar = parseMarketCalendar(JSON.parse(await readFile(join(dataRoot, manifest.calendars.US), 'utf8')) as unknown)
const requiredCoverageTo = [krCalendar.coverage.to, usCalendar.coverage.to].sort().at(-1)

if (!requiredCoverageTo || fx.coverage.to < requiredCoverageTo) {
  throw new Error(`USD/KRW FX coverage ends at ${fx.coverage.to}, before game data coverage ${requiredCoverageTo ?? 'unknown'}`)
}

const startRate = findUsdKrwRatePointForDate(fx, GAME_START_DATE)
if (!startRate || startRate.date > GAME_START_DATE) {
  throw new Error(`USD/KRW FX dataset has no official carry-in rate for game start ${GAME_START_DATE}`)
}

let largestGap = 0
let largestGapLabel = ''
for (let index = 1; index < fx.rates.length; index += 1) {
  const previous = fx.rates[index - 1]
  const current = fx.rates[index]
  const gap = daysBetween(previous.date, current.date)
  if (gap > largestGap) {
    largestGap = gap
    largestGapLabel = `${previous.date}..${current.date}`
  }
  if (gap > MAX_PUBLISHED_GAP_DAYS) {
    throw new Error(`USD/KRW FX data has an abnormal ${gap}-day published-data gap: ${previous.date}..${current.date}`)
  }
}

for (const calendar of [krCalendar, usCalendar]) {
  for (const date of calendar.tradingDates) {
    if (date < GAME_START_DATE || date > fx.coverage.to) continue
    const point = findUsdKrwRatePointForDate(fx, date)
    if (!point || point.date > date) throw new Error(`USD/KRW lookup failed without lookahead for ${calendar.market} ${date}`)
  }
}

console.log(`Validated ${fx.rates.length} USD/KRW rates from Bank of Korea ECOS (${fx.coverage.from}..${fx.coverage.to})`)
console.log(`- Game-start carry-in: ${startRate.date} = ${startRate.usdKrw}`)
console.log(`- Largest official publication gap: ${largestGap} days (${largestGapLabel})`)
