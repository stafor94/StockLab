import { join } from 'node:path'
import type { KrxMajorIndex } from '../../../src/data/ingestion/krxIndex'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const KRX_DATA_URL = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd'
const KRX_INDEX_BLD = 'dbms/MDC/STAT/standard/MDCSTAT00301'
const MAX_RANGE_DAYS = 730
const REQUEST_HEADERS = {
  accept: 'application/json, text/javascript, */*; q=0.01',
  referer: 'https://data.krx.co.kr/contents/MDC/MDI/outerLoader/index.cmd',
  'user-agent': 'Mozilla/5.0',
  'x-requested-with': 'XMLHttpRequest',
}

const INDEX_CODES: Record<KrxMajorIndex, { groupId: string; ticker: string }> = {
  KOSPI: { groupId: '1', ticker: '001' },
  KOSDAQ: { groupId: '2', ticker: '001' },
}

export interface KrxIndexHistoryOptions {
  target: KrxMajorIndex
  from: string
  to: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

function assertDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('KRX index date must use YYYY-MM-DD')
  return date
}

function compactDate(date: string): string {
  return assertDate(date).replaceAll('-', '')
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function splitRanges(from: string, to: string): Array<{ from: string; to: string }> {
  assertDate(from)
  assertDate(to)
  if (from > to) throw new Error(`KRX index range is reversed: ${from}..${to}`)
  const ranges: Array<{ from: string; to: string }> = []
  let cursor = from
  while (cursor <= to) {
    const candidateEnd = addDays(cursor, MAX_RANGE_DAYS)
    const end = candidateEnd < to ? candidateEnd : to
    ranges.push({ from: cursor, to: end })
    cursor = addDays(end, 1)
  }
  return ranges
}

function isHistoryPayload(payload: unknown): payload is { output: unknown[] } {
  return typeof payload === 'object'
    && payload !== null
    && !Array.isArray(payload)
    && Array.isArray((payload as Record<string, unknown>).output)
}

async function requestRange(target: KrxMajorIndex, from: string, to: string): Promise<unknown> {
  const code = INDEX_CODES[target]
  const body = new URLSearchParams({
    bld: KRX_INDEX_BLD,
    indIdx: code.groupId,
    indIdx2: code.ticker,
    strtDd: compactDate(from),
    endDd: compactDate(to),
  })
  const response = await fetch(KRX_DATA_URL, {
    method: 'POST',
    headers: {
      ...REQUEST_HEADERS,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`KRX Data Marketplace HTTP ${response.status}`)
  const payload = await response.json() as unknown
  if (!isHistoryPayload(payload)) throw new Error('unexpected KRX individual-index history response')
  return payload
}

async function fetchRange(options: KrxIndexHistoryOptions, from: string, to: string): Promise<{ output: unknown[] }> {
  const cachePath = join(options.cacheRoot, 'krx-index', options.target, `${from}_${to}.json`)
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached !== null && isHistoryPayload(cached)) return cached
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (options.delayMs > 0) await sleep(options.delayMs)
    try {
      const payload = await requestRange(options.target, from, to)
      if (!isHistoryPayload(payload)) throw new Error('unexpected KRX individual-index history response')
      await writeJsonAtomic(cachePath, payload)
      return payload
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < 5) await sleep(400 * (2 ** attempt))
    }
  }
  throw new Error(`KRX index request failed for ${options.target} ${from}..${to}: ${lastError?.message ?? 'unknown error'}`)
}

export async function fetchKrxIndexHistoryPayload(options: KrxIndexHistoryOptions): Promise<{ output: unknown[] }> {
  const output: unknown[] = []
  for (const range of splitRanges(options.from, options.to)) {
    const payload = await fetchRange(options, range.from, range.to)
    output.push(...payload.output)
  }
  return { output }
}
