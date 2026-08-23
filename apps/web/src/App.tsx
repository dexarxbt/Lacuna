import { LacunaMark } from './components/LacunaMark'

const disclosures = [
  { label: 'Transfer amount', state: 'Private', tone: 'private' },
  { label: 'Pool interaction', state: 'Public', tone: 'public' },
  { label: 'Execution timing', state: 'Public', tone: 'public' },
  { label: 'Recipient identity', state: 'Wallet-held', tone: 'private' },
]

export function App() {
  return (
    <div className="site-shell">
      <header className="nav wrap">
        <a className="brand" href="#top" aria-label="Lacuna home">
          <LacunaMark className="brand-mark" />
          <span>LACUNA</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#boundary">Privacy model</a>
          <a href="https://github.com/dexarxbt/Lacuna">Source</a>
        </nav>
        <a className="nav-action" href="#studio">Open studio <span>↗</span></a>
      </header>

      <main id="top">
        <section className="hero wrap">
          <div className="eyebrow"><span /> STRK20 privacy development studio</div>
          <h1>Build private flows.<br /><em>Know what leaks.</em></h1>
          <p className="hero-copy">
            Compose, inspect, and verify STRK20 workflows with every public
            boundary made visible before a wallet signs.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#studio">Enter the studio</a>
            <a className="button secondary" href="https://github.com/dexarxbt/Lacuna">View source</a>
          </div>

          <div className="privacy-plane" aria-label="A private transfer moving through public and protected states">
            <div className="plane-grid" />
            <div className="plane-label label-left">PUBLIC EDGE</div>
            <div className="plane-label label-center">PRIVATE PATH</div>
            <div className="plane-label label-right">VERIFIED STATE</div>
            <div className="signal-path"><span /><i /><b /></div>
            <div className="aperture" aria-hidden="true">
              <span className="aperture-left" />
              <span className="aperture-core" />
              <span className="aperture-right" />
            </div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Current build status">
          <div className="wrap proof-grid">
            <div><span>NETWORK</span><strong>Starknet Mainnet</strong></div>
            <div><span>POOL</span><strong>STRK20</strong></div>
            <div><span>VERIFICATION</span><strong className="pending">In progress</strong></div>
            <div><span>LICENSE</span><strong>MIT</strong></div>
          </div>
        </section>

        <section className="section wrap" id="product">
          <div className="section-heading">
            <p className="kicker">01 / THE MISSING LAYER</p>
            <h2>Privacy integration is more than calling a function.</h2>
            <p>Wallet support, disclosure boundaries, proof latency, note maturity, and evidence all shape whether a private flow actually works.</p>
          </div>
          <div className="principle-grid">
            <article><span>01</span><h3>Compose</h3><p>Design protocol-valid private flows from focused STRK20 actions.</p></article>
            <article><span>02</span><h3>Inspect</h3><p>See what is protected, public, derived, or unsupported before signing.</p></article>
            <article><span>03</span><h3>Verify</h3><p>Follow proving, inclusion, maturity, and receipt evidence in one timeline.</p></article>
          </div>
        </section>

        <section className="studio-section wrap" id="studio">
          <div className="studio-window">
            <div className="studio-topbar">
              <div className="mini-brand"><LacunaMark /><span>shielded-transfer</span></div>
              <div className="network"><i /> SN_MAIN</div>
              <button type="button" disabled>Connect wallet</button>
            </div>
            <div className="studio-body">
              <aside className="recipe-rail">
                <span className="panel-label">RECIPE</span>
                <button className="active" type="button"><i /> Shielded transfer</button>
                <button type="button"><i /> Private invoke</button>
                <button type="button"><i /> Withdrawal</button>
              </aside>
              <div className="graph-canvas">
                <div className="graph-grid" />
                <div className="flow-node node-a"><span>01</span><small>PUBLIC ENTRY</small><strong>Deposit</strong><i /></div>
                <div className="flow-line line-a" />
                <div className="flow-node node-b selected"><span>02</span><small>PRIVATE ACTION</small><strong>Transfer</strong><i /></div>
                <div className="flow-line line-b" />
                <div className="flow-node node-c"><span>03</span><small>VERIFICATION</small><strong>Receipt</strong><i /></div>
              </div>
              <aside className="inspector" id="boundary">
                <span className="panel-label">VISIBILITY</span>
                <h3>Private transfer</h3>
                <p>What an observer can infer from this action.</p>
                <div className="disclosure-list">
                  {disclosures.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <strong className={item.tone}>{item.state}</strong>
                    </div>
                  ))}
                </div>
                <div className="constraint"><i /> One external privacy invoke allowed</div>
              </aside>
            </div>
            <div className="timeline"><span className="complete" /><b>Prepared</b><span /><b>Wallet confirmation</b><span /><b>Proving</b><span /><b>Verified</b></div>
          </div>
        </section>
      </main>

      <footer className="wrap footer">
        <div className="brand"><LacunaMark className="brand-mark" /><span>LACUNA</span></div>
        <p>Making the privacy boundary visible.</p>
        <a href="https://github.com/dexarxbt/Lacuna">MIT licensed · 2026</a>
      </footer>
    </div>
  )
}
