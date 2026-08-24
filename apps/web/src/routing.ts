export type AppRoute = 'home' | 'studio' | 'not-found'

export function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return normalized || '/'
}

export function resolveRoute(pathname: string): AppRoute {
  const normalized = normalizePathname(pathname)
  if (normalized === '/') return 'home'
  if (normalized === '/studio') return 'studio'
  return 'not-found'
}
