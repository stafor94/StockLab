import { afterEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { resumeGameClockAfterMarketSessionRecovery } from './marketSessionRecovery'

afterEach(() => {
  useGameStore.getState().resetGame()
})

describe('market session recovery clock restore', () => {
  it('preserves the opened session and unrelated pending orders', () => {
    const initial = useGameStore.getState()
    const pendingOrders = [{ id: 'sentinel-order' }] as unknown as typeof initial.pendingOrders
    const marketSessions = {
      ...initial.marketSessions,
      US: { phase: 'opened' as const, tradingDate: '2018-03-12' },
    }

    useGameStore.setState({
      gameTimestamp: '2018-03-12T13:30:00.000Z',
      gameDisplayTimestamp: '2018-03-12T13:30:00.000Z',
      gameDate: '2018-03-12',
      marketSessions,
      pendingOrders,
    })

    resumeGameClockAfterMarketSessionRecovery(
      '2018-03-12T15:00:00.000Z',
      '2018-03-12T15:00:00.000Z',
    )

    const recovered = useGameStore.getState()
    expect(recovered.gameTimestamp).toBe('2018-03-12T15:00:00.000Z')
    expect(recovered.gameDisplayTimestamp).toBe('2018-03-12T15:00:00.000Z')
    expect(recovered.gameDate).toBe('2018-03-13')
    expect(recovered.marketSessions).toBe(marketSessions)
    expect(recovered.pendingOrders).toBe(pendingOrders)
  })
})
