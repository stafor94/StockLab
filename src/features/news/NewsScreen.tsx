import { useMemo, useState } from 'react'
import { getNewsRevealDate, getVisibleNewsItems } from '../../game/news/newsEngine'
import type { NewsItem } from '../../game/news/types'
import { useGameStore } from '../../stores/gameStore'
import { useMarketCalendars } from '../market/useMarketCalendars'
import { useNews } from './useNews'

const categoryLabel = { COMPANY: '기업', MARKET: '시장', MACRO: '거시경제', POLICY: '정책' } as const
const marketLabel = { KR: '한국', US: '미국', GLOBAL: '글로벌' } as const

export function NewsScreen() {
  const gameDate = useGameStore((state) => state.gameDate)
  const readNewsIds = useGameStore((state) => state.readNewsIds)
  const markNewsRead = useGameStore((state) => state.markNewsRead)
  const { calendars } = useMarketCalendars()
  const news = useNews()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const gameDates = useMemo(() => calendars ? [...new Set([...calendars.KR.tradingDates, ...calendars.US.tradingDates])].sort() : [], [calendars])
  const visible = useMemo(() => calendars ? getVisibleNewsItems(news.items, gameDate, gameDates) : [], [calendars, gameDate, gameDates, news.items])
  const selected = visible.find((item) => item.id === selectedId) ?? null

  const openArticle = (item: NewsItem) => {
    markNewsRead(item.id)
    setSelectedId(item.id)
  }

  return (
    <main className="dashboard news-screen">
      <section className="panel news-browser-panel">
        <div className="panel-heading">
          <div><p className="section-label">HISTORICAL NEWS</p><h2>뉴스</h2></div>
          <span className="count-badge">{visible.length}</span>
        </div>
        <p className="news-policy">게임 날짜까지 실제로 공개된 정보만 표시합니다. 상세 기사는 역사적 사실을 바탕으로 게임용으로 새로 작성된 요약문입니다.</p>
        {news.status === 'error' ? <div className="empty-state"><strong>뉴스 데이터 오류</strong><p>{news.error}</p></div> : visible.length === 0 ? <div className="empty-state"><strong>{news.status === 'ready' ? '공개된 뉴스가 없습니다.' : '뉴스를 불러오는 중입니다.'}</strong><p>권위 있는 출처로 큐레이션된 뉴스가 추가되기 전에는 임의의 기사를 생성하지 않습니다.</p></div> : <div className="news-list">{visible.map((item) => {
          const unread = !readNewsIds.includes(item.id)
          return <button type="button" className={`news-list-item ${unread ? 'unread' : ''}`} key={item.id} onClick={() => openArticle(item)}><span className="news-list-meta">{item.date} · {marketLabel[item.market]} · {categoryLabel[item.category]}{item.important ? ' · 중요' : ''}</span><strong>{item.headline}</strong><p>{item.summary}</p></button>
        })}</div>}
      </section>

      <section className="panel news-article-panel">
        {selected ? <article>
          <p className="section-label">{marketLabel[selected.market]} · {categoryLabel[selected.category]}</p>
          <h2>{selected.headline}</h2>
          <div className="news-article-meta"><span>사건일 {selected.date}</span><span>공개 {getNewsRevealDate(selected, gameDates) ?? '확인 불가'}</span><span>{selected.timing}</span></div>
          <p className="news-article-summary">{selected.summary}</p>
          <div className="news-article-body">{selected.article.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          {(selected.relatedSectors.length > 0 || selected.relatedAssetIds.length > 0) && <div className="news-related"><strong>관련 항목</strong><span>{[...selected.relatedSectors, ...selected.relatedAssetIds].join(' · ')}</span></div>}
        </article> : <div className="empty-state"><strong>기사를 선택하세요.</strong><p>목록에서 헤드라인을 선택하면 상세 내용을 확인할 수 있습니다.</p></div>}
      </section>
    </main>
  )
}
