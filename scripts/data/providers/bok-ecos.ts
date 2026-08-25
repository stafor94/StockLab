import { join } from 'node:path'
import { readJsonIfExists, writeJsonAtomic } from '../io'

export const BOK_ECOS_USD_KRW_STAT_CODE = '731Y001' as const
export const BOK_ECOS_USD_KRW_ITEM_CODE = '0000001' as const
export const BOK_ECOS_USD_KRW_FREQUENCY = 'D' as const
export const BOK_ECOS_USD_KRW_ENDPOINT = 'https://ecos.bok.or.kr/api/StatisticSearch' as const

export interface BokEcosFetchOptions {
  apiKey: string
  from: string
  to: string
  cacheRoot: string
  force?: boolean
}

const DEFAULT_PAGE_SIZE = 1000
const SAMPLE_PAGE_SIZE = 10
const SAMPLE_PAGE_DELAY_MS = 100
const MAX_RETRIES = 4

function compactDate(value: string): string {
  return value.replaceAll('-', '')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function apiError(payload: unknown): string | null {
  if (!isObject(payload) || !isObject(payload.RESULT)) return null
  const code = typeof payload.RESULT.CODE === 'string' ? payload.RESULT.CODE : 'UNKNOWN'
  const message = typeof payload.RESULT.MESSAGE === 'string' ? payload.RESULT.MESSAGE : 'Unknown ECOS error'
  return `${code}: ${message}`
}

function parseSearchPage(payload: unknown): { total: number; search: Record<string, unknown>; rows: unknown[] } {
  const error = apiError(payload)
  if (error) throw new Error(`BOK ECOS error: ${error}`)
  if (!isObject(payload) || !isObject(payload.StatisticSearch) || !Array.isArray(payload.StatisticSearch.row)) {
    throw new Error('BOK ECOS response does not contain StatisticSearch.row')
  }
  const total = Number(payload.StatisticSearch.list_total_count)
  if (!Number.isInteger(total) || total < 0) throw new Error('BOK ECOS response has invalid list_total_count')
  return { total, search: payload.StatisticSearch, rows: payload.StatisticSearch.row }
}

function buildSearchUrl(apiKey: string, from: string, to: string, start: number, end: number): URL {
  return new URL(
    `${BOK_ECOS_USD_KRW_ENDPOINT}/${encodeURIComponent(apiKey)}/json/kr/${start}/${end}/${BOK_ECOS_USD_KRW_STAT_CODE}/${BOK_ECOS_USD_KRW_FREQUENCY}/${compactDate(from)}/${compactDate(to)}/${BOK_ECOS_USD_KRW_ITEM_CODE}`,
  )
}

async function fetchSearchPage(apiKey: string, from: string, to: string, start: number, end: number): Promise<unknown> {
  const url = buildSearchUrl(apiKey, from, to, start, end)
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetch(url)
    if (response.ok) {
      const payload = await response.json() as unknown
      const error = apiError(payload)
      if (!error) return payload
      if (!error.startsWith('ERROR-602') || attempt === MAX_RETRIES - 1) {
        throw new Error(`BOK ECOS error: ${error}`)
      }
    } else if ((response.status < 500 && response.status !== 429) || attempt === MAX_RETRIES - 1) {
      throw new Error(`BOK ECOS request failed: HTTP ${response.status}`)
    }
    await sleep(500 * (2 ** attempt))
  }
  throw new Error('BOK ECOS request failed after retries')
}

export async function fetchBokEcosUsdKrwPayload(options: BokEcosFetchOptions): Promise<unknown> {
  const cachePath = join(options.cacheRoot, 'bok-ecos', `usd-krw-${options.from}-${options.to}.json`)
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached) return cached
  }

  const pageSize = options.apiKey === 'sample' ? SAMPLE_PAGE_SIZE : DEFAULT_PAGE_SIZE
  const firstPayload = await fetchSearchPage(options.apiKey, options.from, options.to, 1, pageSize)
  const firstPage = parseSearchPage(firstPayload)
  const rows = [...firstPage.rows]

  for (let start = pageSize + 1; start <= firstPage.total; start += pageSize) {
    if (options.apiKey === 'sample') await sleep(SAMPLE_PAGE_DELAY_MS)
    const end = Math.min(start + pageSize - 1, firstPage.total)
    const page = parseSearchPage(await fetchSearchPage(options.apiKey, options.from, options.to, start, end))
    if (page.total !== firstPage.total) throw new Error('BOK ECOS result count changed during pagination')
    rows.push(...page.rows)
  }

  if (rows.length !== firstPage.total) {
    throw new Error(`BOK ECOS pagination returned ${rows.length} rows, expected ${firstPage.total}`)
  }

  const payload = {
    StatisticSearch: {
      ...firstPage.search,
      list_total_count: firstPage.total,
      row: rows,
    },
  }
  await writeJsonAtomic(cachePath, payload)
  return payload
}
