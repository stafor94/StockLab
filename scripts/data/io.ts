import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function readJson(path: string): Promise<unknown> {
  const text = await readFile(path, 'utf8')
  return JSON.parse(text) as unknown
}

export async function readJsonIfExists(path: string): Promise<unknown | null> {
  if (!(await pathExists(path))) {
    return null
  }
  return readJson(path)
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp`
  const payload = `${JSON.stringify(value, null, 2)}\n`
  await writeFile(temporaryPath, payload, 'utf8')
  await rename(temporaryPath, path)
}

export async function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}
