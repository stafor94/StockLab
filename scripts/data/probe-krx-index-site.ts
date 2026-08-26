import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { gzipSync } from 'node:zlib'

const execFileAsync = promisify(execFile)

async function run(command: string, args: string[]): Promise<void> {
  const result = await execFileAsync(command, args, {
    env: {
      ...process.env,
      KRX_INDEX_CONCURRENCY: '6',
      KRX_INDEX_REQUEST_DELAY_MS: '25',
      NASDAQ_REQUEST_DELAY_MS: '100',
    },
    maxBuffer: 10 * 1024 * 1024,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

await run('npm', ['run', 'data:indices:build'])
await run('npm', ['run', 'data:indices:check'])

const paths = [
  'manifest.json',
  'kr/KOSPI.json',
  'kr/KOSDAQ.json',
  'us/NASDAQ_COMPOSITE.json',
] as const
const files = Object.fromEntries(await Promise.all(paths.map(async (path) => [
  path,
  await readFile(`public/data/indices/${path}`, 'utf8'),
])))
const payload = gzipSync(Buffer.from(JSON.stringify(files), 'utf8')).toString('base64')

console.log('INDEX_EXPORT_BEGIN')
for (let offset = 0; offset < payload.length; offset += 6_000) {
  console.log(payload.slice(offset, offset + 6_000))
}
console.log('INDEX_EXPORT_END')
