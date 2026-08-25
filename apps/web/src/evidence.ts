import {
  parseEvidenceIndex,
  type TransactionEvidence,
} from '@lacuna/evidence-model'
import evidenceIndexDocument from '../../../verification/mainnet/transaction-index.json' with { type: 'json' }

const parsedEvidenceIndex = parseEvidenceIndex(evidenceIndexDocument)

if (!parsedEvidenceIndex.ok) {
  throw new Error(`Committed Mainnet evidence is invalid: ${parsedEvidenceIndex.errors.join(' ')}`)
}

export const verifiedTransactions: readonly TransactionEvidence[] = Object.freeze(
  parsedEvidenceIndex.evidence.map((record) => Object.freeze(record)),
)

const minimumRequiredTransactions = 3

export const evidenceSummary = Object.freeze({
  verifiedCount: verifiedTransactions.length,
  minimumMet: verifiedTransactions.length >= minimumRequiredTransactions,
})

export function shortenTransactionHash(transactionHash: string): string {
  return `${transactionHash.slice(0, 10)}…${transactionHash.slice(-8)}`
}

export function formatEvidenceOperation(operation: TransactionEvidence['operation']): string {
  const labels: Record<TransactionEvidence['operation'], string> = {
    shield: 'Shield',
    'private-transfer': 'Private transfer',
    'private-invoke': 'Private invoke',
    withdraw: 'Withdraw',
    register: 'Register',
    'unclassified-pool-interaction': 'Pool interaction',
  }

  return labels[operation]
}

export function rawReceiptUrl(transactionHash: string): string {
  return `https://github.com/dexarxbt/Lacuna/blob/main/verification/mainnet/receipts/${transactionHash}.json`
}
