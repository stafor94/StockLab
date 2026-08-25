import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBaseRateSeries } from '../../src/data/rateSchema'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const path = join(ROOT, 'public', 'data', 'rates', 'bok-base-rate.json')
const value = JSON.parse(await readFile(path, 'utf8')) as unknown
const parsed = parseBaseRateSeries(value)
if (!parsed.rates.some((point) => point.date <= parsed.coverage.from)) {
  throw new Error('BOK base-rate dataset has no carry-in rate at coverage start')
}
if (!process.argv.includes('--allow-bootstrap') && parsed.source.mode === 'bootstrap') {
  throw new Error('BOK base-rate dataset is still bootstrap data')
}
console.log(`Validated ${parsed.rates.length} BOK base-rate change points (${parsed.source.mode})`)
