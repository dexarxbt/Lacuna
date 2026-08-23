export const STARKNET_MAINNET_CHAIN_ID = 'SN_MAIN' as const
export const STRK20_MAINNET_POOL = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a' as const

export type VerificationCheck = {
  name: 'receipt-succeeded' | 'touched-pool' | 'block-confirmed'
  passed: boolean
  detail: string
}

export type TransactionEvidence = {
  version: 1
  transactionHash: string
  chainId: typeof STARKNET_MAINNET_CHAIN_ID
  poolAddress: typeof STRK20_MAINNET_POOL
  operation: 'shield' | 'private-transfer' | 'private-invoke' | 'withdraw' | 'register' | 'unclassified-pool-interaction'
  actualFee: {
    amount: string
    unit: string
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

const HASH_PATTERN = /^0x[0-9a-f]{1,64}$/i
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isTransactionHash(value: unknown): value is string {
  return typeof value === 'string' && HASH_PATTERN.test(value)
}

export function parseTransactionEvidence(value: unknown): EvidenceParseResult {
  const errors: string[] = []
  if (!isObject(value)) return { ok: false, errors: ['Evidence must be a JSON object.'] }

  if (value.version !== 1) errors.push('Evidence version must be 1.')
  if (!isTransactionHash(value.transactionHash)) errors.push('Transaction hash must be a Starknet hex value.')
  if (value.chainId !== STARKNET_MAINNET_CHAIN_ID) errors.push('Evidence must target Starknet Mainnet.')
  if (value.poolAddress !== STRK20_MAINNET_POOL) errors.push('Evidence must reference the verified STRK20 mainnet pool.')
  if (!['shield', 'private-transfer', 'private-invoke', 'withdraw', 'register', 'unclassified-pool-interaction'].includes(String(value.operation))) {
    errors.push('Operation is not recognized.')
  }
  if (!isObject(value.actualFee)
    || typeof value.actualFee.amount !== 'string'
    || !DECIMAL_PATTERN.test(value.actualFee.amount)
    || typeof value.actualFee.unit !== 'string'
    || value.actualFee.unit.length === 0) {
    errors.push('Actual fee must include a decimal amount and unit.')
  }
  if (!Number.isSafeInteger(value.blockNumber) || Number(value.blockNumber) < 0) errors.push('Block number must be a non-negative integer.')
  if (typeof value.verifiedAt !== 'string' || Number.isNaN(Date.parse(value.verifiedAt))) errors.push('Verification time must be an ISO date string.')
  if (typeof value.explorerUrl !== 'string' || !value.explorerUrl.startsWith('https://')) errors.push('Explorer URL must use HTTPS.')

  if (!Array.isArray(value.checks) || value.checks.length === 0) {
    errors.push('Evidence must include verification checks.')
  } else {
    for (const check of value.checks) {
      if (!isObject(check) || typeof check.name !== 'string' || typeof check.passed !== 'boolean' || typeof check.detail !== 'string') {
        errors.push('Every verification check needs a name, boolean result, and detail.')
        break
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, evidence: value as TransactionEvidence }
}

export function isVerified(evidence: TransactionEvidence): boolean {
  const requiredChecks: VerificationCheck['name'][] = ['receipt-succeeded', 'touched-pool', 'block-confirmed']
  return requiredChecks.every((name) => evidence.checks.some((check) => check.name === name && check.passed))
}

export function createSubmissionManifest(
  records: TransactionEvidence[],
  extras: Omit<SubmissionManifest, 'transactions'> = {},
): SubmissionManifest {
  const transactions = [...new Set(records.filter(isVerified).map(({ transactionHash }) => transactionHash))]
  return { transactions, ...extras }
}

export function validateSubmissionManifest(manifest: SubmissionManifest): string[] {
  const errors: string[] = []
  if (manifest.transactions.length < 3) errors.push('At least three verified mainnet transaction hashes are required for submission.')
  if (new Set(manifest.transactions).size !== manifest.transactions.length) errors.push('Transaction hashes must be unique.')
  if (manifest.transactions.some((hash) => !isTransactionHash(hash))) errors.push('Every transaction hash must be a Starknet hex value.')
  if (manifest.contracts?.some((address) => !isTransactionHash(address))) errors.push('Every contract address must be a Starknet hex value.')
  if (manifest.demo_video !== undefined && !manifest.demo_video.startsWith('https://')) errors.push('Demo video URL must use HTTPS.')
  if (manifest.demo_url !== undefined && !manifest.demo_url.startsWith('https://')) errors.push('Demo URL must use HTTPS.')
  return errors
}
