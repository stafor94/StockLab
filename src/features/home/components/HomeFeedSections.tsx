import type { MajorMarketIndexCard } from '../../../game/market/marketIndexQuote'
import type { PositionValuation } from '../../../game/portfolio/types'
import { EmptyState, SectionHeader } from '../../../components/ui'
import type { AssetManifestItem } from '../../../types/market'
import { formatMoney, formatSignedMoney } from '../../../utils/money'
import type { CalendarLoadStatus } from '../../market/useMarketCalendars'
import type { MarketIndexLoadStatus } from '../../market/useMarketIndices'

const indexValueFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const indexChangeFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const indexRateFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quantityFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
type LoadStatus = 'loading' | 'ready' | 'error'

interface EventSummary {
  eventId: string
  title: string
  note: string
}

interface HomeFeedSectionsProps {
  marketStatusLabel: string
  marketIndexCards: MajorMarketIndexCard[]
  marketIndexStatus: MarketIndexLoadStatus
  marketIndexError: string | null
  nextGameDate: string | null
  catalogAssetCount: number
  calendarStatus: CalendarLoadStatus
  calendarError: string | null
  holdings: PositionValuation[]
  assets: AssetManifestItem[]
  todayCorporateEvents: EventSummary[]
  corporateStatus: LoadStatus
  corporateError: string | null
  onOpenMarket: () => void
  onOpenPortfolio: () => void
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
        <div className="market-status-line"><span className={`status-indicator ${props.calendarStatus === 'error' ? 'danger' : ''}`} aria-hidden="true"/><div><strong>{props.marketStatusLabel}</strong><span>{props.nextGameDate ? `다음 시장 이벤트 ${props.nextGameDate}` : props.calendarError ? '시장 일정을 확인할 수 없습니다.' : '다음 시장 이벤트 확인 중'}</span></div></div>
        {props.marketIndexStatus === 'ready' ? (
          <div className="market-index-grid" aria-label="주요 지수">
            {props.marketIndexCards.map((card) => {
              const quote = card.quote
              if (!quote) {
                const sourceUnavailable = card.status === 'source-unavailable'
                return (
                  <div className="market-index-quote market-index-unavailable" data-market-index={card.id} key={card.id} title={card.unavailableReason ?? undefined}>
                    <div className="market-index-heading"><span>{card.alias}</span><small>{sourceUnavailable ? '현재 미제공' : '확인 필요'}</small></div>
                    <strong className="market-index-value">—</strong>
                    <div className="market-index-change neutral">
                      <span>{sourceUnavailable ? '데이터 제공되지 않음' : '데이터 없음'}</span>
                    </div>
                  </div>
                )
              }

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

      <section className="home-list-section home-holdings-section">
        <SectionHeader title="보유 종목" actionLabel="전체보기" onAction={props.onOpenPortfolio} />
        {props.holdings.length > 0 ? (
          <div className="home-holdings-grid" aria-label="보유 종목 요약">
            {props.holdings.map((position) => {
              const asset = props.assets.find((item) => item.id === position.assetId)
              const trend = trendClass(position.unrealizedPnl)
              return (
                <article className="home-holding-card" data-home-holding={position.assetId} key={position.assetId}>
                  <div className="home-holding-heading">
                    <strong title={asset?.alias ?? position.assetId}>{asset?.alias ?? position.assetId}</strong>
                    <span>{quantityFormatter.format(position.quantity)}주</span>
                  </div>
                  <span className="home-holding-label">평가금액</span>
                  <strong className="home-holding-value financial-amount">{position.marketValue === null ? '가격 대기' : formatMoney(position.marketValue, position.currency)}</strong>
                  <div className={`home-holding-performance ${trend}`}>
                    <span>{position.unrealizedRate === null ? '수익률 계산 중' : `수익률 ${position.unrealizedRate >= 0 ? '+' : ''}${position.unrealizedRate.toFixed(2)}%`}</span>
                    <small>{position.unrealizedPnl === null ? '손익 계산 중' : `손익 ${formatSignedMoney(position.unrealizedPnl, position.currency)}`}</small>
                  </div>
                </article>
              )
            })}
          </div>
        ) : <EmptyState title="보유 중인 종목이 없습니다." />}
      </section>

      <section className="home-list-section">
        <SectionHeader title="기업 이벤트" meta={<span className="section-count">{props.todayCorporateEvents.length}건</span>} />
        {props.todayCorporateEvents.length > 0 ? <div className="event-mini-list">{props.todayCorporateEvents.map((event) => <div key={event.eventId}><strong>{event.title}</strong><span>{event.note}</span></div>)}</div> : <EmptyState title={props.corporateStatus === 'ready' ? '오늘 예정된 기업 이벤트가 없습니다.' : '기업 이벤트를 확인하고 있습니다.'} description={props.corporateStatus === 'error' ? props.corporateError ?? undefined : undefined} />}
      </section>
    </div>
  )
}
