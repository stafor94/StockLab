import type { MarketIndexQuote } from '../../../game/market/marketIndexQuote'
import { EmptyState, SectionHeader } from '../../../components/ui'
import type { CalendarLoadStatus } from '../../market/useMarketCalendars'
import type { MarketIndexLoadStatus } from '../../market/useMarketIndices'

const categoryLabels: Record<string, string> = { COMPANY: '기업', MARKET: '시장', MACRO: '거시경제', POLICY: '정책' }
const indexValueFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const indexChangeFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const indexRateFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
type LoadStatus = 'loading' | 'ready' | 'error'

interface NewsItemSummary {
  id: string
  date: string
  category: string
  headline: string
}

interface EventSummary {
  eventId: string
  title: string
  note: string
}

interface HomeFeedSectionsProps {
  marketStatusLabel: string
  marketIndexQuotes: MarketIndexQuote[]
  marketIndexStatus: MarketIndexLoadStatus
  marketIndexError: string | null
  nextGameDate: string | null
  catalogAssetCount: number
  calendarStatus: CalendarLoadStatus
  calendarError: string | null
  todayNews: NewsItemSummary[]
  newsStatus: LoadStatus
  newsError: string | null
  todayCorporateEvents: EventSummary[]
  corporateStatus: LoadStatus
  corporateError: string | null
  onOpenMarket: () => void
  onOpenNews: () => void
}

function signedValue(value: number, formatter: Intl.NumberFormat): string {
  if (value === 0) return formatter.format(0)
  return `${value > 0 ? '+' : '-'}${formatter.format(Math.abs(value))}`
}

function trendClass(change: number | null): string {
  if (change === null || change === 0) return 'neutral'
  return change > 0 ? 'positive' : 'negative'
}

export function HomeFeedSections(props: HomeFeedSectionsProps) {
  return (
    <div className="home-information-grid">
      <section className="home-list-section market-status-section">
        <SectionHeader title="오늘의 시장" actionLabel="시장 보기" onAction={props.onOpenMarket} />
        <div className="market-status-line"><span className={`status-indicator ${props.calendarStatus === 'error' ? 'danger' : ''}`} aria-hidden="true"/><div><strong>{props.marketStatusLabel}</strong><span>{props.nextGameDate ? `다음 게임일 ${props.nextGameDate}` : props.calendarError ? '시장 일정을 확인할 수 없습니다.' : '다음 게임일 확인 중'}</span></div></div>
        {props.marketIndexStatus === 'ready' && props.marketIndexQuotes.length > 0 ? (
          <div className="market-index-grid" aria-label="주요 지수">
            {props.marketIndexQuotes.map((quote) => {
              const trend = trendClass(quote.change)
              return (
                <div className="market-index-quote" data-market-index={quote.id} key={quote.id}>
                  <div className="market-index-heading"><span>{quote.alias}</span><small title={quote.valueDate}>{quote.valueLabel}</small></div>
                  <strong className="market-index-value">{indexValueFormatter.format(quote.value)}</strong>
                  <div className={`market-index-change ${trend}`}>
                    <span>{quote.change === null ? '—' : signedValue(quote.change, indexChangeFormatter)}</span>
                    <small>{quote.changeRate === null ? '' : `${signedValue(quote.changeRate, indexRateFormatter)}%`}</small>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={`market-index-state ${props.marketIndexStatus === 'error' ? 'danger-text' : ''}`} title={props.marketIndexError ?? undefined}>
            {props.marketIndexStatus === 'error' ? '주요 지수 데이터 확인 필요' : '주요 지수 확인 중'}
          </div>
        )}
        {props.calendarStatus === 'ready' && <div className="key-value-row muted-row"><span>현재 투자 가능 종목</span><strong>{props.catalogAssetCount}개</strong></div>}
      </section>

      <section className="home-list-section">
        <SectionHeader title="오늘의 뉴스" actionLabel="전체보기" onAction={props.onOpenNews} />
        {props.todayNews.length > 0 ? <div className="compact-feed-list">{props.todayNews.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={props.onOpenNews}><span>{categoryLabels[item.category] ?? item.category}</span><strong>{item.headline}</strong></button>)}</div> : <EmptyState title={props.newsStatus === 'ready' ? '오늘 공개된 뉴스가 없습니다.' : '뉴스를 확인하고 있습니다.'} description={props.newsStatus === 'error' ? props.newsError ?? undefined : undefined} />}
      </section>

      <section className="home-list-section">
        <SectionHeader title="기업 이벤트" meta={<span className="section-count">{props.todayCorporateEvents.length}건</span>} />
        {props.todayCorporateEvents.length > 0 ? <div className="event-mini-list">{props.todayCorporateEvents.map((event) => <div key={event.eventId}><strong>{event.title}</strong><span>{event.note}</span></div>)}</div> : <EmptyState title={props.corporateStatus === 'ready' ? '오늘 예정된 기업 이벤트가 없습니다.' : '기업 이벤트를 확인하고 있습니다.'} description={props.corporateStatus === 'error' ? props.corporateError ?? undefined : undefined} />}
      </section>
    </div>
  )
}
