import { beforeEach, describe, expect, it } from 'vitest'
import { SAVE_SCHEMA_VERSION, SAVE_STORAGE_KEY } from '../game/save'
import { useGameStore } from './gameStore'

beforeEach(() => {
  localStorage.clear()
  useGameStore.setState({ favoriteAssetIds: [] })
  useGameStore.getState().resetGame()
})

describe('market favorites', () => {
  it('toggles favorites and persists them in the current save schema', () => {
    useGameStore.getState().toggleFavoriteAsset('K001')
    useGameStore.getState().toggleFavoriteAsset('U001')
    useGameStore.getState().toggleFavoriteAsset('K001')

    expect(useGameStore.getState().favoriteAssetIds).toEqual(['U001'])

    const persisted = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) ?? '{}') as {
      state?: { favoriteAssetIds?: string[] }
      version?: number
    }
    expect(persisted.version).toBe(SAVE_SCHEMA_VERSION)
    expect(persisted.state?.favoriteAssetIds).toEqual(['U001'])
  })

  it('preserves favorites when the gameplay state is reset', () => {
    useGameStore.getState().toggleFavoriteAsset('K001')
    useGameStore.setState({ krwCash: 123 })

    useGameStore.getState().resetGame()

    expect(useGameStore.getState().favoriteAssetIds).toEqual(['K001'])
    expect(useGameStore.getState().krwCash).toBe(10_000_000)
  })
})
