export interface FxRatePoint {
  date: string
  usdKrw: number
}

export interface FxRateSeries {
  schemaVersion: 1
  pair: 'USD/KRW'
  coverage: {
    from: string
    to: string
  }
  rates: FxRatePoint[]
  source: {
    provider: 'Bank of Korea ECOS'
    statCode: '731Y001'
    itemCode: '0000001'
    generatedAt: string
  }
}
