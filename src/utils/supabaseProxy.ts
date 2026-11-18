/**
 * Some mobile carriers and Wi-Fi networks reach the app (Netlify) but not
 * *.supabase.co, so the app opened and then hung. In production every HTTP call
 * to Supabase (auth, database, storage) goes through the app's own domain:
 * netlify.toml proxies /sb/* to the Supabase project. If a network reaches the
 * app, it reaches the data too.
 *
 * Realtime (websockets) cannot be proxied by Netlify and still connects
 * directly; it only powers live refreshes, never login or saving.
 */
export const SUPABASE_PROXY_PATH = '/sb'

export function toProxiedUrl(url: string, supabaseUrl: string, origin: string): string {
  const base = supabaseUrl.replace(/\/+$/, '')
  if (!url.startsWith(base + '/')) return url
  return origin + SUPABASE_PROXY_PATH + url.slice(base.length)
}

/** fetch for supabase-js that sends Supabase HTTP calls through the proxy. */
export function proxiedFetch(supabaseUrl: string, origin: string): typeof fetch {
  return (input, init) => {
    if (typeof input === 'string') return fetch(toProxiedUrl(input, supabaseUrl, origin), init)
    if (input instanceof URL) return fetch(toProxiedUrl(input.href, supabaseUrl, origin), init)
    const proxied = toProxiedUrl(input.url, supabaseUrl, origin)
    return fetch(proxied === input.url ? input : new Request(proxied, input), init)
  }
}
