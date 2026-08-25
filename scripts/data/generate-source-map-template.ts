import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const outputPath = join(ROOT, '.private', 'market-source-map.template.json')

function sourceFor(assetId: string, market: 'KR' | 'US', kind: 'stock' | 'etf') {
  if (market === 'US') {
    return { provider: 'ALPHA_VANTAGE', symbol: '' }
  }
  if (kind === 'etf') {
    return { provider: 'KRX', endpoint: 'etf_bydd_trd', endpointChanges: [], symbol: '' }
  }
  if (assetId === 'K017') {
    return {
      provider: 'KRX',
      endpoint: 'ksq_bydd_trd',
      endpointChanges: [{ effectiveFrom: '2018-02-09', endpoint: 'stk_bydd_trd' }],
      symbol: '',
    }
  }
  if (assetId === 'K037') {
    return { provider: 'KRX', endpoint: 'ksq_bydd_trd', endpointChanges: [], symbol: '' }
  }
  return { provider: 'KRX', endpoint: 'stk_bydd_trd', endpointChanges: [], symbol: '' }
}

const assets = Object.fromEntries(ASSET_CATALOG.map((asset) => [
  asset.id,
  sourceFor(asset.id, asset.market, asset.kind),
]))

await mkdir(join(ROOT, '.private'), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, assets }, null, 2)}\n`, 'utf8')
console.log(`Wrote ${ASSET_CATALOG.length}-asset private source-map template to ${outputPath}`)
console.log('Fill every symbol locally. Do not commit the completed mapping.')
