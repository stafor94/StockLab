import type { PositionValuation } from '../../game/portfolio/types'

export function selectTopPositionValuations(
  positions: PositionValuation[],
  limit = 4,
): PositionValuation[] {
  const maxItems = Math.max(0, Math.floor(limit))
  if (maxItems === 0) return []

  return positions
    .filter((position) => position.quantity > 0)
    .slice()
    .sort((left, right) => {
      if (left.marketValueKrw === null && right.marketValueKrw === null) return 0
      if (left.marketValueKrw === null) return 1
      if (right.marketValueKrw === null) return -1
      return right.marketValueKrw - left.marketValueKrw
    })
    .slice(0, maxItems)
}
