import { LacunaMark } from './LacunaMark'

type SiteHeaderProps = {
  route: 'home' | 'studio' | 'not-found'
}

export function SiteHeader({ route }: SiteHeaderProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="nav wrap">
          <a
            aria-current={route === 'home' ? 'page' : undefined}
            className="brand"
            href="/"
            aria-label="Lacuna home"
          >
            <LacunaMark className="brand-mark" />
            <span>LACUNA</span>
          </a>
          <nav aria-label="Primary navigation">
            <a className="nav-flow" href="/#flow">Flow</a>
            <a className="nav-status" href="/#status">Status</a>
            <a className="nav-source" href="https://github.com/dexarxbt/Lacuna">Source</a>
          </nav>
          <a
            aria-current={route === 'studio' ? 'page' : undefined}
            className="nav-action"
            href="/studio"
          >
            {route === 'studio' ? 'Studio' : 'Launch studio'} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
    </>
  )
}
