import { BOK_USD_KRW_SERIES } from './fxSeries'
import type { FxRateSeries } from '../types/fx'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function parseFxRateSeries(value: unknown): FxRateSeries {
  if (!isObject(value) || value.schemaVersion !== 1 || value.pair !== 'USD/KRW') {
    throw new Error('Invalid USD/KRW FX dataset header')
  }
  if (!isObject(value.coverage) || !isIsoDate(value.coverage.from) || !isIsoDate(value.coverage.to) || value.coverage.from > value.coverage.to) {
    throw new Error('Invalid USD/KRW FX coverage')
  }
  if (!Array.isArray(value.rates) || value.rates.length === 0) throw new Error('Invalid USD/KRW FX rates')
  if (!isObject(value.source)
    || value.source.provider !== BOK_USD_KRW_SERIES.provider
    || value.source.statCode !== BOK_USD_KRW_SERIES.statCode
    || value.source.itemCode !== BOK_USD_KRW_SERIES.itemCode
    || value.source.frequency !== BOK_USD_KRW_SERIES.frequency
    || value.source.endpoint !== BOK_USD_KRW_SERIES.endpoint
    || !isIsoDateTime(value.source.generatedAt)) {
    throw new Error('Invalid USD/KRW FX source metadata')
  }

  let previousDate = ''
  const rates = value.rates.map((row) => {
    if (!isObject(row) || !isIsoDate(row.date) || typeof row.usdKrw !== 'number' || !Number.isFinite(row.usdKrw) || row.usdKrw <= 0) {
      throw new Error('Invalid USD/KRW FX rate row')
    }
    if (row.date <= previousDate) throw new Error('USD/KRW FX rates must be strictly ordered without duplicates')
    previousDate = row.date
    return { date: row.date, usdKrw: row.usdKrw }
  })

  if (value.coverage.from !== rates[0].date || value.coverage.to !== rates.at(-1)?.date) {
    throw new Error('USD/KRW FX coverage must match the first and last rate dates')
  }

  return {
    schemaVersion: 1,
    pair: 'USD/KRW',
    coverage: { from: value.coverage.from, to: value.coverage.to },
    rates,
    source: {
      ...BOK_USD_KRW_SERIES,
      generatedAt: value.source.generatedAt,
    },
  }
}
