import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSubmissionManifest,
  parseTransactionEvidence,
  STARKNET_MAINNET_CHAIN_ID,
  STRK20_MAINNET_POOL,
  validateSubmissionManifest,
  type TransactionEvidence,
} from '../src/index.ts'

function verifiedEvidence(hash: string): TransactionEvidence {
  return {
    version: 1,
    transactionHash: hash,
    chainId: STARKNET_MAINNET_CHAIN_ID,
    poolAddress: STRK20_MAINNET_POOL,
    operation: 'private-transfer',
    blockNumber: 1,
    actualFee: { amount: '3.2', unit: 'FRI' },
    verifiedAt: '2026-08-23T00:00:00.000Z',
    explorerUrl: `https://voyager.online/tx/${hash}`,
    checks: [
      { name: 'receipt-succeeded', passed: true, detail: 'Accepted on L2' },
      { name: 'touched-pool', passed: true, detail: 'Pool event found' },
      { name: 'block-confirmed', passed: true, detail: 'Block confirmed' },
    ],
  }
}

test('valid mainnet evidence is accepted', () => {
  const result = parseTransactionEvidence(verifiedEvidence('0xabc'))
  assert.equal(result.ok, true)
})

test('unverified records do not enter the submission manifest', () => {
  const evidence = verifiedEvidence('0xabc')
  evidence.checks[1] = { ...evidence.checks[1], passed: false }

  assert.deepEqual(createSubmissionManifest([evidence]), { transactions: [] })
})

test('submission validation requires three unique hashes', () => {
  const records = ['0x1', '0x2', '0x3'].map(verifiedEvidence)
  const manifest = createSubmissionManifest(records)

  assert.deepEqual(manifest.transactions, ['0x1', '0x2', '0x3'])
  assert.deepEqual(validateSubmissionManifest(manifest), [])
})
