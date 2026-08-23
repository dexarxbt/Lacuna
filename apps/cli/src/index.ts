#!/usr/bin/env node

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  isTransactionHash,
  isVerified,
  parseTransactionEvidence,
  STARKNET_MAINNET_CHAIN_ID,
  STRK20_MAINNET_POOL,
  validateSubmissionManifest,
  type SubmissionManifest,
  type TransactionEvidence,
  type VerificationCheck,
} from '@lacuna/evidence-model'

export const DEFAULT_RPC_URL = 'https://rpc.starknet.lava.build'

type JsonRecord = Record<string, unknown>

export type RpcTransport = (method: string, params?: unknown) => Promise<unknown>

export type ReceiptVerification = {
  evidence: TransactionEvidence
  receipt: JsonRecord
  errors: string[]
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function uniqueStrings(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value as string[])]
}

export function parseSubmissionManifest(value: unknown, requireComplete = false): {
  manifest: SubmissionManifest | null
  errors: string[]
} {
  if (!isRecord(value)) return { manifest: null, errors: ['strk20.json must contain a JSON object.'] }

  const errors: string[] = []
  const transactions = uniqueStrings(value.transactions)
  const contracts = value.contracts === undefined ? undefined : uniqueStrings(value.contracts)

  if (transactions === null) errors.push('transactions must be an array of strings.')
  if (value.contracts !== undefined && contracts === null) errors.push('contracts must be an array of strings when present.')
  if (Array.isArray(value.transactions) && new Set(value.transactions).size !== value.transactions.length) {
    errors.push('transactions must not contain duplicates.')
  }
  if (Array.isArray(value.contracts) && new Set(value.contracts).size !== value.contracts.length) {
    errors.push('contracts must not contain duplicates.')
  }

  const demoVideo = value.demo_video
  const demoUrl = value.demo_url
  if (demoVideo !== undefined && (typeof demoVideo !== 'string' || !demoVideo.startsWith('https://'))) {
    errors.push('demo_video must be an HTTPS URL when present.')
  }
  if (demoUrl !== undefined && (typeof demoUrl !== 'string' || !demoUrl.startsWith('https://'))) {
    errors.push('demo_url must be an HTTPS URL when present.')
  }

  if (transactions?.some((hash) => !isTransactionHash(hash))) errors.push('transactions contains a malformed Starknet hash.')
  if (contracts?.some((address) => !isTransactionHash(address))) errors.push('contracts contains a malformed Starknet address.')
  if (errors.length > 0 || transactions === null || contracts === null) return { manifest: null, errors }

  const manifest: SubmissionManifest = {
    transactions,
    ...(contracts === undefined ? {} : { contracts }),
    ...(typeof demoVideo === 'string' ? { demo_video: demoVideo } : {}),
    ...(typeof demoUrl === 'string' ? { demo_url: demoUrl } : {}),
  }

  if (requireComplete) errors.push(...validateSubmissionManifest(manifest))
  return { manifest, errors }
}

export function validateManifestEvidence(
  manifest: SubmissionManifest,
  value: unknown,
): string[] {
  if (!isRecord(value) || !Array.isArray(value.evidence)) {
    return ['verification/mainnet/transaction-index.json must contain an evidence array.']
  }

  const errors: string[] = []
  const records: TransactionEvidence[] = []
  for (const [index, candidate] of value.evidence.entries()) {
    const parsed = parseTransactionEvidence(candidate)
    if (!parsed.ok) {
      errors.push(...parsed.errors.map((error) => `Evidence record ${index + 1}: ${error}`))
      continue
    }
    if (!isVerified(parsed.evidence)) {
      errors.push(`Evidence record ${index + 1} has not passed every required check.`)
    }
    records.push(parsed.evidence)
  }

  const manifestHashes = manifest.transactions.map((hash) => hash.toLowerCase())
  const evidenceHashes = records.map(({ transactionHash }) => transactionHash.toLowerCase())
  if (new Set(evidenceHashes).size !== evidenceHashes.length) {
    errors.push('Verified evidence must not contain duplicate transaction hashes.')
  }

  const manifestSet = new Set(manifestHashes)
  const evidenceSet = new Set(evidenceHashes)
  for (const hash of manifestHashes) {
    if (!evidenceSet.has(hash)) errors.push(`Manifest transaction ${hash} has no committed verified evidence.`)
  }
  for (const hash of evidenceHashes) {
    if (!manifestSet.has(hash)) errors.push(`Committed evidence ${hash} is not listed in strk20.json.`)
  }

  if ((manifest.demo_url !== undefined || manifest.demo_video !== undefined) && manifest.transactions.length < 3) {
    errors.push('Submission metadata requires at least three verified mainnet transaction hashes.')
  }
  return errors
}

