import { getReturnBadge } from '../../game/portfolio/portfolioEngine'
import { usePortfolioValuation } from './usePortfolioValuation'

const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

function money(value: number | null): string {
  return value === null ? '평가 대기' : `₩${krw.format(Math.round(value))}`
}

function signedMoney(value: number | null): string {
  if (value === null) return '평가 대기'
  return `${value >= 0 ? '+' : '-'}₩${krw.format(Math.abs(Math.round(value)))}`
}

export function PortfolioScreen() {
  const { snapshot, assets, loading } = usePortfolioValuation()
  const returnRate = snapshot.strategyReturnRate ?? 0
  const badge = getReturnBadge(returnRate)
  const nextGap = badge.nextMinReturn === null ? null : Math.max(0, badge.nextMinReturn - returnRate)

  return (
    <main className="portfolio-screen">
      <section className="panel portfolio-hero">
        <div><p className="section-label">PORTFOLIO</p><h2>내 포트폴리오</h2><strong>{money(snapshot.grossAssetsKrw)}</strong><span className={returnRate >= 0 ? 'positive' : 'negative'}>{snapshot.strategyReturnRate === null ? '실제 가격 데이터 연결 후 계산' : `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}%`}</span></div>
        <div className="rank-badge"><span>현재 등급</span><strong>{badge.label}</strong><small>{nextGap === null ? '최고 등급 달성' : `다음 등급까지 ${nextGap.toFixed(2)}%p`}</small></div>
      </section>

      {!snapshot.valuationComplete && <section className="panel portfolio-warning"><strong>일부 평가정보를 계산할 수 없습니다.</strong><p>{loading ? '보유 종목의 실제 과거 가격을 불러오는 중입니다.' : snapshot.missingPriceAssetIds.length > 0 ? `가격 데이터 미연결: ${snapshot.missingPriceAssetIds.join(', ')}` : 'USD 자산 평가를 위한 한국은행 환율 데이터가 필요합니다.'}</p></section>}

      <section className="portfolio-summary-grid" aria-label="포트폴리오 요약">
        <article className="panel portfolio-metric"><span>전략 성과 기준자산</span><strong>{money(snapshot.strategyCapitalKrw)}</strong><small>현재 총자산 + 누적 대출원금 상환</small></article>
        <article className="panel portfolio-metric"><span>순자산</span><strong>{money(snapshot.netWorthKrw)}</strong><small>총자산 - 대출원금 - 미지급이자</small></article>
        <article className="panel portfolio-metric"><span>미실현 손익</span><strong className={(snapshot.unrealizedPnlKrw ?? 0) >= 0 ? 'positive' : 'negative'}>{signedMoney(snapshot.unrealizedPnlKrw)}</strong><small>현재 알려진 가격 기준</small></article>
        <article className="panel portfolio-metric"><span>실현 매매손익</span><strong className={(snapshot.realizedPnlKrw ?? 0) >= 0 ? 'positive' : 'negative'}>{signedMoney(snapshot.realizedPnlKrw)}</strong><small>{snapshot.realizedPnlIncomplete ? '구버전 매도기록 일부는 원가 미보존' : '매도비용 반영 · 매수수수료는 전략수익률에 반영'}</small></article>
      </section>

      <section className="panel badge-progress-panel">
        <div className="panel-heading"><div><p className="section-label">RETURN RANK</p><h2>수익률 배지</h2></div><span className="count-badge">{badge.label}</span></div>
        <div className="badge-track">{['회복 모드','시장 견습생','초보 투자자','성장 투자자','숙련 투자자','큰손','시장의 고수','월가의 전설'].map((label) => <span className={label === badge.label ? 'active' : ''} key={label}>{label}</span>)}</div>
        <p>등급은 대출 원금상환을 투자손실로 보지 않는 게임 수익률을 기준으로 계산합니다. 이자·세금·수수료·환전비용은 현금을 감소시키므로 성과에 그대로 반영됩니다.</p>
      </section>

      <section className="panel holdings-panel">
        <div className="panel-heading"><div><p className="section-label">HOLDINGS</p><h2>보유 자산</h2></div><span className="count-badge">{snapshot.positions.length}</span></div>
        {snapshot.positions.length === 0 ? <div className="empty-state"><strong>보유 중인 종목이 없습니다.</strong><p>시장 화면에서 실제 역사적 시가 기준 주문을 접수할 수 있습니다.</p></div> : <div className="holding-list">{snapshot.positions.map((position) => {
          const asset = assets.find((item) => item.id === position.assetId)
          return <article key={position.assetId}><div><strong>{asset?.alias ?? position.assetId}</strong><span>{position.currency} · {position.quantity}주 · 평균 {number.format(position.averagePrice)}</span></div><div className="holding-values"><strong>{position.marketValue === null ? '가격 대기' : `${position.currency === 'KRW' ? '₩' : '$'}${number.format(position.marketValue)}`}</strong><span className={(position.unrealizedPnl ?? 0) >= 0 ? 'positive' : 'negative'}>{position.unrealizedRate === null ? '-' : `${position.unrealizedRate >= 0 ? '+' : ''}${position.unrealizedRate.toFixed(2)}%`}</span><small>{position.priceDate ? `${position.priceDate} ${position.priceSource === 'today-open' ? '시가' : '종가'}` : '실제 가격 데이터 미연결'}</small></div></article>
        })}</div>}
      </section>

      <section className="panel portfolio-footnote"><span>누적 거래비용</span><strong>{money(snapshot.cumulativeFeesKrw)}</strong><p>실현 매매손익은 v0.11.0 이후 매도부터 당시 보유 평균가격을 원가로 저장합니다. 전체 게임 성과는 계좌 자산의 실제 현금흐름을 기준으로 하므로 구버전 거래도 수익률에서 누락되지 않습니다.</p></section>
    </main>
  )
}
