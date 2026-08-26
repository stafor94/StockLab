import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBaseRateSeries } from '../../src/data/rateSchema'
import { getBaseRateForDate } from '../../src/game/loan/rateRules'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

const path = join(DATA_ROOT, 'rates', 'bok-base-rate.json')
const value = JSON.parse(await readFile(path, 'utf8')) as unknown
const parsed = parseBaseRateSeries(value)

const krCalendar = JSON.parse(await readFile(join(DATA_ROOT, 'calendars', 'kr.json'), 'utf8')) as {
  coverage?: { from?: unknown; to?: unknown }
}
const gameFrom = krCalendar.coverage?.from
const gameTo = krCalendar.coverage?.to
if (typeof gameFrom !== 'string' || typeof gameTo !== 'string') {
  throw new Error('KR calendar has invalid coverage metadata')
}
if (parsed.coverage.from !== gameFrom || parsed.coverage.to !== gameTo) {
  throw new Error(`BOK base-rate coverage ${parsed.coverage.from}..${parsed.coverage.to} does not match game coverage ${gameFrom}..${gameTo}`)
}

const allowBootstrap = process.argv.includes('--allow-bootstrap')
if (!allowBootstrap && parsed.source.mode === 'bootstrap') {
  throw new Error('BOK base-rate dataset is still bootstrap data')
}
if (parsed.source.mode === 'bootstrap' && parsed.coverage.to === gameTo) {
  throw new Error('Full game-period BOK base-rate data must come from ECOS')
}

const officialChangePoints = [
  ['2017-11-30', 1.5],
  ['2018-11-30', 1.75],
  ['2019-07-18', 1.5],
  ['2019-10-16', 1.25],
  ['2020-03-17', 0.75],
  ['2020-05-28', 0.5],
  ['2021-08-26', 0.75],
  ['2021-11-25', 1],
  ['2022-01-14', 1.25],
  ['2022-04-14', 1.5],
  ['2022-05-26', 1.75],
  ['2022-07-13', 2.25],
  ['2022-08-25', 2.5],
  ['2022-10-12', 3],
  ['2022-11-24', 3.25],
  ['2023-01-13', 3.5],
  ['2024-10-11', 3.25],
  ['2024-11-28', 3],
  ['2025-02-25', 2.75],
  ['2025-05-29', 2.5],
  ['2026-07-16', 2.75],
] as const

if (parsed.source.mode === 'ecos') {
  if (parsed.rates.length !== officialChangePoints.length) {
    throw new Error(`Expected exactly ${officialChangePoints.length} official BOK base-rate change points, found ${parsed.rates.length}`)
  }
  for (let index = 0; index < officialChangePoints.length; index += 1) {
    const [expectedDate, expectedRate] = officialChangePoints[index]
    const actual = parsed.rates[index]
    if (actual.date !== expectedDate || actual.annualRate !== expectedRate) {
      throw new Error(`Unexpected BOK base-rate row at index ${index}: ${actual.date}=${actual.annualRate}; expected ${expectedDate}=${expectedRate}`)
    }
  }
}

for (let index = 0; index < officialChangePoints.length; index += 1) {
  const [date, annualRate] = officialChangePoints[index]
  const row = parsed.rates.find((point) => point.date === date)
  if (row?.annualRate !== annualRate) {
    throw new Error(`Missing official BOK base-rate change ${date}=${annualRate}`)
  }
  if (date < parsed.coverage.from || date > parsed.coverage.to) continue

  if (getBaseRateForDate(parsed, date) !== annualRate) {
    throw new Error(`BOK base rate is not effective on change date ${date}`)
  }
  const previous = officialChangePoints[index - 1]
  const dayBefore = previousDate(date)
  if (previous && dayBefore >= parsed.coverage.from && getBaseRateForDate(parsed, dayBefore) !== previous[1]) {
    throw new Error(`BOK base rate changed before official effective date ${date}`)
  }
}

getBaseRateForDate(parsed, parsed.coverage.from)
getBaseRateForDate(parsed, parsed.coverage.to)

console.log(
  `Validated ${parsed.rates.length} BOK base-rate change points (${parsed.source.mode}), coverage ${parsed.coverage.from}..${parsed.coverage.to}`,
)
