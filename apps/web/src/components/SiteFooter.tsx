import { LacunaMark } from './LacunaMark'

export function SiteFooter() {
  return (
    <footer className="wrap footer">
      <a className="brand" href="/" aria-label="Lacuna home">
        <LacunaMark className="brand-mark" /><span>LACUNA</span>
      </a>
      <p>Build private flows. Know what leaks.</p>
      <a href="https://github.com/dexarxbt/Lacuna">MIT licensed · Source</a>
    </footer>
  )
}
