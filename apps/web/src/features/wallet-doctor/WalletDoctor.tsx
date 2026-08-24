import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './wallet-doctor.css'
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
  'api-too-old': `The wallet reported an API older than ${REQUIRED_WALLET_API}. Update it and retry.`,
  'api-unreported': 'The wallet did not report its Wallet API version. Update or unlock it, then retry.',
  'strk20-unsupported': 'The wallet explicitly reported that the STRK20 balance method is unavailable.',
  'strk20-check-failed': 'The balance probe was inconclusive. Review the probe detail before changing wallets.',
  'not-registered': 'Register this account with the STRK20 pool before receiving private notes.',
}

function shortAddress(address: string | null): string {
  if (!address) return 'Unavailable'
  return address.length > 16 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address
}

function reportStatus(report: WalletCapabilityReport): { label: string; tone: string; summary: string } {
  if (report.strk20Status === 'unsupported') {
    return { label: 'Unsupported', tone: 'blocked', summary: 'The required STRK20 balance method is unavailable.' }
  }
  if (report.strk20Status === 'indeterminate') {
    return { label: 'Check incomplete', tone: 'warning', summary: 'The wallet did not return enough evidence to decide.' }
  }
  if (report.registered === false) {
    return { label: 'Registration needed', tone: 'warning', summary: 'STRK20 support is present, but this account is not registered.' }
  }
  if (report.issues.length > 0) {
    return { label: 'Action needed', tone: 'warning', summary: 'STRK20 responded, but another capability needs attention.' }
  }
  return { label: 'STRK20 ready', tone: 'ready', summary: 'Read-only capability checks passed.' }
}

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function WalletDoctor() {
  const [isOpen, setIsOpen] = useState(false)
  const [state, setState] = useState<DoctorState>('idle')
  const [wallets, setWallets] = useState<InjectedWallet[]>([])
  const [report, setReport] = useState<WalletCapabilityReport | null>(null)
  const [message, setMessage] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const probeIdRef = useRef(0)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      const initialFocus = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
      if (initialFocus) initialFocus.focus()
      else panelRef.current?.focus()
    }, 0)

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        probeIdRef.current += 1
        setIsOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)]
      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus()
    }
  }, [isOpen])

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
    const probeId = probeIdRef.current + 1
    probeIdRef.current = probeId
    setState('probing')
    setMessage('Waiting for wallet approval…')
    try {
      const nextReport = await probeWallet(wallet)
      if (probeIdRef.current !== probeId) return
      setReport(nextReport)
      setMessage(nextReport.detail)
      setState('complete')
    } catch (error) {
      if (probeIdRef.current !== probeId) return
      setState('error')
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  function close() {
    probeIdRef.current += 1
    setIsOpen(false)
  }

  const status = report ? reportStatus(report) : null

  const sheet = isOpen ? createPortal(
    <div
      className="doctor-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}
      role="presentation"
    >
      <div
        aria-busy={state === 'probing'}
        aria-describedby="wallet-doctor-description"
        aria-labelledby="wallet-doctor-title"
        aria-modal="true"
        className="wallet-doctor-panel"
        id="wallet-doctor-panel"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="doctor-header">
          <div>
            <span className="panel-label">CAPABILITY DOCTOR</span>
            <h3 id="wallet-doctor-title">Inspect, never assume</h3>
          </div>
          <button aria-label="Close wallet doctor" className="doctor-close" data-autofocus onClick={close} type="button">×</button>
        </header>

        <p className="doctor-intro" id="wallet-doctor-description">
          After you start the probe, Lacuna requests account access, checks the network and
          Wallet API, then calls the read-only STRK20 balance method. No transaction, proof,
          or signature is requested.
        </p>

        <div className="doctor-mode-strip" aria-label="Probe boundaries">
          <span><i /> USER-INITIATED</span><span>READ-ONLY</span><span>IN-MEMORY</span>
        </div>

        <div aria-live="polite" className="doctor-live-region">
          {state === 'choosing' && (
            <div className="wallet-options">
              <div className="doctor-section-heading"><span>Choose an injected wallet</span><small>{wallets.length} found</small></div>
              {wallets.map((wallet) => (
                <button key={wallet.id} onClick={() => void inspect(wallet)} type="button">
                  <span className="wallet-avatar">{wallet.name.slice(0, 1).toUpperCase()}</span>
                  <span><b>{wallet.name}</b><small>{wallet.version ?? wallet.id}</small></span>
                  <em>Inspect →</em>
                </button>
              ))}
            </div>
          )}

          {state === 'probing' && (
            <div className="doctor-progress">
              <span className="doctor-spinner" aria-hidden="true" />
              <div><b>Checking wallet capabilities</b><small>{message}</small></div>
            </div>
          )}

          {report && state === 'complete' && (
            <div className="doctor-report">
              <div className={`doctor-verdict ${status?.tone ?? ''}`}>
                <div><span><i /> {status?.label}</span><small>{status?.summary}</small></div>
                <strong>{report.walletName}</strong>
              </div>

              <dl>
                <div><dt>Account</dt><dd title={report.account ?? undefined}>{shortAddress(report.account)}</dd></div>
                <div><dt>Network</dt><dd>{report.chainId ?? 'Unknown'}</dd></div>
                <div><dt>Wallet API</dt><dd>{report.apiVersions.join(', ') || (report.meetsRequiredApi ? `${REQUIRED_WALLET_API}+ inferred` : 'Not reported')}</dd></div>
                <div><dt>STRK20 method</dt><dd>{report.strk20Status === 'supported' ? 'Available' : report.strk20Status === 'unsupported' ? 'Unavailable' : 'Inconclusive'}</dd></div>
                <div><dt>Registration</dt><dd>{report.registered === null ? 'Unknown' : report.registered ? 'Registered' : 'Required'}</dd></div>
                <div><dt>Shielded asset types</dt><dd>{report.balances.length}</dd></div>
              </dl>

              <details className="doctor-detail" open={report.issues.length > 0}>
                <summary>Probe diagnostics <span>{report.issues.length > 0 ? `${report.issues.length} issues` : 'passed'}</span></summary>
                <p>{report.detail || 'The wallet returned no additional diagnostic detail.'}</p>
              </details>

              {report.issues.length > 0 ? (
                <div className="doctor-issues">
                  {report.issues.map((issue) => (
                    <div key={issue}><i /><span><b>{issue.replaceAll('-', ' ')}</b><small>{issueGuidance[issue]}</small></span></div>
                  ))}
                </div>
              ) : (
                <div className="doctor-safe"><i /> Capability checks passed. Execution remains locked in this build.</div>
              )}

              <button className="doctor-recheck" onClick={discover} type="button">Check another wallet</button>
            </div>
          )}

          {state === 'error' && (
            <div className="doctor-error">
              <i />
              <div><b>Capability check stopped</b><p>{message}</p><small>Install or unlock a Starknet wallet, then retry. Never paste a seed phrase into Lacuna.</small></div>
            </div>
          )}
        </div>

        <footer className="doctor-boundary">
          <span>NO PROOF</span><span>NO SIGNATURE</span><span>NO TRANSACTION</span>
        </footer>
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <div className="wallet-doctor">
      <button
        aria-controls="wallet-doctor-panel"
        aria-expanded={isOpen}
        className={`wallet-trigger ${status?.tone ?? ''}`}
        onClick={discover}
        ref={triggerRef}
        type="button"
      >
        <i />
        <span>{status?.label ?? 'Check wallet'}</span>
        <b aria-hidden="true">↗</b>
      </button>
      {sheet}
    </div>
  )
}
