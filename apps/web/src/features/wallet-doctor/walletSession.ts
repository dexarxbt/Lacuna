import type { Capability } from '@lacuna/recipe-engine'
import type { InjectedWallet, WalletCapabilityReport } from '@lacuna/wallet-bridge'

export type ProvenExecutionCapability = 'strk20PrepareInvoke' | 'strk20InvokeTransaction'

export type WalletSession = Readonly<{
  wallet: InjectedWallet
  report: WalletCapabilityReport
  provenExecutionCapabilities: readonly ProvenExecutionCapability[]
}>

export function createWalletSession(
  wallet: InjectedWallet,
  report: WalletCapabilityReport,
): WalletSession {
  if (wallet.id !== report.walletId) {
    throw new Error('Wallet session identity does not match the capability report.')
  }

  return Object.freeze({
    wallet,
    report,
    provenExecutionCapabilities: Object.freeze([]) as readonly ProvenExecutionCapability[],
  })
}

export function markExecutionCapabilityProven(
  session: WalletSession,
  capability: ProvenExecutionCapability,
): WalletSession {
  if (session.provenExecutionCapabilities.includes(capability)) return session
  return Object.freeze({
    ...session,
    provenExecutionCapabilities: Object.freeze([
      ...session.provenExecutionCapabilities,
      capability,
    ]),
  })
}

export function provenRecipeCapabilities(session: WalletSession | null): Capability[] {
  if (session?.report.strk20Status !== 'supported') return []
  return ['strk20Balances', ...session.provenExecutionCapabilities]
}
