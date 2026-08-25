import { useMemo, useState } from 'react'
import type { AssetCurrency, DailyBar } from '../../types/market'
import { getChartBars, type ChartRange } from './chartData'

const ranges: ChartRange[] = ['1M', '3M', '1Y', 'ALL']

interface CandlestickChartProps {
  bars: DailyBar[]
  gameDate: string
  currency: AssetCurrency
}

function formatPrice(value: number, currency: AssetCurrency): string {
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(value)
}

export function CandlestickChart({ bars, gameDate, currency }: CandlestickChartProps) {
  const [range, setRange] = useState<ChartRange>('3M')
  const visibleBars = useMemo(() => getChartBars(bars, gameDate, range), [bars, gameDate, range])

  const geometry = useMemo(() => {
    if (visibleBars.length === 0) return null
    const min = Math.min(...visibleBars.map((bar) => bar.low))
    const max = Math.max(...visibleBars.map((bar) => bar.high))
    const span = Math.max(max - min, Math.abs(max) * 0.01, 1)
    return { min, max, span }
  }, [visibleBars])

  return (
    <div className="candlestick-shell">
      <div className="chart-range-tabs" aria-label="차트 기간">
        {ranges.map((item) => (
          <button
            className={range === item ? 'active' : ''}
            key={item}
            onClick={() => setRange(item)}
            type="button"
          >
            {item === 'ALL' ? '전체' : item}
          </button>
        ))}
      </div>

      {!geometry ? (
        <div className="chart-empty">
          <strong>표시할 과거 가격이 없습니다.</strong>
          <span>개장 전에는 당일 OHLC를 공개하지 않습니다.</span>
        </div>
      ) : (
        <div className="chart-scroll">
          <svg
            className="candlestick-chart"
            viewBox="0 0 1000 320"
            role="img"
            aria-label={`${range} 캔들 차트, ${visibleBars.length}개 거래일`}
          >
            <line className="chart-grid-line" x1="48" y1="32" x2="970" y2="32" />
            <line className="chart-grid-line" x1="48" y1="160" x2="970" y2="160" />
            <line className="chart-grid-line" x1="48" y1="288" x2="970" y2="288" />
            <text className="chart-axis-label" x="4" y="37">{formatPrice(geometry.max, currency)}</text>
            <text className="chart-axis-label" x="4" y="293">{formatPrice(geometry.min, currency)}</text>
            {visibleBars.map((bar, index) => {
              const plotTop = 32
              const plotHeight = 256
              const plotLeft = 52
              const plotWidth = 914
              const step = plotWidth / Math.max(visibleBars.length, 1)
              const x = plotLeft + step * index + step / 2
              const y = (price: number) => plotTop + ((geometry.max - price) / geometry.span) * plotHeight
              const candleWidth = Math.max(0.8, Math.min(8, step * 0.62))
              const openY = y(bar.open)
              const closeY = y(bar.close)
              const highY = y(bar.high)
              const lowY = y(bar.low)
              const rising = bar.close >= bar.open
              const bodyTop = Math.min(openY, closeY)
              const bodyHeight = Math.max(1.2, Math.abs(closeY - openY))
              const className = rising ? 'candle candle-up' : 'candle candle-down'

              return (
                <g className={className} key={bar.date}>
                  <line x1={x} y1={highY} x2={x} y2={lowY} />
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    rx="0.6"
                  />
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
