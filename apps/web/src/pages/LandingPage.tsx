import { useEffect } from 'react'
import { BoundaryArtwork } from '../components/BoundaryArtwork'
import { EvidenceLedger } from '../components/EvidenceLedger'
import { evidenceSummary } from '../evidence'
import './landing.css'

const evidenceThreshold = evidenceSummary.minimumMet ? 'MINIMUM MET' : 'MINIMUM PENDING'
const evidenceStatus = `${evidenceSummary.verifiedCount} VERIFIED · ${evidenceThreshold}`
const evidenceDetail = `${evidenceSummary.verifiedCount} accepted Mainnet pool receipts are committed in the public evidence index.`

const checkpoints = [
  {
    name: 'Recipe',
    status: 'IMPLEMENTED',
    tone: 'ready',
    detail: 'Choose a supported STRK20 action set and inspect its required inputs.',
  },
  {
    name: 'Inspect',
    status: 'IMPLEMENTED',
    tone: 'ready',
    detail: 'Map private, public, wallet-held, and correlatable information.',
  },
  {
    name: 'Validate',
    status: 'IMPLEMENTED · TESTED',
    tone: 'ready',
    detail: 'Check registration, maturity, balances, and invoke constraints.',
  },
  {
    name: 'Probe',
    status: 'IMPLEMENTED · READ-ONLY',
    tone: 'readonly',
    detail: 'Ask the connected wallet what it supports instead of assuming.',
  },
  {
    name: 'Simulate',
    status: 'IMPLEMENTED · USER-INITIATED',
    tone: 'gated',
    detail: 'Re-probe the selected wallet, validate exact transfer or withdrawal inputs, then request a non-submittable simulation.',
  },
  {
    name: 'Review',
    status: 'CONSENT-GATED · WALLET APPROVAL',
    tone: 'gated',
    detail: 'Submission requires an unchanged simulation, three explicit acknowledgements, and final approval in the wallet.',
  },
  {
    name: 'Verify',
    status: `IMPLEMENTED · ${evidenceStatus}`,
    tone: 'ready',
    detail: `Verify accepted receipts and export public evidence; ${evidenceDetail}`,
  },
] as const

const capabilities = [
  {
    capability: 'Recipe and disclosure engine',
    status: 'IMPLEMENTED · TESTED',
    tone: 'ready',
    detail: 'Supported STRK20 recipes expose their inputs, disclosures, and constraints.',
  },
  {
    capability: 'Protocol constraint validation',
    status: 'IMPLEMENTED · TESTED',
    tone: 'ready',
    detail: 'Registration, maturity, balance, and invoke checks run before execution.',
  },
  {
    capability: 'Interactive visibility inspector',
    status: 'IMPLEMENTED',
    tone: 'ready',
    detail: 'The studio separates protected, public, wallet-held, and derived data.',
  },
  {
    capability: 'Wallet API capability doctor',
    status: 'IMPLEMENTED · READ-ONLY',
    tone: 'readonly',
    detail: 'A user-initiated runtime check never prepares transactions; account access can require wallet approval.',
  },
  {
    capability: 'Simulated preparation adapter',
    status: 'IMPLEMENTED · USER-INITIATED',
    tone: 'gated',
    detail: 'Validated private transfers and withdrawals can be simulated after a fresh wallet, account, network, and balance probe.',
  },
  {
    capability: 'Submission adapter',
    status: 'CONSENT-GATED · MAINNET',
    tone: 'gated',
    detail: 'Only the frozen simulated action can be submitted, once, after three review gates and explicit wallet approval; arbitrary invoke is not exposed.',
  },
  {
    capability: 'Mainnet receipt evidence',
    status: evidenceStatus,
    tone: 'ready',
    detail: evidenceDetail,
  },
] as const

function useLandingReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return

    const root = document.documentElement
    const elements = [...document.querySelectorAll<HTMLElement>('.landing-reveal')]
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )

    elements.forEach((element) => observer.observe(element))
    root.classList.add('landing-reveal-ready')

    return () => {
      observer.disconnect()
      root.classList.remove('landing-reveal-ready')
    }
  }, [])
}

