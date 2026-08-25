import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  evidenceSummary,
  rawReceiptUrl,
  shortenTransactionHash,
  verifiedTransactions,
} from '../src/evidence.ts'

const repositoryRoot = new URL('../../../', import.meta.url)

async function readText(relativePath: string): Promise<string> {
  return await readFile(new URL(relativePath, repositoryRoot), 'utf8')
}

test('loads every committed transaction through the strict evidence parser', () => {
  assert.equal(evidenceSummary.verifiedCount, verifiedTransactions.length)
  assert.ok(evidenceSummary.minimumMet)
  assert.ok(verifiedTransactions.length >= 3)
  assert.equal(
    new Set(verifiedTransactions.map(({ transactionHash }) => BigInt(transactionHash).toString(16))).size,
    verifiedTransactions.length,
  )

  for (const transaction of verifiedTransactions) {
    assert.equal(transaction.version, 2)
    assert.equal(transaction.checks.length, 4)
    assert.ok(transaction.checks.every(({ passed }) => passed))
    assert.ok(transaction.checks.some(({ name }) => name === 'receipt-hash-matches'))
    assert.equal(transaction.explorerUrl, `https://voyager.online/tx/${transaction.transactionHash}`)
    assert.equal(
      rawReceiptUrl(transaction.transactionHash),
      `https://github.com/dexarxbt/Lacuna/blob/main/verification/mainnet/receipts/${transaction.transactionHash}.json`,
    )
    assert.match(shortenTransactionHash(transaction.transactionHash), /^0x[0-9a-f]{8}…[0-9a-f]{8}$/)
  }
})

test('renders the ledger from the full transaction collection with public evidence links', async () => {
  const component = await readText('apps/web/src/components/EvidenceLedger.tsx')

  assert.match(component, /verifiedTransactions\.map/)
  assert.match(component, /transaction\.explorerUrl/)
  assert.match(component, /rawReceiptUrl\(transaction\.transactionHash\)/)
  assert.match(component, /Submission minimum met/)
})

test('does not present the current transaction count as a fixed ceiling', async () => {
  const productFiles = await Promise.all([
    readText('apps/web/src/pages/LandingPage.tsx'),
    readText('apps/web/src/pages/StudioPage.tsx'),
    readText('apps/web/src/components/BoundaryArtwork.tsx'),
    readText('apps/web/src/components/EvidenceLedger.tsx'),
    readText('apps/web/index.html'),
  ])

  for (const content of productFiles) {
    assert.doesNotMatch(content, /\b3\s*\/\s*3\b/)
    assert.doesNotMatch(content, /three (?:accepted|verified|mainnet) receipts/i)
  }
})
