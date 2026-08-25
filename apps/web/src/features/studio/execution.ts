import {
  STARKNET_MAINNET_CHAIN_ID,
  validateActions,
  type Address,
  type Strk20Action,
} from '@lacuna/wallet-bridge'
import type { WalletSession } from '../wallet-doctor/walletSession'

export type ExecutionKind = 'transfer' | 'withdraw'

export type ExecutionDraft = Readonly<{
  kind: ExecutionKind
  token: string
  amount: string
  recipient: string
}>

export type ExecutionSnapshot = Readonly<{
  walletId: string
  account: string
  action: Readonly<Strk20Action>
  actions: readonly Readonly<Strk20Action>[]
  fingerprint: string
  availableBalance: string
}>

export type SnapshotResult =
  | { ok: true; snapshot: ExecutionSnapshot }
  | { ok: false; errors: string[] }

function canonicalFelt(value: string): string | null {
  try {
    return `0x${BigInt(value).toString(16)}`
  } catch {
    return null
  }
}

function sameFelt(left: string, right: string): boolean {
  const canonicalLeft = canonicalFelt(left)
  return canonicalLeft !== null && canonicalLeft === canonicalFelt(right)
}

function actionFromDraft(draft: ExecutionDraft): Strk20Action {
  const common = {
    token: draft.token as Address,
    amount: draft.amount,
    recipient: draft.recipient as Address,
  }
  return draft.kind === 'transfer'
    ? { type: 'transfer', ...common }
    : { type: 'withdraw', ...common }
}

function snapshotFingerprint(
  walletId: string,
  account: string,
  action: Strk20Action,
): string {
  return JSON.stringify({ walletId, account: canonicalFelt(account), action })
}

export function createExecutionSnapshot(
  session: WalletSession | null,
  draft: ExecutionDraft,
): SnapshotResult {
  const errors: string[] = []
  if (session === null) return { ok: false, errors: ['Run Wallet Doctor before simulating.'] }

  const { report } = session
  if (report.account === null) errors.push('The wallet did not provide an active account.')
  if (report.chainId !== STARKNET_MAINNET_CHAIN_ID) errors.push('The wallet must be connected to Starknet Mainnet.')
  if (!report.meetsRequiredApi) errors.push('The wallet did not prove the required Wallet API version.')
  if (report.strk20Status !== 'supported') errors.push('The STRK20 balance method was not proven.')
  if (report.registered !== true) errors.push('The selected account must be registered with the STRK20 pool.')

  const matchingBalance = report.balances.find(({ token }) => sameFelt(token, draft.token))
  if (!matchingBalance) errors.push('Select a token returned by the current wallet balance probe.')

  const action = actionFromDraft(draft)
  errors.push(...validateActions([action]))

  if (matchingBalance) {
    try {
      if (BigInt(draft.amount) > BigInt(matchingBalance.balance)) {
        errors.push('Amount exceeds the wallet-reported private balance.')
      }
    } catch {
      // validateActions reports malformed amounts; keep one source of format detail.
    }
  }

  if (errors.length > 0 || report.account === null || !matchingBalance) {
    return { ok: false, errors: [...new Set(errors)] }
  }

  const frozenAction = Object.freeze({ ...action }) as Readonly<Strk20Action>
  const actions = Object.freeze([frozenAction])
  return {
    ok: true,
    snapshot: Object.freeze({
      walletId: session.wallet.id,
      account: report.account,
      action: frozenAction,
      actions,
      fingerprint: snapshotFingerprint(session.wallet.id, report.account, action),
      availableBalance: matchingBalance.balance,
    }),
  }
}

export function draftMatchesSnapshot(
  draft: ExecutionDraft,
  snapshot: ExecutionSnapshot,
): boolean {
  return snapshot.fingerprint === snapshotFingerprint(
    snapshot.walletId,
    snapshot.account,
    actionFromDraft(draft),
  )
}

export function sessionMatchesSnapshot(
  session: WalletSession | null,
  snapshot: ExecutionSnapshot,
): session is WalletSession {
  return session !== null
    && session.wallet.id === snapshot.walletId
    && session.report.account !== null
    && sameFelt(session.report.account, snapshot.account)
    && session.report.chainId === STARKNET_MAINNET_CHAIN_ID
}
