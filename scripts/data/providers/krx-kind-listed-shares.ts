import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { parseKrxKindListedSharesHtml, type KrxKindListedSharesRow } from '../../../src/data/ingestion/krxKindListedShares'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'
import type { KrxEndpoint } from '../source-map'

const KIND_URL = 'https://kind.krx.co.kr/corpgeneral/listedissuestatusdetail.do'
const KIND_REFERER = 'https://kind.krx.co.kr/corpgeneral/listedIssueStatus.do?method=loadInitPage'
const USER_AGENT = 'StockLab historical-data builder (+https://github.com/stafor94/StockLab)'

interface FetchOptions {
  endpoint: KrxEndpoint
  date: string
  expectedSymbols: ReadonlySet<string>
  cacheRoot: string
  force: boolean
  delayMs: number
}

function endpointForm(endpoint: KrxEndpoint): { mktId: 'STK' | 'KSQ'; secugrpId: 'ST' | 'EF' } {
  if (endpoint === 'ksq_bydd_trd') return { mktId: 'KSQ', secugrpId: 'ST' }
  if (endpoint === 'etf_bydd_trd') return { mktId: 'STK', secugrpId: 'EF' }
  return { mktId: 'STK', secugrpId: 'ST' }
}

function symbolFingerprint(symbols: ReadonlySet<string>): string {
  return createHash('sha1').update([...symbols].sort().join(',')).digest('hex').slice(0, 12)
}

function cachedRows(value: unknown, expectedSymbols: ReadonlySet<string>): KrxKindListedSharesRow[] | null {
  if (!Array.isArray(value)) return null
  const rows: KrxKindListedSharesRow[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
    const item = raw as Record<string, unknown>
    if (typeof item.symbol !== 'string' || typeof item.name !== 'string' || typeof item.listedShares !== 'number') return null
    if (!expectedSymbols.has(item.symbol) || !Number.isSafeInteger(item.listedShares) || item.listedShares <= 0) return null
    rows.push({ symbol: item.symbol, name: item.name, listedShares: item.listedShares })
  }
  return rows
}

export async function fetchKrxKindListedShares(
  options: FetchOptions,
): Promise<KrxKindListedSharesRow[]> {
  const cachePath = join(
    options.cacheRoot,
    'krx-kind',
    'listed-shares',
    options.endpoint,
    `${options.date}-${symbolFingerprint(options.expectedSymbols)}.json`,
  )
  if (!options.force) {
    const cached = cachedRows(await readJsonIfExists(cachePath), options.expectedSymbols)
    if (cached !== null) return cached
  }

  const { mktId, secugrpId } = endpointForm(options.endpoint)
  const form = new URLSearchParams({
    method: 'searchListedIssueStatDetailSub',
    forward: 'listedissuestatdetail_down',
    currentPageSize: '3000',
    pageIndex: '1',
    mktId,
    secugrpId,
    detailType: '2',
    selDate: options.date.replaceAll('-', ''),
  })

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (options.delayMs > 0) await sleep(options.delayMs)
    try {
      const response = await fetch(KIND_URL, {
        method: 'POST',
        body: form,
        headers: {
          Accept: 'text/html,*/*',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Referer: KIND_REFERER,
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`)
        if (response.status !== 429 && response.status < 500) break
      } else {
        const html = new TextDecoder('euc-kr').decode(await response.arrayBuffer())
        const rows = parseKrxKindListedSharesHtml(html, options.expectedSymbols)
        await writeJsonAtomic(cachePath, rows)
        return rows
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    await sleep(500 * (2 ** attempt))
  }
  throw new Error(`KRX KIND listed-share request failed for ${options.endpoint} ${options.date}: ${lastError?.message ?? 'unknown error'}`)
}
