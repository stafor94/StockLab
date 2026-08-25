import type { CalendarLoadStatus } from '../../market/useMarketCalendars'
import { EmptyState, SectionHeader } from '../../../components/ui'

const categoryLabels: Record<string, string> = { COMPANY: '기업', MARKET: '시장', MACRO: '거시경제', POLICY: '정책' }
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

export function HomeFeedSections(props: HomeFeedSectionsProps) {
  return (
    <div className="home-information-grid">
      <section className="home-list-section market-status-section">
        <SectionHeader title="오늘의 시장" actionLabel="시장 보기" onAction={props.onOpenMarket} />
        <div className="market-status-line"><span className={`status-indicator ${props.calendarStatus === 'error' ? 'danger' : ''}`} aria-hidden="true"/><div><strong>{props.marketStatusLabel}</strong><span>{props.nextGameDate ? `다음 게임일 ${props.nextGameDate}` : props.calendarError ? '시장 일정을 확인할 수 없습니다.' : '다음 게임일 확인 중'}</span></div></div>
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
