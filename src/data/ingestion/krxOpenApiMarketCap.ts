type JsonRecord = Record<string, unknown>

export interface KrxOpenApiMarketCapRow {
  date: string
  symbol: string
  name: string
  open: number
  close: number
  marketCap: number
  listedShares: number
}

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function numberText(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = text(value)
  if (!raw) return null
  const parsed = Number(raw.replaceAll(',', ''))
  return Number.isFinite(parsed) ? parsed : null
}

function isoDate(value: unknown): string | null {
  const raw = text(value)
  if (!raw || !/^\d{8}$/.test(raw)) return null
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

function shortCode(item: JsonRecord): string | null {
  const preferred = text(item.ISU_SRT_CD)
  if (preferred && /^\d{6}$/.test(preferred)) return preferred
  const fallback = text(item.ISU_CD)
  return fallback && /^\d{6}$/.test(fallback) ? fallback : null
}

export function normalizeKrxOpenApiMarketCapPayload(
  payload: unknown,
  expectedDate: string,
  expectedSymbols: ReadonlySet<string>,
): KrxOpenApiMarketCapRow[] {
  const root = record(payload)
  const rows = root?.OutBlock_1
  if (!Array.isArray(rows)) throw new Error('KRX OPEN API payload is missing OutBlock_1')

  const result: KrxOpenApiMarketCapRow[] = []
  for (const raw of rows) {
    const item = record(raw)
    if (!item) continue
    const symbol = shortCode(item)
    if (!symbol || !expectedSymbols.has(symbol)) continue
    const date = isoDate(item.BAS_DD)
    const name = text(item.ISU_NM)
    const open = numberText(item.TDD_OPNPRC)
    const close = numberText(item.TDD_CLSPRC)
    const marketCap = numberText(item.MKTCAP)
    const listedShares = numberText(item.LIST_SHRS)
    if (date !== expectedDate || !name || open === null || close === null || marketCap === null || listedShares === null) {
      throw new Error(`KRX OPEN API returned incomplete market-cap fields for ${symbol} on ${expectedDate}`)
    }
    if (open <= 0 || close <= 0 || marketCap <= 0 || listedShares <= 0) {
      throw new Error(`KRX OPEN API returned non-positive market-cap fields for ${symbol} on ${expectedDate}`)
    }
    result.push({ date, symbol, name, open, close, marketCap, listedShares })
  }
  return result.sort((left, right) => left.symbol.localeCompare(right.symbol))
}
