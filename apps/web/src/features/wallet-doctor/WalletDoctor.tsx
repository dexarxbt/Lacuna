import { useState } from 'react'
import {
  discoverInjectedWallets,
  probeWallet,
  REQUIRED_WALLET_API,
  type InjectedWallet,
  type WalletCapabilityReport,
} from '@lacuna/wallet-bridge'

type DoctorState = 'idle' | 'choosing' | 'probing' | 'complete' | 'error'

const issueGuidance: Record<WalletCapabilityReport['issues'][number], string> = {
  'no-account': 'Unlock the wallet and approve account access.',
  'wrong-network': 'Switch the selected account to Starknet Mainnet.',
  'api-too-old': `Use a wallet exposing Wallet API ${REQUIRED_WALLET_API} or newer.`,
  'strk20-unsupported': 'This wallet does not answer the read-only STRK20 balance method.',
  'not-registered': 'Register this account with the STRK20 pool before receiving private notes.',
}

function shortAddress(address: string | null): string {
  if (!address) return 'Unavailable'
  return address.length > 16 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address
}

function reportStatus(report: WalletCapabilityReport): { label: string; tone: string } {
  if (!report.strk20Supported) return { label: 'Unsupported', tone: 'blocked' }
  if (report.registered === false) return { label: 'Registration needed', tone: 'warning' }
  if (report.issues.length > 0) return { label: 'Action needed', tone: 'warning' }
  return { label: 'STRK20 ready', tone: 'ready' }
}

export function WalletDoctor() {
  const [isOpen, setIsOpen] = useState(false)
  const [state, setState] = useState<DoctorState>('idle')
  const [wallets, setWallets] = useState<InjectedWallet[]>([])
  const [report, setReport] = useState<WalletCapabilityReport | null>(null)
  const [message, setMessage] = useState('')

  function discover() {
    setIsOpen(true)
    setReport(null)
    setMessage('')
    const found = discoverInjectedWallets(window as unknown as Record<string, unknown>)
    setWallets(found)
    if (found.length === 0) {
      setState('error')
      setMessage('No injected Starknet wallet was found in this browser.')
      return
    }
    setState('choosing')
  }

  async function inspect(wallet: InjectedWallet) {
    setState('probing')
    setMessage('Waiting for wallet approval…')
    try {
      const nextReport = await probeWallet(wallet)
      setReport(nextReport)
      setMessage(nextReport.detail)
      setState('complete')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  function close() {
    setIsOpen(false)
  }

  const status = report ? reportStatus(report) : null

  return (
    <div className="wallet-doctor">
      <button className={`wallet-trigger ${status?.tone ?? ''}`} onClick={discover} type="button">
        <i />
        {status?.label ?? 'Check wallet'}
      </button>

      {isOpen && (
        <div aria-label="Wallet capability doctor" aria-modal="true" className="wallet-doctor-panel" role="dialog">
          <div className="doctor-header">
            <div>
              <span className="panel-label">CAPABILITY DOCTOR</span>
              <h3>Inspect, never assume.</h3>
            </div>
            <button aria-label="Close wallet doctor" className="doctor-close" onClick={close} type="button">×</button>
          </div>

          <p className="doctor-intro">
            Lacuna requests account access, checks the active network and Wallet API version,
            then calls the read-only STRK20 balance method. No transaction is prepared or signed.
          </p>

          {state === 'choosing' && (
            <div className="wallet-options">
              <span>Choose an injected wallet</span>
              {wallets.map((wallet) => (
                <button key={wallet.id} onClick={() => void inspect(wallet)} type="button">
                  <span className="wallet-avatar">{wallet.name.slice(0, 1).toUpperCase()}</span>
                  <span><b>{wallet.name}</b><small>{wallet.version ?? wallet.id}</small></span>
                  <em>Inspect ↗</em>
                </button>
              ))}
            </div>
          )}

          {state === 'probing' && (
            <div className="doctor-progress">
              <span className="doctor-spinner" />
              <div><b>Checking wallet capabilities</b><small>{message}</small></div>
            </div>
          )}

          {report && state === 'complete' && (
            <div className="doctor-report">
              <div className={`doctor-verdict ${status?.tone ?? ''}`}>
                <span><i /> {status?.label}</span>
                <strong>{report.walletName}</strong>
              </div>
              <dl>
                <div><dt>Account</dt><dd title={report.account ?? undefined}>{shortAddress(report.account)}</dd></div>
                <div><dt>Network</dt><dd>{report.chainId ?? 'Unknown'}</dd></div>
                <div><dt>Wallet API</dt><dd>{report.apiVersions.join(', ') || 'Not reported'}</dd></div>
                <div><dt>Registration</dt><dd>{report.registered === null ? 'Unknown' : report.registered ? 'Registered' : 'Required'}</dd></div>
                <div><dt>Shielded assets</dt><dd>{report.balances.length}</dd></div>
              </dl>

              {report.issues.length > 0 ? (
                <div className="doctor-issues">
                  {report.issues.map((issue) => (
                    <div key={issue}><i /><span><b>{issue.replaceAll('-', ' ')}</b><small>{issueGuidance[issue]}</small></span></div>
                  ))}
                </div>
              ) : (
                <div className="doctor-safe"><i /> Capability checks passed. Execution remains locked in this build.</div>
              )}
            </div>
          )}

          {state === 'error' && (
            <div className="doctor-error">
              <i />
              <div><b>Capability check stopped</b><p>{message}</p><small>Install or unlock a Starknet wallet, then retry. Never paste a seed phrase into Lacuna.</small></div>
            </div>
          )}

          <div className="doctor-boundary">
            <span>READ-ONLY PROBE</span>
            <span>NO PROOF</span>
            <span>NO SIGNATURE</span>
          </div>
        </div>
      )}
    </div>
  )
}
