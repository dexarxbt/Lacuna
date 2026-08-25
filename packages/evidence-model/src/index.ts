export const STARKNET_MAINNET_CHAIN_ID = 'SN_MAIN' as const
export const STRK20_MAINNET_POOL = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a' as const

const LEGACY_CHECK_NAMES = ['receipt-succeeded', 'touched-pool', 'block-confirmed'] as const
const REQUIRED_CHECK_NAMES = ['receipt-hash-matches', ...LEGACY_CHECK_NAMES] as const

export type VerificationCheck = {
  name: typeof REQUIRED_CHECK_NAMES[number]
  passed: boolean
  detail: string
}

export type TransactionEvidence = {
  version: 1 | 2
  transactionHash: string
  chainId: typeof STARKNET_MAINNET_CHAIN_ID
  poolAddress: typeof STRK20_MAINNET_POOL
  operation: 'shield' | 'private-transfer' | 'private-invoke' | 'withdraw' | 'register' | 'unclassified-pool-interaction'
  actualFee: {
    amount: string
    unit: 'WEI' | 'FRI'
  }
  blockNumber: number
  verifiedAt: string
  checks: VerificationCheck[]
  explorerUrl: string
}

export type SubmissionManifest = {
  transactions: string[]
  contracts?: string[]
  demo_video?: string
  demo_url?: string
}

export type EvidenceParseResult =
  | { ok: true; evidence: TransactionEvidence }
  | { ok: false; errors: string[] }

export type EvidenceIndexParseResult =
  | { ok: true; evidence: TransactionEvidence[] }
  | { ok: false; errors: string[] }

const HASH_PATTERN = /^0x[0-9a-f]{1,64}$/i
const DECIMAL_PATTERN = /^(0|[1-9]\d*)$/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isTransactionHash(value: unknown): value is string {
  return typeof value === 'string' && HASH_PATTERN.test(value)
}

export function canonicalStarknetFelt(value: string): string | null {
  if (!isTransactionHash(value)) return null
  try {
    return `0x${BigInt(value).toString(16)}`
  } catch {
    return null
  }
}

export function transactionExplorerUrl(transactionHash: string): string {
  return `https://voyager.online/tx/${transactionHash}`
}

function explorerMatchesHash(explorerUrl: unknown, transactionHash: unknown): boolean {
  if (typeof explorerUrl !== 'string' || typeof transactionHash !== 'string') return false
  const expectedHash = canonicalStarknetFelt(transactionHash)
  if (!expectedHash) return false
  const match = /^https:\/\/voyager\.online\/tx\/(0x[0-9a-f]{1,64})$/i.exec(explorerUrl)
  return match !== null && canonicalStarknetFelt(match[1]) === expectedHash
}

export function parseTransactionEvidence(value: unknown): EvidenceParseResult {
  const errors: string[] = []
  if (!isObject(value)) return { ok: false, errors: ['Evidence must be a JSON object.'] }

  if (value.version !== 1 && value.version !== 2) errors.push('Evidence version must be 1 or 2.')
  if (!isTransactionHash(value.transactionHash)) errors.push('Transaction hash must be a Starknet hex value.')
  if (value.chainId !== STARKNET_MAINNET_CHAIN_ID) errors.push('Evidence must target Starknet Mainnet.')
  if (value.poolAddress !== STRK20_MAINNET_POOL) errors.push('Evidence must reference the verified STRK20 mainnet pool.')
  if (!['shield', 'private-transfer', 'private-invoke', 'withdraw', 'register', 'unclassified-pool-interaction'].includes(String(value.operation))) {
    errors.push('Operation is not recognized.')
  }
  if (!isObject(value.actualFee)
    || typeof value.actualFee.amount !== 'string'
    || !DECIMAL_PATTERN.test(value.actualFee.amount)
    || (value.actualFee.unit !== 'WEI' && value.actualFee.unit !== 'FRI')) {
    errors.push('Actual fee must include a normalized decimal integer amount and a WEI or FRI unit.')
  }
  if (!Number.isSafeInteger(value.blockNumber) || Number(value.blockNumber) < 0) errors.push('Block number must be a non-negative integer.')
  if (typeof value.verifiedAt !== 'string' || Number.isNaN(Date.parse(value.verifiedAt))) errors.push('Verification time must be an ISO date string.')
  if (!explorerMatchesHash(value.explorerUrl, value.transactionHash)) errors.push('Explorer URL must be the matching HTTPS Voyager transaction URL.')

  const requiredCheckNames = value.version === 1 ? LEGACY_CHECK_NAMES : REQUIRED_CHECK_NAMES
  if (!Array.isArray(value.checks)) {
    errors.push('Evidence must include verification checks.')
  } else {
    const names: string[] = []
    for (const check of value.checks) {
      if (!isObject(check) || typeof check.name !== 'string' || typeof check.passed !== 'boolean' || typeof check.detail !== 'string') {
        errors.push('Every verification check needs a name, boolean result, and detail.')
        continue
      }
      names.push(check.name)
      if (!(requiredCheckNames as readonly string[]).includes(check.name)) {
        errors.push(`Unknown verification check ${check.name}.`)
      }
    }
    if (new Set(names).size !== names.length) errors.push('Verification checks must not contain duplicates.')
    for (const name of requiredCheckNames) {
      if (!names.includes(name)) errors.push(`Evidence is missing the ${name} check.`)
    }
    if (names.length !== requiredCheckNames.length) errors.push('Evidence must contain exactly the required verification checks.')
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, evidence: value as TransactionEvidence }
}

