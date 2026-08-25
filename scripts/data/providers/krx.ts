import { join } from 'node:path'
import type { KrxEndpoint } from '../source-map'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const KRX_BASE_URL = 'https://data-dbg.krx.co.kr/svc/apis'

const endpointFolders: Record<KrxEndpoint, string> = {
  stk_bydd_trd: 'sto',
  ksq_bydd_trd: 'sto',
  etf_bydd_trd: 'etp',
}

export interface KrxFetchOptions {
  endpoint: KrxEndpoint
  date: string
  authKey: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

export async function fetchKrxDailyPayload(options: KrxFetchOptions): Promise<unknown> {
  const compactDate = options.date.replaceAll('-', '')
  const cachePath = join(options.cacheRoot, 'krx', options.endpoint, `${compactDate}.json`)

  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached !== null) {
      return cached
    }
  }

  await sleep(options.delayMs)
  const url = new URL(`${KRX_BASE_URL}/${endpointFolders[options.endpoint]}/${options.endpoint}`)
  url.searchParams.set('basDd', compactDate)

  const response = await fetch(url, {
    headers: {
      AUTH_KEY: options.authKey,
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`KRX ${options.endpoint} request failed with HTTP ${response.status}`)
  }

  const payload = await response.json() as unknown
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error(`KRX ${options.endpoint} returned a non-object payload`)
  }
  const root = payload as Record<string, unknown>
  if (!Array.isArray(root.OutBlock_1)) {
    throw new Error(`KRX ${options.endpoint} response is missing OutBlock_1`)
  }

  await writeJsonAtomic(cachePath, payload)
  return payload
}
