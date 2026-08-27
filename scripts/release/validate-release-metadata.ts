import { readFileSync } from 'node:fs'

interface PackageMetadata {
  version: string
}

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

export function parseStableSemver(version: string): [number, number, number] {
  const match = SEMVER_PATTERN.exec(version)
  if (!match) throw new Error(`Application version must use MAJOR.MINOR.PATCH: ${version}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareStableSemver(left: string, right: string): number {
  const leftParts = parseStableSemver(left)
  const rightParts = parseStableSemver(right)
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1
  }
  return 0
}

export function validateReleaseMetadata(currentVersion: string, baseVersion: string | null, changelog: string): void {
  parseStableSemver(currentVersion)
  const escapedVersion = currentVersion.replace(/\./g, '\\.')
  const releaseHeading = new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm')
  if (!releaseHeading.test(changelog)) {
    throw new Error(`CHANGELOG.md must contain a dated release section for ${currentVersion}`)
  }

  if (baseVersion !== null && compareStableSemver(currentVersion, baseVersion) <= 0) {
    throw new Error(`Every main-targeted change must bump the app version above ${baseVersion}; found ${currentVersion}`)
  }
}

function readPackageMetadata(content: string): PackageMetadata {
  const parsed = JSON.parse(content) as Partial<PackageMetadata>
  if (!parsed.version || typeof parsed.version !== 'string') throw new Error('package.json is missing a version')
  return { version: parsed.version }
}

function main(): void {
  const currentVersion = readPackageMetadata(readFileSync('package.json', 'utf8')).version
  const changelog = readFileSync('CHANGELOG.md', 'utf8')
  const baseVersion = process.env.RELEASE_BASE_VERSION?.trim() || null
  validateReleaseMetadata(currentVersion, baseVersion, changelog)
  console.log(`Release metadata validated for ${currentVersion}${baseVersion ? ` (previous ${baseVersion})` : ''}.`)
}

if (process.argv[1]?.endsWith('validate-release-metadata.ts')) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
