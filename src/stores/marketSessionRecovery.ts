import { getKstGameDate } from '../game/calendar/marketTimeline'
import { useGameStore } from './gameStore'

export function resumeGameClockAfterMarketSessionRecovery(
  gameTimestamp: string,
  gameDisplayTimestamp: string,
) {
  useGameStore.setState({
    gameTimestamp,
    gameDisplayTimestamp,
    gameDate: getKstGameDate(gameTimestamp),
  })
}
