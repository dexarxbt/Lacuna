import { BoundaryArtwork } from '../components/BoundaryArtwork'

export function LandingPage() {
  return (
    <main id="top">
      <section className="hero wrap">
        <div className="eyebrow"><span /> STRK20 privacy development studio</div>
        <h1>Build private flows<br /><em>Know what leaks</em></h1>
        <p className="hero-copy">
          Compose, inspect, and verify STRK20 workflows with every public
          boundary made visible before a wallet signs.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="/studio">Enter the studio</a>
          <a className="button secondary" href="https://github.com/dexarxbt/Lacuna">View source</a>
        </div>
        <BoundaryArtwork />
      </section>

      <section className="proof-strip" aria-label="Current build status">
        <div className="wrap proof-grid">
          <div><span>NETWORK</span><strong>Starknet Mainnet</strong></div>
          <div><span>POOL</span><strong>STRK20</strong></div>
          <div><span>VERIFICATION</span><strong className="pending">Evidence pending</strong></div>
          <div><span>LICENSE</span><strong>MIT</strong></div>
        </div>
      </section>

      <section className="section wrap" id="product">
        <div className="section-heading">
          <p className="kicker">01 / THE MISSING LAYER</p>
          <h2>Privacy integration is more than calling a function</h2>
          <p>Wallet support, disclosure boundaries, proof latency, note maturity, and evidence all shape whether a private flow actually works.</p>
        </div>
        <div className="principle-grid">
          <article>
            <span>01</span><div aria-hidden="true" className="principle-visual compose-visual"><i /><i /><i /></div>
            <h3>Compose</h3><p>Design protocol-valid private flows from focused STRK20 actions.</p>
          </article>
          <article>
            <span>02</span><div aria-hidden="true" className="principle-visual inspect-visual"><i /><i /><i /></div>
            <h3>Inspect</h3><p>See what is protected, public, derived, or unsupported before signing.</p>
          </article>
          <article>
            <span>03</span><div aria-hidden="true" className="principle-visual verify-visual"><i /><i /></div>
            <h3>Verify</h3><p>Follow proving, inclusion, maturity, and receipt evidence in one timeline.</p>
          </article>
        </div>
      </section>
    </main>
  )
}
