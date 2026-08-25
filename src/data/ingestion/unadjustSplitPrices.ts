import type { DailyBar } from '../../types/market'

export interface EffectiveSplit {
  effectiveDate: string
  numerator: number
  denominator: number
}

export type SplitAdjustmentState = 'adjusted' | 'unadjusted' | 'ambiguous'

function splitFactor(split: EffectiveSplit): number {
  const factor = split.numerator / split.denominator
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`Invalid split ratio on ${split.effectiveDate}`)
  }
  return factor
}

function roundPrice(value: number): number {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000
}

export function classifySplitAdjustment(
  bars: DailyBar[],
  split: EffectiveSplit,
): SplitAdjustmentState {
  const factor = splitFactor(split)
  if (Math.abs(factor - 1) < 1e-12) return 'unadjusted'

  let before: DailyBar | undefined
  let after: DailyBar | undefined
  for (const bar of bars) {
    if (bar.date < split.effectiveDate) before = bar
    if (bar.date >= split.effectiveDate) {
      after = bar
      break
    }
  }
  if (!before || !after) return 'ambiguous'

  const observed = before.close / after.open
  if (!Number.isFinite(observed) || observed <= 0) return 'ambiguous'

  const adjustedDistance = Math.abs(Math.log(observed))
  const unadjustedDistance = Math.abs(Math.log(observed / factor))
  const separation = Math.abs(Math.log(factor))
  const margin = Math.max(0.08, separation * 0.18)

  if (adjustedDistance + margin < unadjustedDistance) return 'adjusted'
  if (unadjustedDistance + margin < adjustedDistance) return 'unadjusted'
  return 'ambiguous'
}

export function unadjustSplitPrices(
  bars: DailyBar[],
  splitAdjustedEvents: EffectiveSplit[],
): DailyBar[] {
  const events = [...splitAdjustedEvents].sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate),
  )
  for (let index = 1; index < events.length; index += 1) {
    if (events[index - 1].effectiveDate === events[index].effectiveDate) {
      throw new Error(`Duplicate split effective date ${events[index].effectiveDate}`)
    }
  }

  return bars.map((bar) => {
    let factor = 1
    for (const event of events) {
      if (bar.date >= event.effectiveDate) continue
      factor *= splitFactor(event)
    }
    if (Math.abs(factor - 1) < 1e-12) return { ...bar }

    return {
      date: bar.date,
      open: roundPrice(bar.open * factor),
      high: roundPrice(bar.high * factor),
      low: roundPrice(bar.low * factor),
      close: roundPrice(bar.close * factor),
      volume: Math.max(0, Math.round(bar.volume / factor)),
    }
  })
}
