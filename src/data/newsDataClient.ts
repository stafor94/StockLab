import { parseNewsManifest, parseNewsYearDataset } from './newsSchema'
import type { NewsItem, NewsManifest, NewsManifestYear, NewsYearDataset } from '../game/news/types'

const DEFAULT_NEWS_ROOT = `${import.meta.env.BASE_URL}data/news/`
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export class NewsDataLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NewsDataLoadError'
  }
}

export class NewsDataClient {
  private readonly jsonCache = new Map<string, Promise<unknown>>()
  private readonly yearCache = new Map<number, Promise<NewsYearDataset>>()
  private manifestPromise: Promise<NewsManifest> | null = null

  constructor(private readonly root = DEFAULT_NEWS_ROOT) {}

  private buildUrl(path: string): string {
    const base = this.root.endsWith('/') ? this.root : `${this.root}/`
    return `${base}${path.replace(/^\/+/, '')}`
  }

  private loadJson(path: string): Promise<unknown> {
    const url = this.buildUrl(path)
    const cached = this.jsonCache.get(url)
    if (cached) return cached
    const request = fetch(url).then(async (response) => {
      if (!response.ok) throw new NewsDataLoadError(`Failed to load ${url}: HTTP ${response.status}`)
      return response.json() as Promise<unknown>
    })
    this.jsonCache.set(url, request)
    void request.catch(() => this.jsonCache.delete(url))
    return request
  }

  async loadManifest(): Promise<NewsManifest> {
    if (this.manifestPromise) return this.manifestPromise
    this.manifestPromise = this.loadJson('manifest.json').then(parseNewsManifest)
    void this.manifestPromise.catch(() => { this.manifestPromise = null })
    return this.manifestPromise
  }

  private loadYear(entry: NewsManifestYear): Promise<NewsYearDataset> {
    const cached = this.yearCache.get(entry.year)
    if (cached) return cached
    const request = this.loadJson(entry.path).then((value) => {
      const dataset = parseNewsYearDataset(value)
      if (dataset.year !== entry.year) throw new NewsDataLoadError(`News year mismatch: expected ${entry.year}, got ${dataset.year}`)
      return dataset
    })
    this.yearCache.set(entry.year, request)
    void request.catch(() => this.yearCache.delete(entry.year))
    return request
  }

  async loadThrough(date: string): Promise<{ manifest: NewsManifest; items: NewsItem[] }> {
    if (!ISO_DATE.test(date)) throw new NewsDataLoadError(`Invalid news load date: ${date}`)
    const targetYear = Number.parseInt(date.slice(0, 4), 10)
    const manifest = await this.loadManifest()
    const entries = manifest.years.filter((entry) => entry.year <= targetYear)
    const datasets = await Promise.all(entries.map((entry) => this.loadYear(entry)))
    const items = datasets
      .flatMap((dataset) => dataset.items)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    return { manifest, items }
  }

  async loadAll(): Promise<{ manifest: NewsManifest; items: NewsItem[] }> {
    const manifest = await this.loadManifest()
    return this.loadThrough(manifest.coverage.to)
  }

  clearCache(): void {
    this.jsonCache.clear()
    this.yearCache.clear()
    this.manifestPromise = null
  }
}

export const newsDataClient = new NewsDataClient()
