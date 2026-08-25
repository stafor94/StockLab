import { parseBaseRateSeries } from './rateSchema'
import type { BaseRateSeries } from '../types/rates'

const DEFAULT_RATE_URL = `${import.meta.env.BASE_URL}data/rates/bok-base-rate.json`

export class RateDataLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateDataLoadError'
  }
}

export class RateDataClient {
  private request: Promise<BaseRateSeries> | null = null

  constructor(private readonly url = DEFAULT_RATE_URL) {}

  loadBaseRates(): Promise<BaseRateSeries> {
    if (this.request) return this.request
    this.request = fetch(this.url).then(async (response) => {
      if (!response.ok) throw new RateDataLoadError(`Failed to load ${this.url}: HTTP ${response.status}`)
      return parseBaseRateSeries(await response.json())
    })
    void this.request.catch(() => { this.request = null })
    return this.request
  }

  clearCache(): void {
    this.request = null
  }
}

export const rateDataClient = new RateDataClient()
