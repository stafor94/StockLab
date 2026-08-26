import type { BaseRateSeries } from '../types/rates'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function parseBaseRateSeries(value: unknown): BaseRateSeries {
  if (!isObject(value) || value.schemaVersion !== 1 || value.name !== 'BOK_BASE_RATE') {
    throw new Error('Invalid BOK base-rate dataset header')
  }
  if (!isObject(value.coverage) || !isIsoDate(value.coverage.from) || !isIsoDate(value.coverage.to)) {
    throw new Error('Invalid BOK base-rate coverage')
  }
  if (value.coverage.from > value.coverage.to) throw new Error('Invalid BOK base-rate coverage order')
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
  let previousAnnualRate: number | null = null
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
    if (previousAnnualRate === row.annualRate) {
      throw new Error('BOK base rates must contain effective changes only')
    }
    previousDate = row.date
    previousAnnualRate = row.annualRate
    return { date: row.date, annualRate: row.annualRate }
  })

  if (rates[0].date > value.coverage.from) {
    throw new Error('BOK base-rate coverage requires a carry-in rate')
  }
  if (rates.at(-1)!.date > value.coverage.to) {
    throw new Error('BOK base rates must not contain future effective rows')
  }

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
