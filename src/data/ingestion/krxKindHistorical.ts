import type { DailyBar } from '../../types/market'

type JsonRecord = Record<string, unknown>

export interface KrxKindIssuerInfo {
  issuerCode: string
  isin: string
  shortCode: string
  name: string
}

function parseXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 's'))
  return match?.[1]?.trim() ?? ''
}

export function parseKrxKindIssuerInfo(xml: string, expectedSymbol: string): KrxKindIssuerInfo {
  if (!/^\d{6}$/.test(expectedSymbol)) {
    throw new Error(`KRX KIND expected symbol must be 6 digits: ${expectedSymbol}`)
  }

  const issuerCode = parseXmlTag(xml, 'isurcd')
  const isin = parseXmlTag(xml, 'repisucd')
  const shortCode = parseXmlTag(xml, 'repisusrtcd').replace(/^A/, '')
  const name = parseXmlTag(xml, 'comabbr') || parseXmlTag(xml, 'repisusrtkornm')

  if (!/^\d{5}$/.test(issuerCode)) {
    throw new Error(`KRX KIND issuer lookup did not return a 5-digit issuer code for ${expectedSymbol}`)
  }
  if (shortCode !== expectedSymbol) {
    throw new Error(`KRX KIND issuer lookup mismatch: expected ${expectedSymbol}, received ${shortCode || 'empty'}`)
  }
  if (!/^KR[A-Z0-9]{10}$/.test(isin)) {
    throw new Error(`KRX KIND issuer lookup returned an invalid ISIN for ${expectedSymbol}`)
  }
  if (!name) {
    throw new Error(`KRX KIND issuer lookup returned an empty name for ${expectedSymbol}`)
  }

  return { issuerCode, isin, shortCode, name }
}

function numberField(record: JsonRecord, key: string, label: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label}.${key} must be a finite number`)
  }
  return value
}

export function normalizeKrxKindHistoricalResponse(
  responseText: string,
  range?: { from: string; to: string },
): DailyBar[] {
  const match = responseText.match(/var\s+dataDisclsAnalysisChart\s*=\s*(\[.*?\]);/s)
  if (!match) {
    throw new Error('KRX KIND response is missing dataDisclsAnalysisChart')
  }

  let payload: unknown
  try {
    payload = JSON.parse(match[1]) as unknown
  } catch {
    throw new Error('KRX KIND dataDisclsAnalysisChart is not valid JSON')
  }
  if (!Array.isArray(payload)) {
    throw new Error('KRX KIND dataDisclsAnalysisChart must be an array')
  }

  const bars = payload.map((row, index): DailyBar => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`KRX KIND row ${index} must be an object`)
    }
    const item = row as JsonRecord
    const date = typeof item.date === 'string' ? item.date : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`KRX KIND row ${index} has an invalid date`)
    }

    const open = numberField(item, 'open', `KRX KIND row ${index}`)
    const high = numberField(item, 'high', `KRX KIND row ${index}`)
    const low = numberField(item, 'low', `KRX KIND row ${index}`)
    const close = numberField(item, 'close', `KRX KIND row ${index}`)
    const volume = numberField(item, 'admnt', `KRX KIND row ${index}`)

    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
      throw new Error(`KRX KIND row ${index} contains a non-positive OHLC or negative volume`)
    }
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
      throw new Error(`KRX KIND row ${index} violates OHLC bounds`)
    }

    return { date, open, high, low, close, volume }
  })

  // KIND keeps display-only stale-price rows during trading halts. With zero
  // executed volume there is no valid market execution price, so those rows
  // must not become tradable daily bars or listing/calendar evidence.
  const tradableBars = bars.filter((bar) => bar.volume !== null && bar.volume > 0)
  const filtered = range
    ? tradableBars.filter((bar) => bar.date >= range.from && bar.date <= range.to)
    : tradableBars
  filtered.sort((left, right) => left.date.localeCompare(right.date))

  for (let index = 1; index < filtered.length; index += 1) {
    if (filtered[index - 1].date === filtered[index].date) {
      throw new Error(`KRX KIND response contains duplicate date ${filtered[index].date}`)
    }
  }

  return filtered
}
