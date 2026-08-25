import type { BaseRateSeries } from '../types/rates'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

export function parseBaseRateSeries(value: unknown): BaseRateSeries {
  if (!isObject(value) || value.schemaVersion !== 1 || value.name !== 'BOK_BASE_RATE') {
    throw new Error('Invalid BOK base-rate dataset header')
  }
  if (!isObject(value.coverage) || !isIsoDate(value.coverage.from) || !isIsoDate(value.coverage.to)) {
    throw new Error('Invalid BOK base-rate coverage')
  }
  if (!Array.isArray(value.rates) || value.rates.length === 0) throw new Error('Invalid BOK base-rate rows')
  if (!isObject(value.source)
    || value.source.provider !== 'Bank of Korea'
    || value.source.statCode !== '722Y001'
    || value.source.itemCode !== '0101000'
    || (value.source.mode !== 'bootstrap' && value.source.mode !== 'ecos')
    || typeof value.source.generatedAt !== 'string') {
    throw new Error('Invalid BOK base-rate source metadata')
  }

  let previousDate = ''
  const rates = value.rates.map((row) => {
    if (!isObject(row)
      || !isIsoDate(row.date)
      || typeof row.annualRate !== 'number'
      || !Number.isFinite(row.annualRate)
      || row.annualRate < 0
      || row.annualRate > 30) {
      throw new Error('Invalid BOK base-rate row')
    }
    if (row.date <= previousDate) throw new Error('BOK base rates must be strictly ordered')
    previousDate = row.date
    return { date: row.date, annualRate: row.annualRate }
  })

  return {
    schemaVersion: 1,
    name: 'BOK_BASE_RATE',
    coverage: { from: value.coverage.from, to: value.coverage.to },
    rates,
    source: {
      provider: 'Bank of Korea',
      statCode: '722Y001',
      itemCode: '0101000',
      mode: value.source.mode,
      generatedAt: value.source.generatedAt,
    },
  }
}
