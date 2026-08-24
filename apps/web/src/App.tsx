import { lazy, Suspense } from 'react'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { LandingPage } from './pages/LandingPage'
import { resolveRoute } from './routing'

const StudioPage = lazy(() =>
  import('./pages/StudioPage').then((module) => ({ default: module.StudioPage })),
)

export function App() {
  const route = resolveRoute(window.location.pathname)

  return (
    <div className="site-shell">
      <SiteHeader route={route} />
      {route === 'home' && <LandingPage />}
      {route === 'studio' && (
        <Suspense fallback={<main className="route-loading wrap" id="main-content" aria-busy="true">Loading studio</main>}>
          <StudioPage />
        </Suspense>
      )}
      {route === 'not-found' && (
        <main className="not-found wrap" id="main-content">
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
