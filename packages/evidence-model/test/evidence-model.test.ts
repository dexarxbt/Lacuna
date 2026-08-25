import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canonicalStarknetFelt,
  createSubmissionManifest,
  parseEvidenceIndex,
  parseTransactionEvidence,
  STARKNET_MAINNET_CHAIN_ID,
  STRK20_MAINNET_POOL,
  validateSubmissionManifest,
  verifyReceiptValue,
  isVerified,
  type TransactionEvidence,
} from '../src/index.ts'

function verifiedEvidence(hash: string): TransactionEvidence {
  return {
    version: 2,
    transactionHash: hash,
    chainId: STARKNET_MAINNET_CHAIN_ID,
    poolAddress: STRK20_MAINNET_POOL,
    operation: 'private-transfer',
    blockNumber: 1,
    actualFee: { amount: '3', unit: 'FRI' },
    verifiedAt: '2026-08-23T00:00:00.000Z',
    explorerUrl: `https://voyager.online/tx/${hash}`,
    checks: [
      { name: 'receipt-hash-matches', passed: true, detail: 'Receipt hash matched' },
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

test('committed evidence rejects non-normalized amounts and unknown fee units', () => {
  for (const amount of ['3.2', '03']) {
    const evidence = verifiedEvidence('0xabc')
    evidence.actualFee.amount = amount
    assert.equal(parseTransactionEvidence(evidence).ok, false)
    assert.equal(isVerified(evidence), false)
    assert.equal(parseEvidenceIndex({ evidence: [evidence] }).ok, false)
  }

  const unknownUnit = {
    ...verifiedEvidence('0xdef'),
    actualFee: { amount: '3', unit: 'BANANAS' },
  }
  assert.equal(parseTransactionEvidence(unknownUnit).ok, false)
  assert.equal(parseEvidenceIndex({ evidence: [unknownUnit] }).ok, false)
})

test('legacy v1 evidence remains parseable but is not currently verified', () => {
  const legacy = verifiedEvidence('0xabc')
  legacy.version = 1
  legacy.checks = legacy.checks.filter(({ name }) => name !== 'receipt-hash-matches')

  assert.equal(parseTransactionEvidence(legacy).ok, true)
  assert.equal(isVerified(legacy), false)
  assert.deepEqual(createSubmissionManifest([legacy]), { transactions: [] })
  const index = parseEvidenceIndex({ evidence: [legacy] })
  assert.equal(index.ok, false)
  if (!index.ok) assert.match(index.errors.join(' '), /not passed every required check/)
})

test('unverified records do not enter the submission manifest', () => {
  const evidence = verifiedEvidence('0xabc')
  evidence.checks[1] = { ...evidence.checks[1], passed: false }

  assert.deepEqual(createSubmissionManifest([evidence]), { transactions: [] })
})

test('submission validation requires at least three canonically unique hashes', () => {
  const records = ['0x1', '0x2', '0x3', '0x4'].map(verifiedEvidence)
  const manifest = createSubmissionManifest(records)

  assert.deepEqual(manifest.transactions, ['0x1', '0x2', '0x3', '0x4'])
  assert.deepEqual(validateSubmissionManifest(manifest), [])
  assert.match(validateSubmissionManifest({ transactions: ['0x1', '0x01', '0x2'] }).join(' '), /canonically unique/)
})

test('canonical felt identity normalizes leading zeroes and case', () => {
  assert.equal(canonicalStarknetFelt('0x000AbC'), '0xabc')
  assert.equal(canonicalStarknetFelt('not-a-hash'), null)
})

test('duplicate or unknown verification checks are rejected', () => {
  const duplicate = verifiedEvidence('0xabc')
  duplicate.checks.push({ name: 'receipt-succeeded', passed: false, detail: 'Conflicting duplicate' })
  const duplicateResult = parseTransactionEvidence(duplicate)
  assert.equal(duplicateResult.ok, false)
  if (!duplicateResult.ok) assert.match(duplicateResult.errors.join(' '), /duplicates/)

  const unknown = verifiedEvidence('0xdef') as TransactionEvidence & { checks: Array<{ name: string; passed: boolean; detail: string }> }
  unknown.checks[2] = { name: 'made-up-check', passed: true, detail: 'No' }
  const unknownResult = parseTransactionEvidence(unknown)
  assert.equal(unknownResult.ok, false)
  if (!unknownResult.ok) assert.match(unknownResult.errors.join(' '), /Unknown verification check/)
})

test('explorer links must resolve to the evidence transaction', () => {
  const evidence = verifiedEvidence('0xabc')
  evidence.explorerUrl = 'https://voyager.online/tx/0xdef'
  const result = parseTransactionEvidence(evidence)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.errors.join(' '), /matching HTTPS Voyager/)
})

test('evidence indexes reject felt-equivalent duplicate hashes', () => {
  const result = parseEvidenceIndex({ evidence: [verifiedEvidence('0x1'), verifiedEvidence('0x01')] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.errors.join(' '), /felt-equivalent duplicate/)
})


test('receipt verification applies the shared Mainnet acceptance rules', () => {
  const result = verifyReceiptValue('0xabc', {
    transaction_hash: '0x0ABC',
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    block_number: 42,
    actual_fee: { amount: '0x10', unit: 'FRI' },
    events: [{ from_address: STRK20_MAINNET_POOL.toUpperCase() }],
  }, '2026-08-24T00:00:00.000Z', 'withdraw')

  assert.deepEqual(result.errors, [])
  assert.equal(result.evidence.version, 2)
  assert.equal(isVerified(result.evidence), true)
  assert.equal(result.evidence.checks.length, 4)
  assert.deepEqual(
    result.evidence.checks.find(({ name }) => name === 'receipt-hash-matches'),
    {
      name: 'receipt-hash-matches',
      passed: true,
      detail: 'Receipt transaction hash matches the requested hash.',
    },
  )
  assert.equal(result.evidence.operation, 'withdraw')
  assert.equal(result.evidence.actualFee.amount, '16')
  assert.equal(result.evidence.blockNumber, 42)
})

test('receipt verification rejects a returned hash mismatch', () => {
  const result = verifyReceiptValue('0xabc', {
    transaction_hash: '0xdef',
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L1',
    block_number: 43,
    actual_fee: { amount: '1', unit: 'FRI' },
    events: [{ from_address: STRK20_MAINNET_POOL }],
  })

  assert.equal(isVerified(result.evidence), false)
  assert.deepEqual(
    result.evidence.checks.find(({ name }) => name === 'receipt-hash-matches')?.passed,
    false,
  )
  assert.match(result.errors.join(' '), /does not match/)
  assert.doesNotMatch(result.errors.join(' '), /No STRK20 pool event/)
})


test('receipt verification requires the returned transaction hash', () => {
  const result = verifyReceiptValue('0xabc', {
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    block_number: 44,
    actual_fee: { amount: '1', unit: 'FRI' },
    events: [{ from_address: STRK20_MAINNET_POOL }],
  })

  assert.equal(isVerified(result.evidence), false)
  assert.equal(
    result.evidence.checks.find(({ name }) => name === 'receipt-hash-matches')?.passed,
    false,
  )
  assert.match(result.errors.join(' '), /missing or does not match/)
})

test('receipt verification rejects missing or malformed actual fee metadata', () => {
  const otherwiseValidReceipt = {
    transaction_hash: '0xabc',
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    block_number: 45,
    events: [{ from_address: STRK20_MAINNET_POOL }],
  }

  assert.throws(
    () => verifyReceiptValue('0xabc', otherwiseValidReceipt),
    /actual_fee must be an object/,
  )
  for (const amount of ['not-a-fee', '-1', '+1', '0b10', '0o10']) {
    assert.throws(
      () => verifyReceiptValue('0xabc', {
        ...otherwiseValidReceipt,
        actual_fee: { amount, unit: 'FRI' },
      }),
      /actual_fee amount/,
    )
  }
  for (const unit of ['  ', 'BANANAS']) {
    assert.throws(
      () => verifyReceiptValue('0xabc', {
        ...otherwiseValidReceipt,
        actual_fee: { amount: '1', unit },
      }),
      /actual_fee unit/,
    )
  }
})
