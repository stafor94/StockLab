export interface NasdaqGidsSharesRow {
  date: string
  symbol: string
  totalSharesOutstanding: number
}

export function parseNormalizedNasdaqGidsSharesCsv(text: string): NasdaqGidsSharesRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) throw new Error('Nasdaq GIDS TSO CSV is empty')
  const header = lines[0].split(',').map((item) => item.trim())
  if (header.join(',') !== 'date,symbol,totalSharesOutstanding') {
    throw new Error('Nasdaq GIDS TSO CSV header must be date,symbol,totalSharesOutstanding')
  }
  const rows = lines.slice(1).map((line, index) => {
    const fields = line.split(',').map((item) => item.trim())
    if (fields.length !== 3) throw new Error(`Nasdaq GIDS TSO row ${index + 2} must have 3 columns`)
    const [date, symbol, rawShares] = fields
    const totalSharesOutstanding = Number(rawShares)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !symbol || !Number.isFinite(totalSharesOutstanding) || totalSharesOutstanding <= 0) {
      throw new Error(`Nasdaq GIDS TSO row ${index + 2} is invalid`)
    }
    return { date, symbol, totalSharesOutstanding }
  })
  return rows.sort((left, right) => left.symbol.localeCompare(right.symbol) || left.date.localeCompare(right.date))
}
