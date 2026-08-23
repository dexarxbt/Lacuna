import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSubmissionManifest, verifyMainnetManifest, verifyTransactionReceipt, type RpcTransport } from '../src/index.ts'

const pool = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a'

function receipt(fromAddress = pool) {
  return {
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    block_number: 123,
    actual_fee: { amount: '0x10', unit: 'FRI' },
    events: [{ from_address: fromAddress, keys: [], data: [] }],
  }
}

test('accepts an intentionally incomplete draft manifest', () => {
  const result = parseSubmissionManifest({ transactions: [], contracts: [] })
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.manifest, { transactions: [], contracts: [] })
})

test('complete submission mode requires three transactions', () => {
  const result = parseSubmissionManifest({ transactions: [], contracts: [] }, true)
  assert.match(result.errors.join(' '), /At least three/)
})

test('rejects duplicate hashes instead of silently changing the manifest', () => {
  const result = parseSubmissionManifest({ transactions: ['0x1', '0x1'] })
  assert.match(result.errors.join(' '), /duplicates/)
})

test('verifies a succeeded receipt that emitted from the mainnet pool', async () => {
  const rpc: RpcTransport = async () => receipt()
  const result = await verifyTransactionReceipt('0xabc', rpc, '2026-08-23T00:00:00.000Z')

  assert.deepEqual(result.errors, [])
  assert.equal(result.evidence.actualFee.amount, '16')
  assert.equal(result.evidence.actualFee.unit, 'FRI')
  assert.ok(result.evidence.checks.every(({ passed }) => passed))
})

test('rejects successful transactions that never touched the pool', async () => {
  const rpc: RpcTransport = async () => receipt('0x123')
  const result = await verifyTransactionReceipt('0xabc', rpc)

  assert.match(result.errors.join(' '), /No STRK20 pool event/)
})

test('refuses a non-mainnet RPC before reading receipts', async () => {
  const rpc: RpcTransport = async (method) => method === 'starknet_chainId' ? '0x534e5f5345504f4c4941' : receipt()

  await assert.rejects(
    verifyMainnetManifest({ transactions: ['0x1', '0x2', '0x3'] }, rpc),
    /not Starknet Mainnet/,
  )
})