export function createRpcTransport(
  endpoint: string,
  fetchImplementation: typeof fetch = fetch,
): RpcTransport {
  let id = 0
  return async (method, params = {}) => {
    const response = await fetchImplementation(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    })
    if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}.`)
    const payload: unknown = await response.json()
    if (!isRecord(payload)) throw new Error('RPC returned a malformed response.')
    if (isRecord(payload.error)) {
      throw new Error(`RPC ${String(payload.error.code)}: ${String(payload.error.message)}`)
    }
    return payload.result
  }
}

function sameFelt(left: unknown, right: string): boolean {
  if (typeof left !== 'string') return false
  try {
    return BigInt(left) === BigInt(right)
  } catch {
    return false
  }
}

function receiptEvents(receipt: JsonRecord): JsonRecord[] {
  return Array.isArray(receipt.events) ? receipt.events.filter(isRecord) : []
}

function feeFromReceipt(receipt: JsonRecord): { amount: string; unit: string } {
  const actualFee = isRecord(receipt.actual_fee) ? receipt.actual_fee : {}
  const rawAmount = typeof actualFee.amount === 'string' ? actualFee.amount : '0'
  let amount = rawAmount
  try {
    amount = BigInt(rawAmount).toString(10)
  } catch {
    amount = '0'
  }
  return { amount, unit: typeof actualFee.unit === 'string' ? actualFee.unit : 'UNKNOWN' }
}

export async function verifyTransactionReceipt(
  transactionHash: string,
  rpc: RpcTransport,
  verifiedAt = new Date().toISOString(),
): Promise<ReceiptVerification> {
  if (!isTransactionHash(transactionHash)) throw new Error('Transaction hash is malformed.')
  const value = await rpc('starknet_getTransactionReceipt', { transaction_hash: transactionHash })
  if (!isRecord(value)) throw new Error('Transaction receipt is malformed.')

  const succeeded = value.execution_status === 'SUCCEEDED'
  const confirmed = value.finality_status === 'ACCEPTED_ON_L1' || value.finality_status === 'ACCEPTED_ON_L2'
  const touchedPool = receiptEvents(value).some((event) => sameFelt(event.from_address, STRK20_MAINNET_POOL))
  const blockNumber = Number.isSafeInteger(value.block_number) ? Number(value.block_number) : -1
  const checks: VerificationCheck[] = [
    {
      name: 'receipt-succeeded',
      passed: succeeded,
      detail: succeeded ? 'Execution status is SUCCEEDED.' : `Execution status is ${String(value.execution_status)}.`,
    },
    {
      name: 'touched-pool',
      passed: touchedPool,
      detail: touchedPool ? 'Receipt includes an event from the verified STRK20 pool.' : 'No STRK20 pool event was found.',
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
    version: 1,
    transactionHash,
    chainId: STARKNET_MAINNET_CHAIN_ID,
    poolAddress: STRK20_MAINNET_POOL,
    operation: 'unclassified-pool-interaction',
    actualFee: feeFromReceipt(value),
    blockNumber,
    verifiedAt,
    checks,
    explorerUrl: `https://voyager.online/tx/${transactionHash}`,
  }
  const parsed = parseTransactionEvidence(evidence)
  const errors = [
    ...(parsed.ok ? [] : parsed.errors),
    ...checks.filter(({ passed }) => !passed).map(({ detail }) => detail),
  ]
  return { evidence, receipt: value, errors }
}

