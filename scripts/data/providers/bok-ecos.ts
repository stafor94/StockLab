import { join } from 'node:path'
import { readJsonIfExists, writeJsonAtomic } from '../io'

export interface BokEcosFetchOptions {
  apiKey: string
  from: string
  to: string
  cacheRoot: string
  force?: boolean
}

function compactDate(value: string): string {
  return value.replaceAll('-', '')
}

export async function fetchBokEcosUsdKrwPayload(options: BokEcosFetchOptions): Promise<unknown> {
  const cachePath = join(options.cacheRoot, 'bok-ecos', `usd-krw-${options.from}-${options.to}.json`)
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached) return cached
  }

  const url = new URL(`https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(options.apiKey)}/json/kr/1/10000/731Y001/D/${compactDate(options.from)}/${compactDate(options.to)}/0000001`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`BOK ECOS request failed: HTTP ${response.status}`)
  const payload = await response.json() as unknown
  await writeJsonAtomic(cachePath, payload)
  return payload
}
