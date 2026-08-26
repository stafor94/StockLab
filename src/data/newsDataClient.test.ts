import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsDataClient } from './newsDataClient'

const manifest = {
  schemaVersion: 1,
  coverage: { from: '2018-01-01', to: '2020-12-31' },
  source: { mode: 'curated', generatedAt: null },
  years: [
    { year: 2018, path: '2018.json' },
    { year: 2019, path: '2019.json' },
    { year: 2020, path: '2020.json' },
  ],
}

const datasets = Object.fromEntries([2018, 2019, 2020].map((year) => [
  `${year}.json`,
  { schemaVersion: 1, year, items: [] },
]))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('NewsDataClient', () => {
  it('loads only year files through the requested year and reuses cached years', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input).split('/').at(-1) ?? ''
      const body = path === 'manifest.json' ? manifest : datasets[path]
      return {
        ok: Boolean(body),
        status: body ? 200 : 404,
        json: async () => body,
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new NewsDataClient('https://example.test/data/news/')
    await client.loadThrough('2019-12-31')

    const firstUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(firstUrls).toHaveLength(3)
    expect(firstUrls).toContain('https://example.test/data/news/manifest.json')
    expect(firstUrls).toContain('https://example.test/data/news/2018.json')
    expect(firstUrls).toContain('https://example.test/data/news/2019.json')
    expect(firstUrls).not.toContain('https://example.test/data/news/2020.json')

    await client.loadThrough('2020-01-02')

    const allUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(allUrls).toHaveLength(4)
    expect(allUrls.filter((url) => url.endsWith('/2018.json'))).toHaveLength(1)
    expect(allUrls.filter((url) => url.endsWith('/2019.json'))).toHaveLength(1)
    expect(allUrls.filter((url) => url.endsWith('/2020.json'))).toHaveLength(1)
  })

  it('rejects malformed load dates without fetching data', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const client = new NewsDataClient('https://example.test/data/news/')

    await expect(client.loadThrough('2020')).rejects.toThrow('Invalid news load date')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
