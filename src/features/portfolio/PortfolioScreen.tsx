import { useState } from 'react'
import { EmptyState, SectionHeader } from '../../components/ui'
import { getReturnBadge } from '../../game/portfolio/portfolioEngine'
import type { PositionValuation } from '../../game/portfolio/types'
import { getSettlementDate } from '../../game/settlement/settlementRules'
import { useGameStore } from '../../stores/gameStore'
import type { AssetManifestItem } from '../../types/market'
import { formatMoney, formatSignedMoney } from '../../utils/money'
import { useMarketCalendars } from '../market/useMarketCalendars'
import { TradingDialog } from '../trading/TradingDialog'
import { PortfolioHoldings } from './PortfolioHoldings'
import { usePortfolioValuation } from './usePortfolioValuation'

function money(value: number | null): string { return value === null ? '평가 대기' : formatMoney(Math.round(value), 'KRW') }
function signedMoney(value: number | null): string { return value === null ? '평가 대기' : formatSignedMoney(Math.round(value), 'KRW') }

export function PortfolioScreen() {
  const game = useGameStore()
  const { snapshot, assets, loading } = usePortfolioValuation()
  const { calendars } = useMarketCalendars()
  const [orderAsset, setOrderAsset] = useState<AssetManifestItem | null>(null)
  const returnRate = snapshot.strategyReturnRate ?? 0
  const badge = getReturnBadge(returnRate)

  const isOrderAvailable = (position: PositionValuation, asset: AssetManifestItem) => {
    const restriction = game.assetRestrictions[asset.id]
    return Boolean(
      calendars
      && game.marketSessionPhase === 'opened'
      && position.priceDate === game.gameDate
      && position.priceSource === 'today-open'
      && !restriction?.halted
      && !restriction?.delisted,
    )
  }

  const orderSettlementDate = orderAsset && calendars
    ? getSettlementDate(orderAsset.market, game.gameDate, calendars[orderAsset.market]) ?? undefined
    : undefined

  return (
    <main className="portfolio-screen">
      <section className="portfolio-hero">
        <p className="section-kicker">내 투자</p>
        <strong className="financial-amount financial-amount-display">{money(snapshot.grossAssetsKrw)}</strong>
        <div className="portfolio-return-line"><span className={returnRate >= 0 ? 'positive' : 'negative'}>{snapshot.strategyReturnRate === null ? '수익률 계산 중' : `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}%`}</span><span>·</span><span>{badge.label}</span></div>
        <div className="portfolio-core-metrics"><div><span>순자산</span><strong>{money(snapshot.netWorthKrw)}</strong></div><div><span>평가손익</span><strong className={(snapshot.unrealizedPnlKrw ?? 0) >= 0 ? 'positive' : 'negative'}>{signedMoney(snapshot.unrealizedPnlKrw)}</strong></div><div><span>실현손익</span><strong className={(snapshot.realizedPnlKrw ?? 0) >= 0 ? 'positive' : 'negative'}>{signedMoney(snapshot.realizedPnlKrw)}</strong></div></div>
      </section>

      {!snapshot.valuationComplete && <section className="inline-warning" role="status"><strong>일부 평가정보를 계산할 수 없습니다.</strong><p>{loading ? '보유 종목의 가격을 불러오는 중입니다.' : snapshot.missingPriceAssetIds.length > 0 ? `가격 데이터 확인 필요: ${snapshot.missingPriceAssetIds.join(', ')}` : 'USD 자산 평가를 위한 환율 데이터가 필요합니다.'}</p></section>}

      <PortfolioHoldings positions={snapshot.positions} assets={assets} isOrderAvailable={isOrderAvailable} onOpenOrder={setOrderAsset}/>

      <section className="portfolio-detail-section">
        <SectionHeader title="성과 상세" />
        <div className="detail-row-list">
          <div><span>전략 성과 기준자산</span><strong>{money(snapshot.strategyCapitalKrw)}</strong></div>
          <div><span>누적 거래비용</span><strong>{money(snapshot.cumulativeFeesKrw)}</strong></div>
          <div><span>투자자 등급</span><strong>{badge.label}</strong></div>
        </div>
        {snapshot.positions.length === 0 && <EmptyState title="첫 투자를 시작해 보세요." description="시장 화면에서 현재 게임 날짜에 거래 가능한 종목을 확인할 수 있습니다." />}
      </section>

      <TradingDialog
        asset={orderAsset}
        gameDate={game.gameDate}
        settlementDate={orderSettlementDate}
        initialSide="sell"
        onClose={() => setOrderAsset(null)}
      />
    </main>
  )
}
