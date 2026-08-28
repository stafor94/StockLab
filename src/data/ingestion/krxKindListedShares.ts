type HtmlEntityMap = Record<string, string>

const NAMED_ENTITIES: HtmlEntityMap = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

export interface KrxKindListedSharesExpectation {
  symbol: string
  isin?: string
  expectedName?: string
}

export interface KrxKindListedSharesRow {
  symbol: string
  securityCode: string
  name: string
  listedShares: number
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

function cellText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function parseListedSharesThousands(value: string): number | null {
  const parsed = Number(value.replaceAll(',', '').trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  const shares = parsed * 1_000
  return Number.isSafeInteger(shares) ? shares : null
}

function legacyShortCodeFromSecurityCode(value: string): string | null {
  const trimmed = value.trim()
  if (/^\d{6}$/.test(trimmed)) return trimmed
  const isinLike = trimmed.match(/^KR7(\d{6})\d{3}$/)
  return isinLike?.[1] ?? null
}

function normalizedName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
}

function matchesExpectation(
  securityCode: string,
  name: string,
  expectation: KrxKindListedSharesExpectation,
): boolean {
  if (expectation.isin) return securityCode.toUpperCase() === expectation.isin.toUpperCase()
  if (securityCode === expectation.symbol) return true
  if (expectation.expectedName && normalizedName(name) === normalizedName(expectation.expectedName)) return true
  return legacyShortCodeFromSecurityCode(securityCode) === expectation.symbol
}

export function parseKrxKindListedSharesHtml(
  html: string,
  expectations: readonly KrxKindListedSharesExpectation[],
): KrxKindListedSharesRow[] {
  const headers = [...html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => cellText(match[1]))
  const nameIndex = headers.indexOf('종목명')
  const codeIndex = headers.indexOf('종목코드')
  const sharesIndex = headers.indexOf('상장주식수(천주)')
  if (nameIndex < 0 || codeIndex < 0 || sharesIndex < 0) {
    throw new Error('KRX KIND listed-share response is not the security-level detail table')
  }

  const bySymbol = new Map<string, KrxKindListedSharesRow>()
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cellText(match[1]))
    if (cells.length <= Math.max(nameIndex, codeIndex, sharesIndex)) continue
    const securityCode = cells[codeIndex]
    const name = cells[nameIndex]
    const matches = expectations.filter((expectation) => matchesExpectation(securityCode, name, expectation))
    if (matches.length === 0) continue
    if (matches.length > 1) throw new Error(`KRX KIND security row ${securityCode} matched more than one private asset identity`)
    const { symbol } = matches[0]
    const listedShares = parseListedSharesThousands(cells[sharesIndex])
    if (!securityCode || !name || listedShares === null) {
      throw new Error(`KRX KIND returned incomplete listed-share fields for ${symbol}`)
    }
    const row = { symbol, securityCode, name, listedShares }
    const prior = bySymbol.get(symbol)
    if (prior && (
      prior.securityCode !== row.securityCode || prior.name !== row.name || prior.listedShares !== row.listedShares
    )) {
      throw new Error(`KRX KIND returned conflicting security-level rows for ${symbol}`)
    }
    bySymbol.set(symbol, row)
  }

  return [...bySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol))
}