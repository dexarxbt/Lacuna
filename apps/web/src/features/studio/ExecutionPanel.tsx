import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatWalletError,
  isUserRejection,
  prepareInvoke,
  probeWallet,
  submitInvoke,
  type PreparedInvoke,
} from '@lacuna/wallet-bridge'
import {
  createWalletSession,
  markExecutionCapabilityProven,
  type WalletSession,
} from '../wallet-doctor/walletSession'
import {
  createExecutionSnapshot,
  draftMatchesSnapshot,
  formatTokenAmount,
  getTokenAmountMetadata,
  parseTokenAmount,
  recipientCheckIsCurrent,
  recipientIsReady,
  sessionMatchesSnapshot,
  walletActionErrorMessage,
  type ExecutionDraft,
  type ExecutionFailureStage,
  type ExecutionKind,
  type ExecutionSnapshot,
  type RecipientRegistrationStatus,
} from './execution'
import {
  checkStrk20RecipientRegistration,
  createBrowserRpc,
  verifySubmittedTransaction,
  type ReceiptCheckResult,
} from './mainnetReceipt'

type ExecutionPanelProps = {
  session: WalletSession | null
  onSessionChange: (session: WalletSession | null) => void
}

type RecipientReadiness = 'recipient-confirmed' | 'rpc-verified' | 'not-applicable'

type PreparedReview = Readonly<{
  snapshot: ExecutionSnapshot
  simulation: PreparedInvoke
  recipientReadiness: RecipientReadiness
}>

type ConsentState = {
  network: boolean
  disclosures: boolean
  fee: boolean
}

const initialConsent: ConsentState = {
  network: false,
  disclosures: false,
  fee: false,
}

function shortFelt(value: string): string {
  return value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value
}

function displayTokenAmount(token: string, amount: string): string {
  const metadata = getTokenAmountMetadata(token)
  const formatted = metadata ? formatTokenAmount(amount, metadata) : null
  return formatted ?? `${amount} raw units`
}

function displayFrozenAmount(token: string, amount: string): string {
  const formatted = displayTokenAmount(token, amount)
  return formatted.endsWith('raw units') ? amount : `${formatted} · ${amount} raw`
}

function errorMessage(error: unknown): string {
  if (isUserRejection(error)) return 'The wallet request was rejected. Nothing was submitted.'
  return formatWalletError(error)
}

