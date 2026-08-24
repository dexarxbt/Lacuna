import { Studio } from '../features/studio/Studio'
import '../features/studio/studio.css'

export function StudioPage() {
  return (
    <main className="studio-page" id="main-content">
      <section className="studio-route-hero wrap" aria-labelledby="studio-route-title">
        <div className="studio-route-copy">
          <p className="kicker">STRK20 BOUNDARY WORKBENCH</p>
          <h1 id="studio-route-title">Inspect the private path<br /><em>before you sign</em></h1>
          <p>
            Trace disclosures, protocol constraints, and wallet capabilities across a
            supported STRK20 recipe. Transaction preparation and submission remain locked.
          </p>
          <a className="button secondary" href="#studio">Open the workbench <span aria-hidden="true">↓</span></a>
        </div>

        <div className="studio-rift-art" aria-label="Public intent crossing a private boundary toward evidence review" role="img">
          <div className="studio-rift-grid" aria-hidden="true" />
          <span className="rift-plane rift-plane-left" aria-hidden="true" />
          <span className="rift-plane rift-plane-right" aria-hidden="true" />
          <span className="rift-line rift-line-one" aria-hidden="true" />
          <span className="rift-line rift-line-two" aria-hidden="true" />
          <div className="rift-core" aria-hidden="true"><i /><b>STRK20</b><small>PRIVATE PATH</small></div>
          <span className="rift-label rift-label-public">PUBLIC INTENT</span>
          <span className="rift-label rift-label-private">WALLET-HELD</span>
          <span className="rift-label rift-label-evidence">EVIDENCE REVIEW</span>
        </div>

        <dl className="studio-context-bar" aria-label="Current Studio boundaries">
          <div><dt>NETWORK TARGET</dt><dd><i className="context-dot ready" /> SN_MAIN</dd></div>
          <div><dt>PROTOCOL</dt><dd>STRK20</dd></div>
          <div><dt>MODE</dt><dd><i className="context-dot readonly" /> INSPECTION ONLY</dd></div>
          <div><dt>EXECUTION</dt><dd><i className="context-dot locked" /> LOCKED</dd></div>
          <div><dt>EVIDENCE</dt><dd>0 / 3 COMMITTED</dd></div>
        </dl>
      </section>

      <Studio />
    </main>
  )
}