export function isVerified(evidence: TransactionEvidence): boolean {
  return evidence.version === 2
    && parseTransactionEvidence(evidence).ok
    && evidence.checks.length === REQUIRED_CHECK_NAMES.length
    && REQUIRED_CHECK_NAMES.every((name) => {
      const matching = evidence.checks.filter((check) => check.name === name)
      return matching.length === 1 && matching[0].passed
    })
}

export function parseEvidenceIndex(value: unknown): EvidenceIndexParseResult {
  if (!isObject(value) || !Array.isArray(value.evidence)) {
    return { ok: false, errors: ['Evidence index must contain an evidence array.'] }
  }

  const evidence: TransactionEvidence[] = []
  const errors: string[] = []
  for (const [index, candidate] of value.evidence.entries()) {
    const parsed = parseTransactionEvidence(candidate)
    if (!parsed.ok) {
      errors.push(...parsed.errors.map((error) => `Evidence record ${index + 1}: ${error}`))
      continue
    }
    if (!isVerified(parsed.evidence)) {
      errors.push(`Evidence record ${index + 1} has not passed every required check.`)
    }
    evidence.push(parsed.evidence)
  }

  const canonicalHashes = evidence.map(({ transactionHash }) => canonicalStarknetFelt(transactionHash))
  if (new Set(canonicalHashes).size !== canonicalHashes.length) {
    errors.push('Evidence index must not contain felt-equivalent duplicate transaction hashes.')
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, evidence }
}

export function createSubmissionManifest(
  records: TransactionEvidence[],
  extras: Omit<SubmissionManifest, 'transactions'> = {},
): SubmissionManifest {
  const unique = new Map<string, string>()
  for (const evidence of records) {
    if (!isVerified(evidence)) continue
    const canonical = canonicalStarknetFelt(evidence.transactionHash)
    if (canonical && !unique.has(canonical)) unique.set(canonical, evidence.transactionHash)
  }
  return { transactions: [...unique.values()], ...extras }
}

function hasCanonicalDuplicates(values: string[]): boolean {
  const canonical = values.map(canonicalStarknetFelt)
  return canonical.some((value) => value === null) || new Set(canonical).size !== canonical.length
}

export function validateSubmissionManifest(manifest: SubmissionManifest): string[] {
  const errors: string[] = []
  if (manifest.transactions.length < 3) errors.push('At least three verified mainnet transaction hashes are required for submission.')
  if (manifest.transactions.some((hash) => !isTransactionHash(hash))) {
    errors.push('Every transaction hash must be a Starknet hex value.')
  } else if (hasCanonicalDuplicates(manifest.transactions)) {
    errors.push('Transaction hashes must be canonically unique.')
  }
  if (manifest.contracts?.some((address) => !isTransactionHash(address))) {
    errors.push('Every contract address must be a Starknet hex value.')
  } else if (manifest.contracts && hasCanonicalDuplicates(manifest.contracts)) {
    errors.push('Contract addresses must be canonically unique.')
  }
  if (manifest.demo_video !== undefined && !manifest.demo_video.startsWith('https://')) errors.push('Demo video URL must use HTTPS.')
  if (manifest.demo_url !== undefined && !manifest.demo_url.startsWith('https://')) errors.push('Demo URL must use HTTPS.')
  return errors
}

