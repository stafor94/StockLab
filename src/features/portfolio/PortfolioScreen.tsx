import { EmptyState, SectionHeader } from '../../components/ui'
import { getReturnBadge } from '../../game/portfolio/portfolioEngine'
import { PortfolioHoldings } from './PortfolioHoldings'
import { usePortfolioValuation } from './usePortfolioValuation'

const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
function money(value: number | null): string { return value === null ? '평가 대기' : `₩${krw.format(Math.round(value))}` }
function signedMoney(value: number | null): string { if (value === null) return '평가 대기'; return `${value >= 0 ? '+' : '-'}₩${krw.format(Math.abs(Math.round(value)))}` }

export function PortfolioScreen() {
  const { snapshot, assets, loading } = usePortfolioValuation()
  const returnRate = snapshot.strategyReturnRate ?? 0
  const badge = getReturnBadge(returnRate)

  return (
    <main className="portfolio-screen">
      <section className="portfolio-hero">
        <p className="section-kicker">내 투자</p>
        <strong className="financial-amount financial-amount-display">{money(snapshot.grossAssetsKrw)}</strong>
        <div className="portfolio-return-line"><span className={returnRate >= 0 ? 'positive' : 'negative'}>{snapshot.strategyReturnRate === null ? '수익률 계산 중' : `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}%`}</span><span>·</span><span>{badge.label}</span></div>
        <div className="portfolio-core-metrics"><div><span>순자산</span><strong>{money(snapshot.netWorthKrw)}</strong></div><div><span>평가손익</span><strong className={(snapshot.unrealizedPnlKrw ?? 0) >= 0 ? 'positive' : 'negative'}>{signedMoney(snapshot.unrealizedPnlKrw)}</strong></div><div><span>실현손익</span><strong className={(snapshot.realizedPnlKrw ?? 0) >= 0 ? 'positive' : 'negative'}>{signedMoney(snapshot.realizedPnlKrw)}</strong></div></div>
      </section>

      {!snapshot.valuationComplete && <section className="inline-warning" role="status"><strong>일부 평가정보를 계산할 수 없습니다.</strong><p>{loading ? '보유 종목의 가격을 불러오는 중입니다.' : snapshot.missingPriceAssetIds.length > 0 ? `가격 데이터 확인 필요: ${snapshot.missingPriceAssetIds.join(', ')}` : 'USD 자산 평가를 위한 환율 데이터가 필요합니다.'}</p></section>}

      <PortfolioHoldings positions={snapshot.positions} assets={assets}/>

      <section className="portfolio-detail-section">
        <SectionHeader title="성과 상세" />
        <div className="detail-row-list">
          <div><span>전략 성과 기준자산</span><strong>{money(snapshot.strategyCapitalKrw)}</strong></div>
          <div><span>누적 거래비용</span><strong>{money(snapshot.cumulativeFeesKrw)}</strong></div>
          <div><span>투자자 등급</span><strong>{badge.label}</strong></div>
        </div>
        {snapshot.positions.length === 0 && <EmptyState title="첫 투자를 시작해 보세요." description="시장 화면에서 현재 게임 날짜에 거래 가능한 종목을 확인할 수 있습니다." />}
      </section>
    </main>
  )
}
