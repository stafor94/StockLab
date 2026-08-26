import { gzipSync } from 'node:zlib'
import { normalizeKrxIndexDailyPayload } from '../../src/data/ingestion/krxIndex'
import { parseMarketCalendar } from '../../src/data/schema'
import type { DailyBar } from '../../src/types/market'
import { readJson } from './io'
import { fetchKrxIndexDailyPayload } from './providers/krx-index'

const SEGMENT_FROM = '2018-01-01'
const SEGMENT_TO = '2019-12-31'
const CACHE_ROOT = '.cache/market-index-data'
const CONCURRENCY = 6
const DELAY_MS = 25

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

async function mapWithConcurrency<T>(values: string[], mapper: (value: string) => Promise<T>): Promise<T[]> {
  const results = new Array<T>(values.length)
  let next = 0
  const worker = async () => {
    while (next < values.length) {
      const index = next++
      results[index] = await mapper(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, values.length) }, worker))
  return results
}

const calendar = parseMarketCalendar(await readJson('public/data/calendars/kr.json'))
const carryIn = Array.from({ length: 12 }, (_, index) => addDays(calendar.tradingDates[0], -(index + 1)))
const tradingDates = calendar.tradingDates.filter((date) => date >= SEGMENT_FROM && date <= SEGMENT_TO)
const dates = [...new Set([...carryIn, ...tradingDates])].sort()

const rows = await mapWithConcurrency(dates, async (date) => {
  const payload = await fetchKrxIndexDailyPayload({ date, cacheRoot: CACHE_ROOT, force: false, delayMs: DELAY_MS })
  return {
    kospi: normalizeKrxIndexDailyPayload(payload, { date, target: 'KOSPI' }),
    kosdaq: normalizeKrxIndexDailyPayload(payload, { date, target: 'KOSDAQ' }),
  }
})

const compact = (bars: Array<DailyBar | null>) => bars.filter((bar): bar is DailyBar => bar !== null)
const exportData = {
  from: SEGMENT_FROM,
  to: SEGMENT_TO,
  kospi: compact(rows.map((row) => row.kospi)),
  kosdaq: compact(rows.map((row) => row.kosdaq)),
}
const payload = gzipSync(Buffer.from(JSON.stringify(exportData), 'utf8')).toString('base64')
console.log(`KRX_SEGMENT_ROWS KOSPI=${exportData.kospi.length} KOSDAQ=${exportData.kosdaq.length}`)
console.log('INDEX_EXPORT_BEGIN')
for (let offset = 0; offset < payload.length; offset += 6_000) console.log(payload.slice(offset, offset + 6_000))
console.log('INDEX_EXPORT_END')