export async function verifyMainnetManifest(
  manifest: SubmissionManifest,
  rpc: RpcTransport,
  verifiedAt = new Date().toISOString(),
): Promise<ReceiptVerification[]> {
  const chainId = await rpc('starknet_chainId')
  if (chainId !== '0x534e5f4d41494e' && chainId !== STARKNET_MAINNET_CHAIN_ID) {
    throw new Error(`RPC is not Starknet Mainnet; received ${String(chainId)}.`)
  }
  return await Promise.all(
    manifest.transactions.map((hash) => verifyTransactionReceipt(hash, rpc, verifiedAt)),
  )
}

export async function writeVerificationArtifacts(
  root: string,
  results: ReceiptVerification[],
): Promise<void> {
  const failed = results.find(({ evidence, errors }) => errors.length > 0 || !isVerified(evidence))
  if (failed) {
    throw new Error(`Refusing to write failed verification result ${failed.evidence.transactionHash}.`)
  }

  const hashes = results.map(({ evidence }) => evidence.transactionHash.toLowerCase())
  if (new Set(hashes).size !== hashes.length) {
    throw new Error('Refusing to write duplicate verification results.')
  }

  const directory = join(root, 'verification', 'mainnet')
  const receiptsDirectory = join(directory, 'receipts')
  const nextReceiptsDirectory = join(directory, '.receipts-next')
  const indexPath = join(directory, 'transaction-index.json')
  const nextIndexPath = join(directory, '.transaction-index.next.json')
  await mkdir(directory, { recursive: true })
  await rm(nextReceiptsDirectory, { recursive: true, force: true })
  await mkdir(nextReceiptsDirectory)

  for (const result of results) {
    const fileName = `${result.evidence.transactionHash.toLowerCase()}.json`
    await writeFile(join(nextReceiptsDirectory, fileName), `${JSON.stringify(result.receipt, null, 2)}\n`, 'utf8')
  }
  await writeFile(
    nextIndexPath,
    `${JSON.stringify({ evidence: results.map(({ evidence }) => evidence) }, null, 2)}\n`,
    'utf8',
  )

  await rm(receiptsDirectory, { recursive: true, force: true })
  await rename(nextReceiptsDirectory, receiptsDirectory)
  await rm(indexPath, { force: true })
  await rename(nextIndexPath, indexPath)
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown
}

async function main(): Promise<void> {
  const root = resolve(process.cwd())
  const command = process.argv[2] ?? 'check-manifest'
  const manifestPath = join(root, 'strk20.json')
  const parsed = parseSubmissionManifest(await readJson(manifestPath), command === 'verify-mainnet')

  if (!parsed.manifest || parsed.errors.length > 0) {
    for (const error of parsed.errors) console.error(`error: ${error}`)
    process.exitCode = 1
    return
  }

  if (command === 'check-manifest') {
    const evidencePath = join(root, 'verification', 'mainnet', 'transaction-index.json')
    const evidenceErrors = validateManifestEvidence(parsed.manifest, await readJson(evidencePath))
    if (evidenceErrors.length > 0) {
      for (const error of evidenceErrors) console.error(`error: ${error}`)
      process.exitCode = 1
      return
    }
    console.log(`strk20.json and committed evidence agree (${parsed.manifest.transactions.length} transaction hashes).`)
    return
  }

  if (command !== 'verify-mainnet') {
    console.error('Usage: npm run lacuna -- check-manifest | verify-mainnet [--write]')
    process.exitCode = 1
    return
  }

  const endpoint = process.env.LACUNA_RPC_URL ?? DEFAULT_RPC_URL
  const results = await verifyMainnetManifest(parsed.manifest, createRpcTransport(endpoint))
  for (const result of results) {
    console.log(`${isVerified(result.evidence) ? 'verified' : 'failed'} ${result.evidence.transactionHash}`)
    result.errors.forEach((error) => console.error(`  ${error}`))
  }

  const hasFailures = results.some(({ evidence, errors }) => errors.length > 0 || !isVerified(evidence))
  if (hasFailures) process.exitCode = 1
  if (process.argv.includes('--write')) {
    if (hasFailures) {
      console.error('Refusing to write evidence because one or more receipt checks failed.')
    } else {
      await writeVerificationArtifacts(root, results)
      console.log(`Wrote verified evidence under ${join('verification', 'mainnet')}.`)
    }
  }
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entryPath) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
