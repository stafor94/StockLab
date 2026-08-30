import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTrackedSecSharesSnapshots } from './sec-shares-snapshots'

const temporaryRoots: string[] = []

async function createSnapshotRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'stocklab-sec-shares-'))
  temporaryRoots.push(root)
  await mkdir(root, { recursive: true })
  return root
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('tracked SEC shares snapshot loader', () => {
  it('loads and orders a synthetic game-ID snapshot without SEC network access', async () => {
    const root = await createSnapshotRoot()
    await writeFile(join(root, 'U900.json'), JSON.stringify([
      { asOfDate: '2026-04-01', availableFrom: '2026-04-08', sharesOutstanding: 120, form: '10-Q' },
      { asOfDate: '2026-01-01', availableFrom: '2026-01-08', sharesOutstanding: 100, form: '10-K' },
    ]), 'utf8')
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network access is forbidden')))
    vi.stubGlobal('fetch', fetchSpy)

    await expect(loadTrackedSecSharesSnapshots(root, 'U900')).resolves.toEqual([
      { asOfDate: '2026-01-01', availableFrom: '2026-01-08', sharesOutstanding: 100, form: '10-K' },
      { asOfDate: '2026-04-01', availableFrom: '2026-04-08', sharesOutstanding: 120, form: '10-Q' },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fails fast when the per-asset tracked snapshot is missing', async () => {
    const root = await createSnapshotRoot()
    await expect(loadTrackedSecSharesSnapshots(root, 'U901')).rejects.toThrow(
      /U901: missing tracked SEC shares snapshot/,
    )
  })
})
