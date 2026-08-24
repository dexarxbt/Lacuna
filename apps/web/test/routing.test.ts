import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { normalizePathname, resolveRoute } from '../src/routing.ts'

const webRoot = new URL('../', import.meta.url)

async function readText(relativePath: string): Promise<string> {
  return await readFile(new URL(relativePath, webRoot), 'utf8')
}

test('resolves the landing and studio routes', () => {
  assert.equal(resolveRoute('/'), 'home')
  assert.equal(resolveRoute('/studio'), 'studio')
  assert.equal(resolveRoute('/studio/'), 'studio')
})

test('normalizes duplicate and trailing separators', () => {
  assert.equal(normalizePathname('//studio///'), '/studio')
})

test('keeps unknown paths out of the product routes', () => {
  assert.equal(resolveRoute('/unknown'), 'not-found')
})

test('ships route-specific canonical and social metadata', async () => {
  const landing = await readText('index.html')
  const studio = await readText('studio/index.html')

  assert.match(landing, /rel="canonical" href="https:\/\/lacuna-strk\.vercel\.app\/"/)
  assert.match(studio, /rel="canonical" href="https:\/\/lacuna-strk\.vercel\.app\/studio"/)
  assert.match(studio, /property="og:title" content="Studio — Lacuna"/)
  assert.match(studio, /name="twitter:title" content="Studio — Lacuna"/)
})

test('rewrites only supported Studio paths so unknown routes remain 404s', async () => {
  const config = JSON.parse(await readFile(new URL('../../../vercel.json', import.meta.url), 'utf8')) as {
    rewrites: Array<{ source: string; destination: string }>
  }

  assert.deepEqual(config.rewrites, [
    { source: '/studio', destination: '/studio/index.html' },
    { source: '/studio/', destination: '/studio/index.html' },
  ])
  assert.ok(config.rewrites.every(({ source }) => !source.includes('(.*)')))
})