export type ReceiptRecord = Record<string, unknown>

export type ReceiptVerification = {
  evidence: TransactionEvidence
  receipt: ReceiptRecord
  errors: string[]
}

function sameStarknetFelt(left: unknown, right: string): boolean {
  if (typeof left !== 'string') return false
  return canonicalStarknetFelt(left) === canonicalStarknetFelt(right)
}

function receiptEvents(receipt: ReceiptRecord): ReceiptRecord[] {
  return Array.isArray(receipt.events) ? receipt.events.filter(isObject) : []
}

function receiptFee(receipt: ReceiptRecord): TransactionEvidence['actualFee'] {
  if (!isObject(receipt.actual_fee)) throw new Error('Receipt actual_fee must be an object.')
  const rawAmount = receipt.actual_fee.amount
  if (
    typeof rawAmount !== 'string'
    || !/^(?:0x[0-9a-fA-F]+|\d+)$/.test(rawAmount)
  ) {
    throw new Error('Receipt actual_fee amount must be a decimal or 0x-prefixed hexadecimal non-negative integer string.')
  }

  let amount: bigint
  try {
    amount = BigInt(rawAmount)
  } catch {
    throw new Error('Receipt actual_fee amount must be a decimal or 0x-prefixed hexadecimal non-negative integer string.')
  }
  if (amount < 0n) {
    throw new Error('Receipt actual_fee amount must be a decimal or 0x-prefixed hexadecimal non-negative integer string.')
  }

  const unit = receipt.actual_fee.unit
  if (unit !== 'WEI' && unit !== 'FRI') {
    throw new Error('Receipt actual_fee unit must be WEI or FRI.')
  }
  return { amount: amount.toString(10), unit }
}

export function verifyReceiptValue(
  transactionHash: string,
  value: unknown,
  verifiedAt = new Date().toISOString(),
  operation: TransactionEvidence['operation'] = 'unclassified-pool-interaction',
): ReceiptVerification {
  if (!isTransactionHash(transactionHash)) throw new Error('Transaction hash is malformed.')
  if (!isObject(value)) throw new Error('Transaction receipt is malformed.')

  const succeeded = value.execution_status === 'SUCCEEDED'
  const confirmed = value.finality_status === 'ACCEPTED_ON_L1' || value.finality_status === 'ACCEPTED_ON_L2'
  const touchedPool = receiptEvents(value).some((event) => sameStarknetFelt(event.from_address, STRK20_MAINNET_POOL))
  const receiptHashMatches = sameStarknetFelt(value.transaction_hash, transactionHash)
  const blockNumber = Number.isSafeInteger(value.block_number) ? Number(value.block_number) : -1
  const checks: VerificationCheck[] = [
    {
      name: 'receipt-hash-matches',
      passed: receiptHashMatches,
      detail: receiptHashMatches
        ? 'Receipt transaction hash matches the requested hash.'
        : 'Receipt transaction hash is missing or does not match the requested hash.',
    },
    {
      name: 'receipt-succeeded',
      passed: succeeded,
      detail: succeeded ? 'Execution status is SUCCEEDED.' : `Execution status is ${String(value.execution_status)}.`,
    },
    {
      name: 'touched-pool',
      passed: touchedPool,
      detail: touchedPool
        ? 'Receipt includes an event from the verified STRK20 pool.'
        : 'No STRK20 pool event was found.',
    },
    {
      name: 'block-confirmed',
      passed: confirmed && blockNumber >= 0,
      detail: confirmed && blockNumber >= 0
        ? `${String(value.finality_status)} in block ${blockNumber}.`
        : 'Receipt has not reached an accepted Starknet block.',
    },
  ]

  const evidence: TransactionEvidence = {
    version: 2,
    transactionHash,
    chainId: STARKNET_MAINNET_CHAIN_ID,
    poolAddress: STRK20_MAINNET_POOL,
    operation,
    actualFee: receiptFee(value),
    blockNumber,
    verifiedAt,
    checks,
    explorerUrl: transactionExplorerUrl(transactionHash),
  }
  const parsed = parseTransactionEvidence(evidence)
  const errors = [
    ...(parsed.ok ? [] : parsed.errors),
    ...checks.filter(({ passed }) => !passed).map(({ detail }) => detail),
  ]
  return { evidence, receipt: value, errors }
}
