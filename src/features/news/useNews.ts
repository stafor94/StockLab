import { useEffect, useState } from 'react'
import { newsDataClient } from '../../data/newsDataClient'
import type { NewsItem, NewsManifest } from '../../game/news/types'

interface NewsState {
  status: 'loading' | 'ready' | 'error'
  manifest: NewsManifest | null
  items: NewsItem[]
  error: string | null
}

export function useNews(): NewsState {
  const [state, setState] = useState<NewsState>({ status: 'loading', manifest: null, items: [], error: null })

  useEffect(() => {
    let active = true
    newsDataClient.loadAll().then(({ manifest, items }) => {
      if (active) setState({ status: 'ready', manifest, items, error: null })
    }).catch((error: unknown) => {
      if (active) setState({ status: 'error', manifest: null, items: [], error: error instanceof Error ? error.message : '뉴스 데이터를 불러오지 못했습니다.' })
    })
    return () => { active = false }
  }, [])

  return state
}
