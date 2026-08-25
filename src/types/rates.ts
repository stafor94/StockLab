export interface BaseRatePoint {
  date: string
  annualRate: number
}

export interface BaseRateSeries {
  schemaVersion: 1
  name: 'BOK_BASE_RATE'
  coverage: {
    from: string
    to: string
  }
  rates: BaseRatePoint[]
  source: {
    provider: 'Bank of Korea'
    statCode: '722Y001'
    itemCode: '0101000'
    mode: 'bootstrap' | 'ecos'
    generatedAt: string
  }
}
