import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createInitialSave,
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  type GameSave,
} from '../game/save'

interface GameStore extends GameSave {
  setGameDate: (gameDate: string) => void
  resetGame: () => void
}

const initialSave = createInitialSave()

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      ...initialSave,
      setGameDate: (gameDate) => set({ gameDate }),
      resetGame: () => set(createInitialSave()),
    }),
    {
      name: SAVE_STORAGE_KEY,
      version: SAVE_SCHEMA_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        gameDate: state.gameDate,
        krwCash: state.krwCash,
        usdCash: state.usdCash,
        loanPrincipal: state.loanPrincipal,
        loanStatus: state.loanStatus,
        consecutiveMissedInterestMonths: state.consecutiveMissedInterestMonths,
      }),
    },
  ),
)
