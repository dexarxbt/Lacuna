import {
  isVerified,
  verifyReceiptValue,
  type TransactionEvidence,
} from '@lacuna/evidence-model'
import { STARKNET_MAINNET_CHAIN_ID } from '@lacuna/wallet-bridge'

export const MAINNET_RPC_URL = 'https://rpc.starknet.lava.build'
const MAINNET_CHAIN_ID_HEX = '0x534e5f4d41494e'

type JsonRecord = Record<string, unknown>
export type RpcTransport = (method: string, params?: unknown, signal?: AbortSignal) => Promise<unknown>

export type ReceiptCheckResult = Readonly<{
  status: 'verified' | 'unverified'
  evidence: TransactionEvidence | null
  errors: readonly string[]
  attempts: number
}>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, milliseconds)
    signal?.addEventListener('abort', () => {
      globalThis.clearTimeout(timer)
      reject(new DOMException('Receipt verification was cancelled.', 'AbortError'))
    }, { once: true })
  })
}

export function createBrowserRpc(
  endpoint = MAINNET_RPC_URL,
  fetchImplementation: typeof fetch = fetch,
  requestTimeoutMilliseconds = 10_000,
): RpcTransport {
  if (!Number.isSafeInteger(requestTimeoutMilliseconds) || requestTimeoutMilliseconds < 1_000 || requestTimeoutMilliseconds > 30_000) {
    throw new Error('RPC request timeout must be between 1000 and 30000 milliseconds.')
  }
  let id = 0
  return async (method, params = {}, signal) => {
    const timeoutSignal = AbortSignal.timeout(requestTimeoutMilliseconds)
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
    const response = await fetchImplementation(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      signal: requestSignal,
    })
    if (!response.ok) throw new Error(`Mainnet RPC returned HTTP ${response.status}.`)
    const payload: unknown = await response.json()
    if (!isRecord(payload)) throw new Error('Mainnet RPC returned a malformed response.')
    if (isRecord(payload.error)) {
      throw new Error(`Mainnet RPC ${String(payload.error.code)}: ${String(payload.error.message)}`)
    }
    return payload.result
  }
}

export async function verifySubmittedTransaction(
  transactionHash: string,
  operation: TransactionEvidence['operation'],
  rpc: RpcTransport,
  options: Readonly<{
    attempts?: number
    delayMilliseconds?: number
    signal?: AbortSignal
  }> = {},
): Promise<ReceiptCheckResult> {
  const attempts = options.attempts ?? 8
  const delayMilliseconds = options.delayMilliseconds ?? 3_500
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 20) {
    throw new Error('Receipt verification attempts must be between 1 and 20.')
  }

  const chainId = await rpc('starknet_chainId', {}, options.signal)
  if (chainId !== STARKNET_MAINNET_CHAIN_ID && chainId !== MAINNET_CHAIN_ID_HEX) {
    throw new Error(`Receipt RPC is not Starknet Mainnet; received ${String(chainId)}.`)
  }

  let lastEvidence: TransactionEvidence | null = null
  let lastErrors: string[] = ['Receipt is not available yet.']

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    options.signal?.throwIfAborted()
    try {
      const receipt = await rpc(
        'starknet_getTransactionReceipt',
        { transaction_hash: transactionHash },
        options.signal,
      )
      const verification = verifyReceiptValue(
        transactionHash,
        receipt,
        new Date().toISOString(),
        operation,
      )
      lastEvidence = verification.evidence
      lastErrors = verification.errors
      if (verification.errors.length === 0 && isVerified(verification.evidence)) {
        return Object.freeze({
          status: 'verified' as const,
          evidence: verification.evidence,
          errors: Object.freeze([]) as readonly string[],
          attempts: attempt,
        })
      }

      const accepted = verification.evidence.checks.find(({ name }) => name === 'block-confirmed')?.passed === true
      if (accepted) {
        return Object.freeze({
          status: 'unverified' as const,
          evidence: verification.evidence,
          errors: Object.freeze([...verification.errors]),
          attempts: attempt,
        })
      }
    } catch (error) {
      if (options.signal?.aborted) throw error
      lastErrors = [errorMessage(error)]
    }

    if (attempt < attempts) await wait(delayMilliseconds, options.signal)
  }

  return Object.freeze({
    status: 'unverified' as const,
    evidence: lastEvidence,
    errors: Object.freeze([...lastErrors]),
    attempts,
  })
}
