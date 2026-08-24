import { LacunaMark } from './LacunaMark'

type SiteHeaderProps = {
  route: 'home' | 'studio' | 'not-found'
}

export function SiteHeader({ route }: SiteHeaderProps) {
  return (
    <header className="nav wrap">
      <a className="brand" href="/" aria-label="Lacuna home">
        <LacunaMark className="brand-mark" />
        <span>LACUNA</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/#product">Product</a>
        <a href="/studio#boundary">Privacy model</a>
        <a href="https://github.com/dexarxbt/Lacuna">Source</a>
      </nav>
      <a className="nav-action" href={route === 'studio' ? '/' : '/studio'}>
        {route === 'studio' ? 'Back home' : 'Open studio'} <span>↗</span>
      </a>
    </header>
  )
}
