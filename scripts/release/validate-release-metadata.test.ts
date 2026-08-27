import { describe, expect, it } from 'vitest'
import { compareStableSemver, validateReleaseMetadata } from './validate-release-metadata'

const changelog = (version: string) => `# Changelog\n\n## [Unreleased]\n\n## [${version}] - 2026-08-28\n\n### Fixed\n- Example\n`

describe('release metadata guard', () => {
  it('orders stable semantic versions', () => {
    expect(compareStableSemver('0.28.1', '0.28.0')).toBe(1)
    expect(compareStableSemver('0.28.0', '0.28.0')).toBe(0)
    expect(compareStableSemver('0.27.9', '0.28.0')).toBe(-1)
  })

  it('accepts a bumped version with a matching dated changelog section', () => {
    expect(() => validateReleaseMetadata('0.28.1', '0.28.0', changelog('0.28.1'))).not.toThrow()
  })

  it('rejects a main-targeted change without a version bump', () => {
    expect(() => validateReleaseMetadata('0.28.0', '0.28.0', changelog('0.28.0')))
      .toThrow('must bump the app version above 0.28.0')
  })

  it('rejects a version bump without its changelog release section', () => {
    expect(() => validateReleaseMetadata('0.28.1', '0.28.0', changelog('0.28.0')))
      .toThrow('CHANGELOG.md must contain a dated release section for 0.28.1')
  })
})
