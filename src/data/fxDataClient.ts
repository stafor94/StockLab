import { parseFxRateSeries } from './fxSchema'
import type { FxRateSeries } from '../types/fx'

const DEFAULT_FX_URL = `${import.meta.env.BASE_URL}data/fx/usd-krw.json`

export class FxDataLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FxDataLoadError'
  }
}

export class FxDataClient {
  private request: Promise<FxRateSeries> | null = null

  constructor(private readonly url = DEFAULT_FX_URL) {}

  loadUsdKrw(): Promise<FxRateSeries> {
    if (this.request) return this.request
    this.request = fetch(this.url).then(async (response) => {
      if (!response.ok) throw new FxDataLoadError(`Failed to load ${this.url}: HTTP ${response.status}`)
      return parseFxRateSeries(await response.json())
    })
    void this.request.catch(() => { this.request = null })
    return this.request
  }

  clearCache(): void {
    this.request = null
  }
}

export const fxDataClient = new FxDataClient()
