import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const KRX_INDEX_PAGE = 'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp'
const KRX_OTP_URL = 'https://indices.krx.co.kr/contents/COM/GenerateOTP.jspx'
const KRX_DATA_URL = 'https://indices.krx.co.kr/contents/WWW/99/WWW99000001.jspx'
const KRX_INDEX_BLD = '/IDX/03/0301/03010000/mkd03010000_04'
const KRX_INDEX_CLASSIFICATION = '01'
const KRX_PAGE_PATH = '/contents/MKD/03/0301/03010000/MKD03010000T1.jsp'
const REQUEST_HEADERS = {
  accept: '*/*',
  referer: KRX_INDEX_PAGE,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'x-requested-with': 'XMLHttpRequest',
}

export interface KrxIndexDailyOptions {
  date: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

function compactDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('KRX index date must use YYYY-MM-DD')
  return date.replaceAll('-', '')
}

function isDailyPayload(payload: unknown): payload is { block1: unknown[] } {
  return typeof payload === 'object'
    && payload !== null
    && !Array.isArray(payload)
    && Array.isArray((payload as Record<string, unknown>).block1)
}

async function issueOtp(): Promise<string> {
  const url = new URL(KRX_OTP_URL)
  url.searchParams.set('bld', KRX_INDEX_BLD)
  url.searchParams.set('name', 'form')
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`KRX OTP HTTP ${response.status}`)
  const otp = (await response.text()).trim()
  if (!otp) throw new Error('KRX OTP response was empty')
  return otp
}

async function requestDailyPayload(date: string): Promise<unknown> {
  const otp = await issueOtp()
  const body = new URLSearchParams({
    schdate: compactDate(date),
    lang: 'ko',
    idx_upclss_cd: KRX_INDEX_CLASSIFICATION,
    pagePath: KRX_PAGE_PATH,
    code: otp,
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
  if (!response.ok) throw new Error(`KRX index HTTP ${response.status}`)
  const payload = await response.json() as unknown
  if (!isDailyPayload(payload)) throw new Error('unexpected KRX Indices daily response')
  return payload
}

export async function fetchKrxIndexDailyPayload(options: KrxIndexDailyOptions): Promise<unknown> {
  compactDate(options.date)
  const cachePath = join(options.cacheRoot, 'krx-index', 'daily', `${options.date}.json`)
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached !== null) return cached
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (options.delayMs > 0) await sleep(options.delayMs)
    try {
      const payload = await requestDailyPayload(options.date)
      await writeJsonAtomic(cachePath, payload)
      return payload
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < 5) await sleep(400 * (2 ** attempt))
    }
  }
  throw new Error(`KRX index request failed for ${options.date}: ${lastError?.message ?? 'unknown error'}`)
}
