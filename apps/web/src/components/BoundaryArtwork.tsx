export function BoundaryArtwork() {
  return (
    <figure
      aria-label="A public request crossing a private STRK20 boundary and emerging as verified receipt evidence"
      className="privacy-plane boundary-artwork"
      role="img"
    >
      <div className="plane-grid" aria-hidden="true" />
      <div className="plane-label label-left">PUBLIC EDGE</div>
      <div className="plane-label label-center">PRIVATE PATH</div>
      <div className="plane-label label-right">VERIFIED STATE</div>

      <svg aria-hidden="true" className="boundary-map" viewBox="0 0 1200 400">
        <defs>
          <linearGradient id="lacuna-flow" x1="0" x2="1">
            <stop offset="0" stopColor="#f4be72" />
            <stop offset="0.46" stopColor="#f4be72" stopOpacity="0.12" />
            <stop offset="0.54" stopColor="#b4f8c8" stopOpacity="0.12" />
            <stop offset="1" stopColor="#b4f8c8" />
          </linearGradient>
          <filter id="lacuna-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path className="boundary-ghost-path" d="M72 224 C260 224 326 146 488 190 S716 264 870 198 S1058 176 1128 176" />
        <path className="boundary-live-path" d="M72 224 C260 224 326 146 488 190 S716 264 870 198 S1058 176 1128 176" />
        <g className="boundary-node boundary-node-public" transform="translate(72 224)">
          <circle r="24" /><circle className="node-core" r="6" />
        </g>
        <g className="boundary-node boundary-node-private" transform="translate(600 216)" filter="url(#lacuna-glow)">
          <circle r="34" /><path d="M0 -12 L12 0 L0 12 L-12 0 Z" />
        </g>
        <g className="boundary-node boundary-node-verified" transform="translate(1128 176)">
          <circle r="24" /><path d="M-8 0 L-2 7 L10 -8" />
        </g>
        <circle className="flow-particle particle-one" r="5" />
        <circle className="flow-particle particle-two" r="3" />
      </svg>

      <div className="visual-card request-card" aria-hidden="true">
        <span>INTENT / 01</span><b>shielded transfer</b><i /><i /><i />
      </div>
      <div className="visual-card evidence-card" aria-hidden="true">
        <span>EVIDENCE / 03</span><b>receipt accepted</b><i /><i />
      </div>
      <div className="aperture" aria-hidden="true">
        <span className="aperture-left" />
        <span className="aperture-core" />
        <span className="aperture-right" />
      </div>
      <figcaption>Intent enters publicly, value moves privately, evidence exits verifiably</figcaption>
    </figure>
  )
}
