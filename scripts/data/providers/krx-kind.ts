import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const KIND_BASE_URL = 'https://kind.krx.co.kr'
const USER_AGENT = 'StockLab historical-data builder (+https://github.com/stafor94/StockLab)'

interface CachedTextPayload {
  responseText: string
}

function cachedText(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const responseText = (value as Record<string, unknown>).responseText
  return typeof responseText === 'string' ? responseText : null
}

function sessionCookie(headers: Headers): string {
  const raw = headers.get('set-cookie') ?? ''
  const match = raw.match(/JSESSIONID=[^;,\s]+/i)
  return match?.[0] ?? ''
}

export interface KrxKindCommonOptions {
  cacheRoot: string
  force: boolean
  delayMs: number
}

export interface KrxKindSession {
  referer: string
  cookie: string
}

export async function fetchKrxKindIssuerLookup(
  symbol: string,
  options: KrxKindCommonOptions,
): Promise<string> {
  const cachePath = join(options.cacheRoot, 'krx-kind', 'issuer', `${symbol}.json`)
  if (!options.force) {
    const cached = cachedText(await readJsonIfExists(cachePath))
    if (cached !== null) return cached
  }

  await sleep(options.delayMs)
  const url = new URL('/common/corpbasicinfo.do', KIND_BASE_URL)
  url.searchParams.set('method', 'searchCorpBasicInfo')
  url.searchParams.set('cd_or_nm', `A${symbol}`)
  const response = await fetch(url, {
    headers: {
      Accept: 'application/xml,text/xml,*/*',
      'User-Agent': USER_AGENT,
    },
  })
  if (!response.ok) {
    throw new Error(`KRX KIND issuer lookup for ${symbol} failed with HTTP ${response.status}`)
  }
  const responseText = await response.text()
  if (!responseText.includes('<items>')) {
    throw new Error(`KRX KIND issuer lookup for ${symbol} returned an unexpected payload`)
  }
  await writeJsonAtomic(cachePath, { responseText } satisfies CachedTextPayload)
  return responseText
}

export async function openKrxKindSession(
  issuerCode: string,
  delayMs: number,
): Promise<KrxKindSession> {
  await sleep(delayMs)
  const referer = new URL('/common/chart.do', KIND_BASE_URL)
  referer.searchParams.set('method', 'loadInitPage')
  referer.searchParams.set('ispopup', 'true')
  referer.searchParams.set('isurcd', issuerCode)

  const response = await fetch(referer, {
    headers: {
      Accept: 'text/html,*/*',
      'User-Agent': USER_AGENT,
    },
  })
  if (!response.ok) {
    throw new Error(`KRX KIND chart session for issuer ${issuerCode} failed with HTTP ${response.status}`)
  }
  const html = await response.text()
  if (!html.includes(`value="${issuerCode}"`) && !html.includes(`value='${issuerCode}'`)) {
    throw new Error(`KRX KIND chart session did not identify issuer ${issuerCode}`)
  }

  return {
    referer: referer.toString(),
    cookie: sessionCookie(response.headers),
  }
}

export interface KrxKindHistoricalOptions extends KrxKindCommonOptions {
  symbol: string
  issuerCode: string
  from: string
  to: string
  session: KrxKindSession
}

export async function fetchKrxKindHistoricalResponse(
  options: KrxKindHistoricalOptions,
): Promise<string> {
  const cachePath = join(
    options.cacheRoot,
    'krx-kind',
    'history',
    options.symbol,
    `${options.from}_${options.to}.json`,
  )
  if (!options.force) {
    const cached = cachedText(await readJsonIfExists(cachePath))
    if (cached !== null) return cached
  }

  await sleep(options.delayMs)
  const form = new URLSearchParams({
    method: 'loadFlexForDisclsAnalysisChart',
    isurcd: options.issuerCode,
    infotype: 'prsntprc',
    fromDate: options.from,
    toDate: options.to,
    dscltype: 'all',
  })
  const response = await fetch(new URL('/corpdetail/chart.do', KIND_BASE_URL), {
    method: 'POST',
    body: form,
    headers: {
      Accept: 'text/html,*/*',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Referer: options.session.referer,
      'User-Agent': USER_AGENT,
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.session.cookie ? { Cookie: options.session.cookie } : {}),
    },
  })
  if (!response.ok) {
    throw new Error(
      `KRX KIND history for ${options.symbol} ${options.from}..${options.to} failed with HTTP ${response.status}`,
    )
  }
  const responseText = await response.text()
  if (!responseText.includes('dataDisclsAnalysisChart')) {
    throw new Error(`KRX KIND history for ${options.symbol} returned an unexpected payload`)
  }
  await writeJsonAtomic(cachePath, { responseText } satisfies CachedTextPayload)
  return responseText
}
