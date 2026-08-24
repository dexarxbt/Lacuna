import { Studio } from '../features/studio/Studio'

export function StudioPage() {
  return (
    <main className="studio-page" id="top">
      <section className="studio-page-hero wrap">
        <div>
          <p className="kicker">LIVE PRIVACY WORKBENCH</p>
          <h1>See every edge<br /><em>before you sign</em></h1>
          <p>Move from protocol intent to disclosure map, wallet capability, and public evidence without surrendering wallet custody.</p>
          <a className="button secondary" href="#studio">Explore the workbench ↓</a>
        </div>
        <div aria-hidden="true" className="studio-orbit-art">
          <span className="orbit orbit-one"><i /></span>
          <span className="orbit orbit-two"><i /></span>
          <span className="orbit orbit-three"><i /></span>
          <div className="orbit-core"><b>STRK20</b><small>PRIVATE PATH</small></div>
          <em className="orbit-label orbit-public">PUBLIC</em>
          <em className="orbit-label orbit-wallet">WALLET</em>
          <em className="orbit-label orbit-proof">EVIDENCE</em>
        </div>
      </section>
      <Studio />
    </main>
  )
}
