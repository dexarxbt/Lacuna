#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  canonicalStarknetFelt,
  isTransactionHash,
  isVerified,
  parseEvidenceIndex,
  STARKNET_MAINNET_CHAIN_ID,
  validateSubmissionManifest,
  verifyReceiptValue,
  type ReceiptVerification,
  type SubmissionManifest,
  type TransactionEvidence,
} from '@lacuna/evidence-model'

export { verifyReceiptValue } from '@lacuna/evidence-model'
export type { ReceiptVerification } from '@lacuna/evidence-model'

export const DEFAULT_RPC_URL = 'https://rpc.starknet.lava.build'

type JsonRecord = Record<string, unknown>

export type RpcTransport = (method: string, params?: unknown) => Promise<unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return value as string[]
}

function canonicalSet(values: string[]): Set<string> {
  return new Set(values.flatMap((value) => {
    const canonical = canonicalStarknetFelt(value)
    return canonical ? [canonical] : []
  }))
}

function hasCanonicalDuplicates(values: string[]): boolean {
  return canonicalSet(values).size !== values.length
}

export function parseSubmissionManifest(value: unknown, requireComplete = false): {
  manifest: SubmissionManifest | null
  errors: string[]
} {
  if (!isRecord(value)) return { manifest: null, errors: ['strk20.json must contain a JSON object.'] }

  const errors: string[] = []
  const transactions = stringArray(value.transactions)
  const contracts = value.contracts === undefined ? undefined : stringArray(value.contracts)

  if (transactions === null) errors.push('transactions must be an array of strings.')
  if (value.contracts !== undefined && contracts === null) errors.push('contracts must be an array of strings when present.')
  if (transactions && transactions.every(isTransactionHash) && hasCanonicalDuplicates(transactions)) {
    errors.push('transactions must not contain felt-equivalent duplicates.')
  }
  if (contracts && contracts.every(isTransactionHash) && hasCanonicalDuplicates(contracts)) {
    errors.push('contracts must not contain felt-equivalent duplicates.')
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
  requireExact = true,
): string[] {
  const parsed = parseEvidenceIndex(value)
  if (!parsed.ok) return parsed.errors.map((error) => `verification/mainnet/transaction-index.json: ${error}`)

  const errors: string[] = []
  const manifestSet = canonicalSet(manifest.transactions)
  const evidenceSet = canonicalSet(parsed.evidence.map(({ transactionHash }) => transactionHash))

  if (requireExact) {
    for (const hash of manifest.transactions) {
      const canonical = canonicalStarknetFelt(hash)
      if (canonical && !evidenceSet.has(canonical)) {
        errors.push(`Manifest transaction ${hash} has no committed verified evidence.`)
      }
    }
  }
  for (const evidence of parsed.evidence) {
    const canonical = canonicalStarknetFelt(evidence.transactionHash)
    if (canonical && !manifestSet.has(canonical)) {
      errors.push(`Committed evidence ${evidence.transactionHash} is not listed in strk20.json.`)
    }
  }

  return errors
}

export async function validateCommittedReceiptArtifacts(
  root: string,
  indexValue: unknown,
): Promise<string[]> {
  const parsed = parseEvidenceIndex(indexValue)
  if (!parsed.ok) return parsed.errors.map((error) => `verification/mainnet/transaction-index.json: ${error}`)

  const receiptsDirectory = join(root, 'verification', 'mainnet', 'receipts')
  const expectedFiles = new Set(parsed.evidence.map(({ transactionHash }) => `${transactionHash.toLowerCase()}.json`))
  const errors: string[] = []
  let receiptFiles: string[] = []
  try {
    receiptFiles = (await readdir(receiptsDirectory)).filter((name) => name.endsWith('.json'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  for (const fileName of receiptFiles) {
    if (!expectedFiles.has(fileName)) errors.push(`Unindexed raw receipt ${fileName} is present.`)
  }

  for (const evidence of parsed.evidence) {
    const fileName = `${evidence.transactionHash.toLowerCase()}.json`
    let receipt: unknown
    try {
      receipt = JSON.parse(await readFile(join(receiptsDirectory, fileName), 'utf8')) as unknown
    } catch (error) {
      const detail = (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'is missing'
        : `is unreadable: ${error instanceof Error ? error.message : String(error)}`
      errors.push(`Raw receipt ${fileName} ${detail}.`)
      continue
    }

    let verification: ReceiptVerification
    try {
      verification = verifyReceiptValue(
        evidence.transactionHash,
        receipt,
        evidence.verifiedAt,
        evidence.operation,
      )
    } catch (error) {
      errors.push(`Raw receipt ${fileName} is invalid: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (verification.errors.length > 0 || !isVerified(verification.evidence)) {
      errors.push(`Raw receipt ${fileName} failed verification: ${verification.errors.join(' ')}`)
      continue
    }
    if (!isDeepStrictEqual(verification.evidence, evidence)) {
      errors.push(`Raw receipt ${fileName} does not derive the committed evidence record.`)
    }
  }

  return errors
}

export const DEFAULT_RPC_TIMEOUT_MS = 10_000

export function createRpcTransport(
  endpoint: string,
  fetchImplementation: typeof fetch = fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
): RpcTransport {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('RPC timeout must be a positive integer in milliseconds.')
  }

  let id = 0
  return async (method, params = {}) => {
    const response = await fetchImplementation(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
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

export async function verifyTransactionReceipt(
  transactionHash: string,
  rpc: RpcTransport,
  verifiedAt = new Date().toISOString(),
): Promise<ReceiptVerification> {
  const value = await rpc('starknet_getTransactionReceipt', { transaction_hash: transactionHash })
  return verifyReceiptValue(transactionHash, value, verifiedAt)
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

async function readJsonIfPresent(filePath: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw error
  }
}

export async function writeVerificationArtifacts(
  root: string,
  results: ReceiptVerification[],
): Promise<void> {
  const failed = results.find(({ evidence, errors }) => errors.length > 0 || !isVerified(evidence))
  if (failed) {
    throw new Error(`Refusing to write failed verification result ${failed.evidence.transactionHash}.`)
  }

  const batchHashes = results.map(({ evidence }) => canonicalStarknetFelt(evidence.transactionHash))
  if (batchHashes.some((hash) => hash === null) || new Set(batchHashes).size !== batchHashes.length) {
    throw new Error('Refusing to write duplicate verification results.')
  }

  const directory = join(root, 'verification', 'mainnet')
  const receiptsDirectory = join(directory, 'receipts')
  const indexPath = join(directory, 'transaction-index.json')
  const nextIndexPath = join(directory, '.transaction-index.next.json')
  const existingValue = await readJsonIfPresent(indexPath, { evidence: [] })
  const existing = parseEvidenceIndex(existingValue)
  if (!existing.ok) throw new Error(`Refusing to append to invalid committed evidence: ${existing.errors.join(' ')}`)
  const artifactErrors = await validateCommittedReceiptArtifacts(root, existingValue)
  if (artifactErrors.length > 0) {
    throw new Error(`Refusing to append to invalid raw receipt artifacts: ${artifactErrors.join(' ')}`)
  }

  const existingHashes = canonicalSet(existing.evidence.map(({ transactionHash }) => transactionHash))
  const pendingResults = results.filter(({ evidence }) => {
    const canonical = canonicalStarknetFelt(evidence.transactionHash)
    return canonical !== null && !existingHashes.has(canonical)
  })
  if (pendingResults.length === 0) return

  for (const result of pendingResults) {
    let derived: ReceiptVerification
    try {
      derived = verifyReceiptValue(
        result.evidence.transactionHash,
        result.receipt,
        result.evidence.verifiedAt,
        result.evidence.operation,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`Refusing to publish malformed raw receipt ${result.evidence.transactionHash}: ${detail}`)
    }
    if (derived.errors.length > 0 || !isVerified(derived.evidence)) {
      throw new Error(`Refusing to publish raw receipt that failed verification ${result.evidence.transactionHash}.`)
    }
    if (!isDeepStrictEqual(derived.evidence, result.evidence)) {
      throw new Error(`Refusing to publish raw receipt that does not derive the proposed evidence ${result.evidence.transactionHash}.`)
    }
  }

  const mergedEvidence = [...existing.evidence, ...pendingResults.map(({ evidence }) => evidence)]
  const stagedIndex = parseEvidenceIndex({ evidence: mergedEvidence })
  if (!stagedIndex.ok) {
    throw new Error(`Refusing to write invalid merged evidence: ${stagedIndex.errors.join(' ')}`)
  }

  await mkdir(receiptsDirectory, { recursive: true })
  await rm(nextIndexPath, { force: true })
  const createdReceiptPaths: string[] = []
  try {
    for (const result of pendingResults) {
      const fileName = `${result.evidence.transactionHash.toLowerCase()}.json`
      const receiptPath = join(receiptsDirectory, fileName)
      await writeFile(receiptPath, `${JSON.stringify(result.receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
      createdReceiptPaths.push(receiptPath)
    }

    await writeFile(nextIndexPath, `${JSON.stringify({ evidence: mergedEvidence }, null, 2)}\n`, 'utf8')
    await rename(nextIndexPath, indexPath)
  } catch (error) {
    await rm(nextIndexPath, { force: true })
    await Promise.all(createdReceiptPaths.map((receiptPath) => rm(receiptPath, { force: true })))
    throw error
  }
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

  const evidencePath = join(root, 'verification', 'mainnet', 'transaction-index.json')
  if (command === 'check-manifest') {
    const evidenceValue = await readJson(evidencePath)
    const evidenceErrors = [
      ...validateManifestEvidence(parsed.manifest, evidenceValue),
      ...await validateCommittedReceiptArtifacts(root, evidenceValue),
    ]
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

  const existingValue = await readJsonIfPresent(evidencePath, { evidence: [] })
  const committedErrors = [
    ...validateManifestEvidence(parsed.manifest, existingValue, false),
    ...await validateCommittedReceiptArtifacts(root, existingValue),
  ]
  if (committedErrors.length > 0) {
    for (const error of committedErrors) console.error(`error: ${error}`)
    process.exitCode = 1
    return
  }
  const existing = parseEvidenceIndex(existingValue)
  if (!existing.ok) {
    for (const error of existing.errors) console.error(`error: ${error}`)
    process.exitCode = 1
    return
  }

  const committedHashes = canonicalSet(existing.evidence.map(({ transactionHash }) => transactionHash))
  const pendingTransactions = parsed.manifest.transactions.filter((hash) => {
    const canonical = canonicalStarknetFelt(hash)
    return canonical !== null && !committedHashes.has(canonical)
  })
  if (pendingTransactions.length === 0) {
    console.log(`No new transactions to verify; ${existing.evidence.length} receipts are already committed.`)
    return
  }

  const endpoint = process.env.LACUNA_RPC_URL ?? DEFAULT_RPC_URL
  const results = await verifyMainnetManifest(
    { ...parsed.manifest, transactions: pendingTransactions },
    createRpcTransport(endpoint),
  )
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
      const finalValue = await readJson(evidencePath)
      const finalErrors = [
        ...validateManifestEvidence(parsed.manifest, finalValue),
        ...await validateCommittedReceiptArtifacts(root, finalValue),
      ]
      if (finalErrors.length > 0) throw new Error(finalErrors.join(' '))
      console.log(`Appended ${results.length} verified receipt${results.length === 1 ? '' : 's'} under ${join('verification', 'mainnet')}.`)
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
