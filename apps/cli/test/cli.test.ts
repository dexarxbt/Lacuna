import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  parseSubmissionManifest,
  createRpcTransport,
  validateCommittedReceiptArtifacts,
  validateManifestEvidence,
  verifyMainnetManifest,
  verifyReceiptValue,
  verifyTransactionReceipt,
  writeVerificationArtifacts,
  type RpcTransport,
} from '../src/index.ts'

const pool = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a'

function receipt(fromAddress = pool, transactionHash?: string) {
  return {
    ...(transactionHash ? { transaction_hash: transactionHash } : {}),
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

test('rejects felt-equivalent duplicate hashes', () => {
  const result = parseSubmissionManifest({ transactions: ['0x1', '0x01'] })
  assert.match(result.errors.join(' '), /felt-equivalent duplicates/)
})

test('requires every listed manifest hash to have committed verified evidence in exact mode', async () => {
  const verified = await verifyTransactionReceipt('0xabc', async () => receipt(pool, '0xabc'))
  assert.deepEqual(validateManifestEvidence(
    { transactions: ['0xabc'] },
    { evidence: [verified.evidence] },
  ), [])
  assert.match(validateManifestEvidence(
    { transactions: ['0xdef'] },
    { evidence: [verified.evidence] },
  ).join(' '), /has no committed verified evidence/)
  assert.deepEqual(validateManifestEvidence(
    { transactions: ['0xabc', '0xdef'] },
    { evidence: [verified.evidence] },
    false,
  ), [])
})

test('verifies a succeeded receipt that emitted from the mainnet pool', async () => {
  const rpc: RpcTransport = async () => receipt(pool, '0xabc')
  const result = await verifyTransactionReceipt('0xabc', rpc, '2026-08-23T00:00:00.000Z')

  assert.deepEqual(result.errors, [])
  assert.equal(result.evidence.actualFee.amount, '16')
  assert.equal(result.evidence.actualFee.unit, 'FRI')
  assert.ok(result.evidence.checks.every(({ passed }) => passed))
})

test('rejects a receipt whose returned hash differs from the request', () => {
  const result = verifyReceiptValue('0xabc', receipt(pool, '0xdef'))
  assert.match(result.errors.join(' '), /does not match/)
})

test('rejects successful transactions that never touched the pool', async () => {
  const rpc: RpcTransport = async () => receipt('0x123', '0xabc')
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

test('bounds each CLI RPC request and validates the timeout', async () => {
  const stalledFetch = ((
    _input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    if (!signal) {
      reject(new Error('Expected an abort signal.'))
      return
    }
    const rejectOnAbort = () => reject(signal.reason)
    if (signal.aborted) rejectOnAbort()
    else signal.addEventListener('abort', rejectOnAbort, { once: true })
  })) as typeof fetch

  const rpc = createRpcTransport('https://rpc.example.test', stalledFetch, 10)
  await assert.rejects(rpc('starknet_chainId'), /timeout|aborted/i)
  assert.throws(
    () => createRpcTransport('https://rpc.example.test', stalledFetch, 0),
    /positive integer/,
  )
})

test('refuses to write any artifact when a verification result failed', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lacuna-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const failed = await verifyTransactionReceipt('0xabc', async () => receipt('0x123'))

  await assert.rejects(writeVerificationArtifacts(root, [failed]), /Refusing to write failed/)
  await assert.rejects(readFile(join(root, 'verification', 'mainnet', 'transaction-index.json')))
})

test('refuses mismatched pending receipt evidence before creating artifacts', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lacuna-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const verified = await verifyTransactionReceipt('0xabc', async () => receipt(pool, '0xabc'))
  const mismatched = {
    ...verified,
    receipt: { ...receipt(pool, '0xabc'), block_number: 999 },
    errors: [],
  }

  await assert.rejects(
    writeVerificationArtifacts(root, [mismatched]),
    /does not derive the proposed evidence/,
  )
  await assert.rejects(readdir(join(root, 'verification')))
})

test('successful artifact writes append and preserve committed receipt bytes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lacuna-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const first = await verifyTransactionReceipt('0xabc', async () => receipt(pool, '0xabc'))
  const second = await verifyTransactionReceipt('0xdef', async () => receipt(pool, '0xdef'))

  await writeVerificationArtifacts(root, [first])
  const evidenceDirectory = join(root, 'verification', 'mainnet')
  const firstReceiptPath = join(evidenceDirectory, 'receipts', '0xabc.json')
  const originalFirstReceipt = await readFile(firstReceiptPath, 'utf8')
  await writeVerificationArtifacts(root, [second])

  assert.deepEqual(await readdir(join(evidenceDirectory, 'receipts')), ['0xabc.json', '0xdef.json'])
  assert.equal(await readFile(firstReceiptPath, 'utf8'), originalFirstReceipt)
  const index = JSON.parse(await readFile(join(evidenceDirectory, 'transaction-index.json'), 'utf8')) as {
    evidence: Array<{ transactionHash: string }>
  }
  assert.deepEqual(index.evidence.map(({ transactionHash }) => transactionHash), ['0xabc', '0xdef'])
})

test('failed append leaves committed artifacts unchanged', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lacuna-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const first = await verifyTransactionReceipt('0xabc', async () => receipt(pool, '0xabc'))
  const failed = await verifyTransactionReceipt('0xdef', async () => receipt('0x123', '0xdef'))
  await writeVerificationArtifacts(root, [first])

  const indexPath = join(root, 'verification', 'mainnet', 'transaction-index.json')
  const before = await readFile(indexPath, 'utf8')
  await assert.rejects(writeVerificationArtifacts(root, [failed]), /Refusing to write failed/)
  assert.equal(await readFile(indexPath, 'utf8'), before)
})

test('append refuses an invalid committed index before touching receipts', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lacuna-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'verification', 'mainnet')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(directory, { recursive: true }))
  await writeFile(join(directory, 'transaction-index.json'), '{"evidence":[{}]}\n')
  const next = await verifyTransactionReceipt('0xdef', async () => receipt(pool, '0xdef'))

  await assert.rejects(writeVerificationArtifacts(root, [next]), /invalid committed evidence/)
})


test('binds every committed raw receipt to its derived evidence record', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lacuna-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const verified = await verifyTransactionReceipt('0xabc', async () => receipt(pool, '0xabc'))
  await writeVerificationArtifacts(root, [verified])

  const directory = join(root, 'verification', 'mainnet')
  const indexValue = JSON.parse(await readFile(join(directory, 'transaction-index.json'), 'utf8')) as unknown
  assert.deepEqual(await validateCommittedReceiptArtifacts(root, indexValue), [])

  await writeFile(
    join(directory, 'receipts', '0xabc.json'),
    `${JSON.stringify(receipt(pool, '0xdef'), null, 2)}\n`,
  )
  assert.match(
    (await validateCommittedReceiptArtifacts(root, indexValue)).join(' '),
    /failed verification/,
  )

  await writeFile(join(directory, 'receipts', '0x999.json'), '{}\n')
  assert.match(
    (await validateCommittedReceiptArtifacts(root, indexValue)).join(' '),
    /Unindexed raw receipt/,
  )
})