export function ExecutionPanel({ session, onSessionChange }: ExecutionPanelProps) {
  const [kind, setKind] = useState<ExecutionKind>('transfer')
  const [token, setToken] = useState('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [recipientConfirmed, setRecipientConfirmed] = useState(false)
  const [recipientRpcConsent, setRecipientRpcConsent] = useState(false)
  const [recipientRegistration, setRecipientRegistration] = useState<RecipientRegistrationStatus>('unchecked')
  const [prepared, setPrepared] = useState<PreparedReview | null>(null)
  const [consent, setConsent] = useState<ConsentState>(initialConsent)
  const [busy, setBusy] = useState<'checking-recipient' | 'simulating' | 'submitting' | 'verifying' | null>(null)
  const [message, setMessage] = useState('Run Wallet Doctor, then simulate an exact action before review.')
  const [errors, setErrors] = useState<string[]>([])
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
  const [receiptCheck, setReceiptCheck] = useState<ReceiptCheckResult | null>(null)
  const sessionRef = useRef(session)
  const submissionFlightRef = useRef(false)
  const verificationControllerRef = useRef<AbortController | null>(null)
  const recipientCheckControllerRef = useRef<AbortController | null>(null)
  const recipientCheckGenerationRef = useRef(0)
  const rpc = useMemo(() => createBrowserRpc(), [])

  const balances = session?.report.balances ?? []
  const allConsent = consent.network && consent.disclosures && consent.fee
  const amountMetadata = getTokenAmountMetadata(token)
  const rawAmount = amountMetadata ? parseTokenAmount(amount, amountMetadata.decimals) ?? '' : amount
  const draft: ExecutionDraft = { kind, token, amount: rawAmount, recipient }
  const recipientReady = recipientIsReady(kind, recipientConfirmed, recipientRegistration)
  const recipientReadiness: RecipientReadiness = kind === 'withdraw'
    ? 'not-applicable'
    : recipientRegistration === 'registered'
      ? 'rpc-verified'
      : 'recipient-confirmed'

  useEffect(() => {
    sessionRef.current = session
    if (prepared && !sessionMatchesSnapshot(session, prepared.snapshot)) {
      verificationControllerRef.current?.abort()
      recipientCheckGenerationRef.current += 1
      recipientCheckControllerRef.current?.abort()
      recipientCheckControllerRef.current = null
      setRecipientRegistration('unchecked')
      setPrepared(null)
      setConsent(initialConsent)
      setTransactionHash(null)
      setReceiptCheck(null)
      setErrors([])
      if (busy !== 'submitting') setBusy(null)
      setMessage(busy === 'submitting'
        ? 'Wallet changed while approval is pending. Review the wallet screen carefully; Lacuna will not retry.'
        : 'Wallet or account changed. Simulate the action again.')
    }
  }, [busy, prepared, session])

  useEffect(() => {
    const tokenStillAvailable = balances.some((balance) => balance.token === token)
    if (!tokenStillAvailable) setToken(balances[0]?.token ?? '')
  }, [balances, token])

  useEffect(() => () => {
    verificationControllerRef.current?.abort()
    recipientCheckControllerRef.current?.abort()
  }, [])

  function cancelRecipientCheck() {
    recipientCheckGenerationRef.current += 1
    recipientCheckControllerRef.current?.abort()
    recipientCheckControllerRef.current = null
  }

  function invalidateReview(nextMessage = 'Inputs changed. Run a new simulation before submitting.') {
    verificationControllerRef.current?.abort()
    setBusy(null)
    setPrepared(null)
    setConsent(initialConsent)
    setTransactionHash(null)
    setReceiptCheck(null)
    setErrors([])
    setMessage(nextMessage)
  }

  function changeKind(nextKind: ExecutionKind) {
    cancelRecipientCheck()
    setKind(nextKind)
    setRecipientConfirmed(false)
    setRecipientRpcConsent(false)
    setRecipientRegistration('unchecked')
    invalidateReview()
  }

  function changeToken(nextToken: string) {
    setToken(nextToken)
    invalidateReview()
  }

  function changeAmount(nextAmount: string) {
    setAmount(nextAmount.trim())
    invalidateReview()
  }

  function changeRecipient(nextRecipient: string) {
    cancelRecipientCheck()
    setRecipient(nextRecipient.trim())
    setRecipientConfirmed(false)
    setRecipientRpcConsent(false)
    setRecipientRegistration('unchecked')
    invalidateReview()
  }

  async function checkRecipientRegistration() {
    if (busy !== null || kind !== 'transfer') return
    recipientCheckGenerationRef.current += 1
    const generation = recipientCheckGenerationRef.current
    recipientCheckControllerRef.current?.abort()
    const controller = new AbortController()
    recipientCheckControllerRef.current = controller
    setRecipientConfirmed(false)
    setBusy('checking-recipient')
    setRecipientRegistration('checking')
    setErrors([])
    setMessage('Checking recipient registration through the disclosed public Mainnet RPC…')
    try {
      const result = await checkStrk20RecipientRegistration(recipient, rpc, {
        recipientDisclosureConfirmed: recipientRpcConsent,
        signal: controller.signal,
      })
      if (!recipientCheckIsCurrent(
        generation,
        recipientCheckGenerationRef.current,
        controller.signal.aborted,
      )) return
      if (result.registered) {
        setRecipientRegistration('registered')
        setMessage('Recipient registration is verified on the STRK20 Mainnet pool. Ready will establish any missing sender channel or token subchannel during prepare.')
      } else {
        setRecipientRegistration('unregistered')
        setErrors(['The recipient is not registered with the STRK20 Mainnet pool. Only the recipient can enable STRK20 privacy in their wallet.'])
        setMessage('Private transfer is blocked before any wallet simulation request.')
      }
    } catch (error) {
      if (!recipientCheckIsCurrent(
        generation,
        recipientCheckGenerationRef.current,
        controller.signal.aborted,
      )) return
      setRecipientRegistration('failed')
      setErrors([errorMessage(error)])
      setMessage('Recipient registration could not be verified. No wallet simulation request was made.')
    } finally {
      if (recipientCheckIsCurrent(
        generation,
        recipientCheckGenerationRef.current,
        controller.signal.aborted,
      )) {
        recipientCheckControllerRef.current = null
        setBusy(null)
      }
    }
  }

  async function simulate() {
    if (busy !== null) return
    if (amountMetadata && rawAmount === '') {
      setErrors([`Enter a valid ${amountMetadata.symbol} amount with at most ${amountMetadata.decimals} decimal places.`])
      setMessage('Simulation is blocked until the token amount is valid.')
      return
    }
    if (!recipientReady) {
      setErrors(['Confirm that the recipient enabled STRK20 privacy, or explicitly verify registration through the disclosed public RPC, before simulating.'])
      setMessage('Private transfer is blocked because recipient readiness has not been confirmed.')
      return
    }
    const startingSession = sessionRef.current
    if (startingSession === null) {
      setErrors(['Run Wallet Doctor and select a compatible Mainnet wallet first.'])
      return
    }

    const requestedDraft = Object.freeze({ ...draft })
    setBusy('simulating')
    setErrors([])
    setMessage('Re-checking account, network, API, and private balances…')
    let failureStage: ExecutionFailureStage = 'preflight'
    try {
      const freshReport = await probeWallet(startingSession.wallet)
      if (sessionRef.current?.wallet !== startingSession.wallet) {
        throw new Error('Wallet changed during the probe. Start the simulation again.')
      }

      const freshSession = createWalletSession(startingSession.wallet, freshReport)
      const snapshotResult = createExecutionSnapshot(freshSession, requestedDraft)
      if (!snapshotResult.ok) {
        onSessionChange(freshSession)
        setErrors(snapshotResult.errors)
        setMessage('Simulation is blocked until every runtime input is valid.')
        return
      }

      setMessage('Requesting a non-submittable wallet simulation…')
      failureStage = 'prepare'
      const simulation = await prepareInvoke(freshSession.wallet, snapshotResult.snapshot.actions)
      failureStage = 'post-prepare'
      if (sessionRef.current !== startingSession) {
        throw new Error('Wallet session changed during simulation. Review the current wallet and try again.')
      }
      const preparedSession = markExecutionCapabilityProven(freshSession, 'strk20PrepareInvoke')
      onSessionChange(preparedSession)
      setPrepared(Object.freeze({
        snapshot: snapshotResult.snapshot,
        simulation,
        recipientReadiness,
      }))
      setConsent(initialConsent)
      setTransactionHash(null)
      setReceiptCheck(null)
      setMessage('Simulation succeeded. Review the frozen action and confirm each gate.')
    } catch (error) {
      setErrors([walletActionErrorMessage(error, requestedDraft.kind, failureStage)])
      setMessage(failureStage === 'prepare'
        ? 'Wallet simulation failed during wallet_strk20PrepareInvoke. No transaction was submitted.'
        : failureStage === 'post-prepare'
          ? 'Wallet preparation succeeded, but its response was discarded because the local wallet session changed. No transaction was submitted.'
          : 'Simulation preflight did not complete. No wallet prepare request was made.')
    } finally {
      setBusy(null)
    }
  }

  async function verifyReceipt(hash: string, snapshot: ExecutionSnapshot) {
    verificationControllerRef.current?.abort()
    const controller = new AbortController()
    verificationControllerRef.current = controller
    setBusy('verifying')
    setReceiptCheck(null)
    setMessage('Submitted, not yet verified. Checking the public Mainnet receipt…')
    try {
      const result = await verifySubmittedTransaction(
        hash,
        snapshot.action.type === 'transfer' ? 'private-transfer' : 'withdraw',
        rpc,
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setReceiptCheck(result)
      setErrors(result.status === 'verified' ? [] : [...result.errors])
      setMessage(result.status === 'verified'
        ? 'Receipt independently verified against the Mainnet pool rules.'
        : 'The bounded receipt check ended without complete verification.')
    } catch (error) {
      if (controller.signal.aborted) return
      setErrors([errorMessage(error)])
      setMessage('The public receipt check could not complete. The transaction remains submitted, not verified.')
    } finally {
      if (!controller.signal.aborted) setBusy(null)
    }
  }

  async function submit() {
    if (busy !== null || submissionFlightRef.current || transactionHash !== null) return
    if (prepared === null || !draftMatchesSnapshot(draft, prepared.snapshot)) {
      setErrors(['The current inputs do not match the simulated action. Simulate again.'])
      return
    }
    const currentSession = sessionRef.current
    if (!sessionMatchesSnapshot(currentSession, prepared.snapshot)) {
      setErrors(['Wallet, account, or network changed after simulation. Simulate again.'])
      return
    }
    if (!allConsent) {
      setErrors(['Confirm the Mainnet, disclosure, and final-fee review gates before submitting.'])
      return
    }

    submissionFlightRef.current = true
    setBusy('submitting')
    setErrors([])
    setMessage('Re-checking wallet, account, network, API, and balance before submission…')
    let failureStage: ExecutionFailureStage = 'preflight'
    try {
      const latestReport = await probeWallet(currentSession.wallet)
      if (sessionRef.current !== currentSession) {
        throw new Error('Wallet session changed during the final preflight. Simulate again.')
      }
      const latestSession = createWalletSession(currentSession.wallet, latestReport)
      const latestSnapshot = createExecutionSnapshot(latestSession, draft)
      if (!latestSnapshot.ok) {
        throw new Error(`Final wallet preflight failed: ${latestSnapshot.errors.join(' ')}`)
      }
      if (latestSnapshot.snapshot.fingerprint !== prepared.snapshot.fingerprint) {
        throw new Error('Wallet, account, or action state changed after simulation. Simulate again.')
      }

      setMessage('Final preflight passed. Waiting for your wallet approval; Lacuna will not retry.')
      const preparedLatestSession = markExecutionCapabilityProven(
        latestSession,
        'strk20PrepareInvoke',
      )
      failureStage = 'submit'
      const result = await submitInvoke(preparedLatestSession.wallet, prepared.snapshot.actions, {
        networkConfirmed: true,
        disclosuresConfirmed: true,
        feeConfirmed: true,
      })
      failureStage = 'post-submit'
      setTransactionHash(result.transaction_hash)
      if (sessionRef.current === currentSession) {
        const submittedSession = markExecutionCapabilityProven(
          preparedLatestSession,
          'strk20InvokeTransaction',
        )
        onSessionChange(submittedSession)
      }
      setMessage('Transaction hash returned. This means submitted, not verified.')
      await verifyReceipt(result.transaction_hash, prepared.snapshot)
    } catch (error) {
      const submittedKind: ExecutionKind = prepared.snapshot.action.type === 'transfer' ? 'transfer' : 'withdraw'
      setErrors([walletActionErrorMessage(error, submittedKind, failureStage)])
      setMessage(failureStage === 'submit'
        ? 'Wallet submission failed during wallet_strk20InvokeTransaction before a valid transaction hash returned. Lacuna did not retry.'
        : failureStage === 'post-submit'
          ? 'The wallet returned from submission, but local post-submit handling failed. Check wallet activity before retrying; Lacuna did not retry.'
          : 'Final wallet preflight failed before wallet_strk20InvokeTransaction. No submission request was made.')
      setBusy(null)
    } finally {
      submissionFlightRef.current = false
    }
  }

  function startNewAction() {
    cancelRecipientCheck()
    setAmount('')
    setRecipient('')
    setRecipientConfirmed(false)
    setRecipientRpcConsent(false)
    setRecipientRegistration('unchecked')
    invalidateReview('Enter the next action, then run a fresh simulation.')
  }

  return (
    <section aria-labelledby="execution-title" className="execution-panel" id="execution">
      <header className="execution-heading">
        <div>
          <p className="panel-label">USER-INITIATED MAINNET EXECUTION</p>
          <h3 id="execution-title">Simulate, review, then choose whether to submit</h3>
        </div>
        <span className={session ? 'execution-session connected' : 'execution-session'}>
          <i /> {session ? `${session.report.walletName} connected` : 'Wallet required'}
        </span>
      </header>

      <div className="execution-grid">
        <form className="execution-form" onSubmit={(event) => { event.preventDefault(); void simulate() }}>
          <fieldset disabled={busy !== null || transactionHash !== null}>
            <legend>1 / Exact action</legend>
            <div className="execution-kind" role="group" aria-label="Private action type">
              <button aria-pressed={kind === 'transfer'} onClick={() => changeKind('transfer')} type="button">Private transfer</button>
              <button aria-pressed={kind === 'withdraw'} onClick={() => changeKind('withdraw')} type="button">Withdraw</button>
            </div>

            <label>
              Wallet-reported token and exact private balance
              <select onChange={(event) => changeToken(event.target.value)} required value={token}>
                <option disabled value="">Run Wallet Doctor to load tokens</option>
                {balances.map((balance) => (
                  <option key={balance.token} value={balance.token}>
                    {shortFelt(balance.token)} · balance {displayTokenAmount(balance.token, balance.balance)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {amountMetadata ? `Amount (${amountMetadata.symbol})` : 'Amount in raw base units'}
              <input
                autoComplete="off"
                inputMode={amountMetadata ? 'decimal' : 'numeric'}
                onChange={(event) => changeAmount(event.target.value)}
                placeholder={amountMetadata ? 'Example: 1 or 0.5' : 'Decimal raw units or canonical 0x felt'}
                required
                spellCheck={false}
                value={amount}
              />
              {amountMetadata && (
                <small className="execution-amount-help">
                  Enter normal {amountMetadata.symbol} units. The wallet receives the exact {amountMetadata.decimals}-decimal raw value shown in review.
                </small>
              )}
            </label>

            <label>
              {kind === 'transfer' ? 'Recipient address' : 'Public destination address'}
              <input
                autoComplete="off"
                onChange={(event) => changeRecipient(event.target.value)}
                placeholder="0x…"
                required
                spellCheck={false}
                value={recipient}
              />
              {kind === 'transfer' && (
                <small className="execution-amount-help">
                  Registration is a transfer-only prerequisite. Lacuna never assumes an address is registered.
                </small>
              )}
            </label>

            {kind === 'transfer' && (
              <div className="execution-recipient-check">
                <strong>Recipient readiness</strong>
                <p>Ready handles sender channel and token-subchannel setup privately. Before prepare, confirm registration without an RPC lookup, or explicitly opt in to the public check below.</p>
                <label>
                  <input
                    checked={recipientConfirmed}
                    disabled={recipientRegistration === 'unregistered'}
                    onChange={(event) => setRecipientConfirmed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>The recipient confirmed they enabled STRK20 privacy in their own wallet.</span>
                </label>
                <label>
                  <input
                    checked={recipientRpcConsent}
                    onChange={(event) => setRecipientRpcConsent(event.target.checked)}
                    type="checkbox"
                  />
                  <span>I consent to disclose this recipient address to https://rpc.starknet.lava.build for a public STRK20 registration lookup.</span>
                </label>
                <button
                  className="execution-recipient-query"
                  disabled={!recipient || !recipientRpcConsent || busy !== null}
                  onClick={() => { void checkRecipientRegistration() }}
                  type="button"
                >
                  {recipientRegistration === 'checking' ? 'Checking registration…' : 'Check registration on Mainnet'}
                </button>
                <small className={`execution-recipient-status ${recipientRegistration}`}>
                  {recipientRegistration === 'registered' && 'Registered on the verified STRK20 Mainnet pool.'}
                  {recipientRegistration === 'unregistered' && 'Not registered. The recipient must enable STRK20 privacy first.'}
                  {recipientRegistration === 'failed' && 'Registration lookup failed; review the diagnostic below.'}
                  {recipientRegistration === 'checking' && 'Lookup in progress; the recipient has been disclosed to the selected RPC.'}
                  {recipientRegistration === 'unchecked' && 'No recipient address has been sent by this check.'}
                </small>
              </div>
            )}

            <button className="execution-simulate" disabled={!session || balances.length === 0 || !recipientReady || busy !== null} type="submit">
              {busy === 'simulating' ? 'Simulating in wallet…' : 'Run fresh simulation'}
            </button>
          </fieldset>
          <p>No arbitrary contract invoke is exposed. Simulation requests proof preparation but cannot submit.</p>
        </form>

        <div className="execution-review">
          <div className="execution-review-title">
            <span>2 / Frozen review</span>
            <strong>{prepared ? 'SIMULATED' : 'WAITING'}</strong>
          </div>

          {prepared ? (
            <>
              <dl className="execution-snapshot">
                <div><dt>Action</dt><dd>{prepared.snapshot.action.type === 'transfer' ? 'Private transfer' : 'Withdraw'}</dd></div>
                <div><dt>Account</dt><dd title={prepared.snapshot.account}>{shortFelt(prepared.snapshot.account)}</dd></div>
                <div><dt>Token</dt><dd title={'token' in prepared.snapshot.action ? prepared.snapshot.action.token : ''}>{'token' in prepared.snapshot.action ? shortFelt(prepared.snapshot.action.token) : ''}</dd></div>
                <div><dt>Amount</dt><dd>{'amount' in prepared.snapshot.action && 'token' in prepared.snapshot.action ? displayFrozenAmount(prepared.snapshot.action.token, prepared.snapshot.action.amount) : ''}</dd></div>
                <div><dt>Recipient</dt><dd title={'recipient' in prepared.snapshot.action ? prepared.snapshot.action.recipient : ''}>{'recipient' in prepared.snapshot.action ? shortFelt(prepared.snapshot.action.recipient) : ''}</dd></div>
                <div><dt>Recipient preflight</dt><dd>{prepared.recipientReadiness === 'rpc-verified' ? 'Pool registration verified' : prepared.recipientReadiness === 'recipient-confirmed' ? 'Confirmed by recipient' : 'Not required for withdrawal'}</dd></div>
                <div><dt>Wallet call</dt><dd>{shortFelt(prepared.simulation.call.contractAddress)} / {prepared.simulation.call.entryPoint}</dd></div>
              </dl>

              <div className="execution-disclosure">
                <strong>Disclosure boundary</strong>
                {prepared.snapshot.action.type === 'transfer' ? (
                  <p>Pool activity and timing remain public. The STRK20 recipe models sender, recipient, token, amount, notes, and proof as private or wallet-held.</p>
                ) : (
                  <p>Destination, token, amount, transaction timing, hash, relayer, and final fee are public. Source deposit and private history are not disclosed by the receipt.</p>
                )}
              </div>

              <div className="execution-consent">
                <label><input checked={consent.network} disabled={busy !== null || transactionHash !== null} onChange={(event) => setConsent({ ...consent, network: event.target.checked })} type="checkbox" /> <span>I confirm this action targets Starknet Mainnet from the account shown above.</span></label>
                <label><input checked={consent.disclosures} disabled={busy !== null || transactionHash !== null} onChange={(event) => setConsent({ ...consent, disclosures: event.target.checked })} type="checkbox" /> <span>I reviewed the action and its public, private, and wallet-held disclosure boundary.</span></label>
                <label><input checked={consent.fee} disabled={busy !== null || transactionHash !== null} onChange={(event) => setConsent({ ...consent, fee: event.target.checked })} type="checkbox" /> <span>I will review the final fee in the wallet approval screen; Lacuna does not invent a fee estimate.</span></label>
              </div>

              <button className="execution-submit" disabled={!allConsent || busy !== null || transactionHash !== null} onClick={() => { void submit() }} type="button">
                {busy === 'submitting' ? 'Waiting for wallet…' : 'Submit once in wallet'}
              </button>
              <small className="execution-no-retry">No automatic submission or transaction retry. Your wallet remains the final approval boundary.</small>
            </>
          ) : (
            <div className="execution-empty">
              <i aria-hidden="true" />
              <p>Validated simulation details will appear here. Proof data is never retained or rendered by Lacuna.</p>
            </div>
          )}
        </div>
      </div>

      <div aria-live="polite" className="execution-result">
        <div>
          <span>3 / Submission and receipt</span>
          <p>{message}</p>
        </div>
        {errors.length > 0 && <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
        {transactionHash && (
          <div className="execution-transaction">
            <span className={receiptCheck?.status === 'verified' ? 'verified' : 'submitted'}>
              <i /> {receiptCheck?.status === 'verified' ? 'VERIFIED' : busy === 'verifying' ? 'SUBMITTED · VERIFYING' : 'SUBMITTED · NOT VERIFIED'}
            </span>
            <code title={transactionHash}>{shortFelt(transactionHash)}</code>
            <a href={`https://voyager.online/tx/${transactionHash}`} rel="noreferrer" target="_blank">Open in Voyager ↗</a>
            {receiptCheck?.status === 'verified' && receiptCheck.evidence && (
              <small>SUCCEEDED · pool event found · accepted in block {receiptCheck.evidence.blockNumber}</small>
            )}
            {receiptCheck?.status === 'unverified' && busy === null && (
              <button onClick={() => { if (prepared) void verifyReceipt(transactionHash, prepared.snapshot) }} type="button">Check receipt again</button>
            )}
            {busy === null && <button onClick={startNewAction} type="button">Start new action</button>}
          </div>
        )}
      </div>
    </section>
  )
}
