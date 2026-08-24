import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  parseSubmissionManifest,
  validateManifestEvidence,
  verifyMainnetManifest,
  verifyTransactionReceipt,
  writeVerificationArtifacts,
  type RpcTransport,
} from '../src/index.ts'

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

test('allows live demo metadata before mainnet evidence is complete', () => {
  const result = parseSubmissionManifest({
    transactions: [],
    contracts: [],
    demo_url: 'https://lacuna-strk.vercel.app/',
  })
  assert.deepEqual(result.errors, [])
  assert.ok(result.manifest)
  assert.deepEqual(validateManifestEvidence(result.manifest, { evidence: [] }), [])
})

test('complete submission mode requires three transactions', () => {
  const result = parseSubmissionManifest({ transactions: [], contracts: [] }, true)
  assert.match(result.errors.join(' '), /At least three/)
})

test('rejects duplicate hashes instead of silently changing the manifest', () => {
  const result = parseSubmissionManifest({ transactions: ['0x1', '0x1'] })
  assert.match(result.errors.join(' '), /duplicates/)
})

test('requires every listed manifest hash to have committed verified evidence', async () => {
  const verified = await verifyTransactionReceipt('0xabc', async () => receipt())
  assert.deepEqual(validateManifestEvidence(
    { transactions: ['0xabc'] },
    { evidence: [verified.evidence] },
  ), [])
  assert.match(validateManifestEvidence(
    { transactions: ['0xdef'] },
    { evidence: [verified.evidence] },
  ).join(' '), /has no committed verified evidence/)
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

test('refuses to write any artifact when a verification result failed', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lacuna-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const failed = await verifyTransactionReceipt('0xabc', async () => receipt('0x123'))

  await assert.rejects(writeVerificationArtifacts(root, [failed]), /Refusing to write failed/)
  await assert.rejects(readFile(join(root, 'verification', 'mainnet', 'transaction-index.json')))
})

test('successful artifact writes replace stale receipts', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lacuna-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const first = await verifyTransactionReceipt('0xabc', async () => receipt())
  const second = await verifyTransactionReceipt('0xdef', async () => receipt())

  await writeVerificationArtifacts(root, [first])
  await writeVerificationArtifacts(root, [second])

  const evidenceDirectory = join(root, 'verification', 'mainnet')
  assert.deepEqual(await readdir(join(evidenceDirectory, 'receipts')), ['0xdef.json'])
  const index = JSON.parse(await readFile(join(evidenceDirectory, 'transaction-index.json'), 'utf8')) as {
    evidence: Array<{ transactionHash: string }>
  }
  assert.deepEqual(index.evidence.map(({ transactionHash }) => transactionHash), ['0xdef'])
})
