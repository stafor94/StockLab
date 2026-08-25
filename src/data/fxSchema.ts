import type { FxRateSeries } from '../types/fx'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

export function parseFxRateSeries(value: unknown): FxRateSeries {
  if (!isObject(value) || value.schemaVersion !== 1 || value.pair !== 'USD/KRW') {
    throw new Error('Invalid USD/KRW FX dataset header')
  }
  if (!isObject(value.coverage) || !isIsoDate(value.coverage.from) || !isIsoDate(value.coverage.to)) {
    throw new Error('Invalid USD/KRW FX coverage')
  }
  if (!Array.isArray(value.rates)) throw new Error('Invalid USD/KRW FX rates')
  if (!isObject(value.source)
    || value.source.provider !== 'Bank of Korea ECOS'
    || value.source.statCode !== '731Y001'
    || value.source.itemCode !== '0000001'
    || typeof value.source.generatedAt !== 'string') {
    throw new Error('Invalid USD/KRW FX source metadata')
  }

  let previousDate = ''
  const rates = value.rates.map((row) => {
    if (!isObject(row) || !isIsoDate(row.date) || typeof row.usdKrw !== 'number' || !Number.isFinite(row.usdKrw) || row.usdKrw <= 0) {
      throw new Error('Invalid USD/KRW FX rate row')
    }
    if (row.date <= previousDate) throw new Error('USD/KRW FX rates must be strictly ordered')
    previousDate = row.date
    return { date: row.date, usdKrw: row.usdKrw }
  })

  return {
    schemaVersion: 1,
    pair: 'USD/KRW',
    coverage: { from: value.coverage.from, to: value.coverage.to },
    rates,
    source: {
      provider: 'Bank of Korea ECOS',
      statCode: '731Y001',
      itemCode: '0000001',
      generatedAt: value.source.generatedAt,
    },
  }
}
