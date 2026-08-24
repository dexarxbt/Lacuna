import { useEffect } from 'react'
import { BoundaryArtwork } from '../components/BoundaryArtwork'
import './landing.css'

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
    status: 'IMPLEMENTED · GATED',
    tone: 'gated',
    detail: 'Preparation exists in code but stays hidden until real inputs are complete.',
  },
  {
    name: 'Review',
    status: 'CONSENT-GATED · LOCKED',
    tone: 'locked',
    detail: 'Transaction submission remains intentionally unavailable in the studio.',
  },
  {
    name: 'Verify',
    status: 'IMPLEMENTED · EVIDENCE PENDING',
    tone: 'pending',
    detail: 'Verify accepted receipts and export public evidence after execution.',
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
    status: 'IMPLEMENTED · GATED',
    tone: 'gated',
    detail: 'The adapter is not exposed while action inputs are placeholders.',
  },
  {
    capability: 'Submission adapter',
    status: 'CONSENT-GATED · LOCKED',
    tone: 'locked',
    detail: 'No transaction can be prepared, signed, or submitted from this build.',
  },
  {
    capability: 'Mainnet receipt evidence',
    status: 'TARGET: 3 ACCEPTED · CURRENT: 0',
    tone: 'pending',
    detail: 'The verifier and export path are tested; the public evidence index is empty.',
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
            and wallet capabilities before signing. Execution stays locked in the studio;
            accepted mainnet evidence is still pending.
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
          <div><span>STUDIO</span><strong className="status-locked">Execution locked</strong></div>
          <div><span>EVIDENCE</span><strong className="status-pending">3 accepted mainnet transactions pending</strong></div>
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
            <p>Receipt verification can work while the accepted mainnet evidence set remains empty.</p>
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
              still needs accepted mainnet evidence.
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
            code from studio exposure and accepted mainnet evidence.
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

      <section className="landing-final" aria-labelledby="final-title">
        <div className="landing-final-grid" aria-hidden="true" />
        <div className="landing-final-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="wrap landing-final-content landing-reveal">
          <p className="landing-kicker">THE LACUNA IS VISIBLE</p>
          <h2 id="final-title">Build private flows<br /><span>Know what leaks</span></h2>
          <p>
            Open the studio to inspect a supported STRK20 recipe. The current build does
            not prepare or sign transactions.
          </p>
          <div className="landing-actions">
            <a className="button primary" href="/studio">Launch studio <span aria-hidden="true">↗</span></a>
            <a className="button secondary" href="#status">Read the status ledger</a>
          </div>
        </div>
      </section>
    </main>
  )
}
