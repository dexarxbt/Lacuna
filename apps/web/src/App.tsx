import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { LandingPage } from './pages/LandingPage'
import { StudioPage } from './pages/StudioPage'
import { resolveRoute } from './routing'

export function App() {
  const route = resolveRoute(window.location.pathname)

  return (
    <div className="site-shell">
      <SiteHeader route={route} />
      {route === 'home' && <LandingPage />}
      {route === 'studio' && <StudioPage />}
      {route === 'not-found' && (
        <main className="not-found wrap" id="top">
          <p className="kicker">404 / OUTSIDE THE GRAPH</p>
          <h1>This path has no privacy recipe</h1>
          <p>Return to the product or open the Studio to inspect a supported flow.</p>
          <div className="hero-actions">
            <a className="button primary" href="/">Back home</a>
            <a className="button secondary" href="/studio">Open studio</a>
          </div>
        </main>
      )}
      <SiteFooter />
    </div>
  )
}
