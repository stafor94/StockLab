import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFxRateSeries } from '../../src/data/fxSchema'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const path = join(ROOT, 'public', 'data', 'fx', 'usd-krw.json')

try {
  const value = JSON.parse(await readFile(path, 'utf8')) as unknown
  const parsed = parseFxRateSeries(value)
  if (parsed.rates.length === 0) throw new Error('USD/KRW FX dataset is empty')
  console.log(`Validated ${parsed.rates.length} USD/KRW rates from Bank of Korea ECOS`)
} catch (error) {
  if (process.argv.includes('--allow-missing') && (error as NodeJS.ErrnoException).code === 'ENOENT') {
    console.log('USD/KRW FX file is not generated yet; skipping because --allow-missing was supplied')
  } else {
    throw error
  }
}