export function LandingPage() {
  useLandingReveal()

  return (
    <main className="landing-page" id="main-content">
      <section className="landing-hero wrap" aria-labelledby="landing-title">
        <div className="landing-hero-glow" aria-hidden="true" />
        <div className="landing-intro">
          <p className="landing-eyebrow">
            <span aria-hidden="true" /> THE LACUNA BETWEEN PRIVATE INTENT AND PUBLIC EXECUTION
          </p>
          <h1 id="landing-title">
            Build private flows
            <span>Know what leaks</span>
          </h1>
          <p className="landing-hero-copy">
            Inspect supported STRK20 recipes, disclosure boundaries, protocol constraints,
            and wallet capabilities before signing. Accepted Mainnet pool receipts are
            validated, committed, and published in an append-only evidence ledger.
          </p>
          <div className="landing-actions">
            <a className="button primary" href="/studio">Launch studio <span aria-hidden="true">↗</span></a>
            <a className="button secondary" href="https://github.com/dexarxbt/Lacuna">Inspect the source</a>
          </div>
        </div>
        <BoundaryArtwork />
      </section>

      <section className="landing-status-strip" aria-label="Current build status">
        <div className="wrap landing-status-grid">
          <div><span>TARGET</span><strong>Starknet Mainnet</strong></div>
          <div><span>PROTOCOL</span><strong>STRK20</strong></div>
          <div><span>STUDIO</span><strong className="status-ready">Simulate · review · approve</strong></div>
          <div><span>TRANSACTIONS</span><strong className="status-ready">{evidenceSummary.verifiedCount} verified · {evidenceThreshold.toLowerCase()}</strong></div>
        </div>
      </section>

      <section className="landing-section landing-problem wrap" id="boundary" aria-labelledby="boundary-title">
        <div className="landing-section-heading landing-reveal">
          <p className="landing-kicker">PRIVATE ≠ INVISIBLE</p>
          <h2 id="boundary-title">The private path still has public edges</h2>
          <p>
            Registration, maturity, balances, invoke constraints, wallet capabilities,
            and receipt evidence still decide where a STRK20 flow can go. Lacuna makes
            those boundaries inspectable before signing.
          </p>
        </div>
        <div className="landing-problem-grid">
          <article className="landing-problem-card landing-reveal">
            <div className="landing-problem-visual input-visual" aria-hidden="true"><i /><i /><i /></div>
            <p className="landing-card-index">01 / PUBLIC INPUTS</p>
            <h3>Privacy starts at a visible boundary</h3>
            <p>Network, action shape, pool, recipient state, and invoke constraints remain public facts.</p>
          </article>
          <article className="landing-problem-card landing-reveal">
            <div className="landing-problem-visual wallet-visual" aria-hidden="true"><i /><i /></div>
            <p className="landing-card-index">02 / WALLET CAPABILITIES</p>
            <h3>Support is a runtime fact</h3>
            <p>A user-initiated probe requests account access, then attempts network, API, and STRK20 checks subject to wallet enforcement.</p>
          </article>
          <article className="landing-problem-card landing-reveal">
            <div className="landing-problem-visual evidence-visual" aria-hidden="true"><i /><i /><i /></div>
            <p className="landing-card-index">03 / EVIDENCE</p>
            <h3>Implemented is not accepted</h3>
            <p>Receipt verification anchors {evidenceSummary.verifiedCount} accepted Mainnet pool interactions in public evidence.</p>
          </article>
        </div>
      </section>

      <section className="landing-section landing-flow" id="flow" aria-labelledby="flow-title">
        <div className="wrap">
          <div className="landing-section-heading landing-reveal">
            <p className="landing-kicker">SEVEN CHECKPOINTS ACROSS THE LACUNA</p>
            <h2 id="flow-title">From recipe to receipt, every stop has a status</h2>
            <p>
              Lacuna separates what can be inspected now, what remains gated, and what
              is backed by accepted Mainnet receipt evidence.
            </p>
          </div>
          <ol className="landing-checkpoints">
            {checkpoints.map((checkpoint, index) => (
              <li className="landing-checkpoint landing-reveal" key={checkpoint.name}>
                <div className="checkpoint-node" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="checkpoint-content">
                  <h3>{checkpoint.name}</h3>
                  <p className={`landing-status status-${checkpoint.tone}`}>{checkpoint.status}</p>
                  <p>{checkpoint.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section landing-ledger wrap" id="status" aria-labelledby="status-title">
        <div className="landing-section-heading landing-reveal">
          <p className="landing-kicker">WHAT WORKS · WHAT WAITS</p>
          <h2 id="status-title">Implemented, gated, or still a gap</h2>
          <p>
            This ledger mirrors Lacuna’s current build status. It distinguishes working
            code from studio exposure and accepted Mainnet evidence.
          </p>
        </div>
        <div className="landing-ledger-table landing-reveal" role="table" aria-label="Lacuna capability status">
          <div className="landing-ledger-head" role="row">
            <span role="columnheader">Capability</span>
            <span role="columnheader">Current state</span>
            <span role="columnheader">Boundary</span>
          </div>
          {capabilities.map((item, index) => (
            <div className="landing-ledger-row" role="row" key={item.capability}>
              <div className="ledger-capability" role="cell">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item.capability}</strong>
              </div>
              <p className={`landing-status status-${item.tone}`} role="cell">{item.status}</p>
              <p role="cell">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <EvidenceLedger />

      <section className="landing-final" aria-labelledby="final-title">
        <div className="landing-final-grid" aria-hidden="true" />
        <div className="landing-final-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="wrap landing-final-content landing-reveal">
          <p className="landing-kicker">THE LACUNA IS VISIBLE</p>
          <h2 id="final-title">Build private flows<br /><span>Know what leaks</span></h2>
          <p>
            Open the studio to inspect a supported STRK20 recipe, then review the public
            receipts that back Lacuna’s Mainnet evidence claims.
          </p>
          <div className="landing-actions">
            <a className="button primary" href="/studio">Launch studio <span aria-hidden="true">↗</span></a>
            <a className="button secondary" href="#transactions">Review transactions</a>
          </div>
        </div>
      </section>
    </main>
  )
}
