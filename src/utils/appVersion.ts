/**
 * Detects that a newer deploy is live. Each Vite build references a different
 * hashed entry bundle (/assets/index-<hash>.js) from index.html, so comparing the
 * bundle the page is running with the one the server now serves is enough — no
 * build step or version file needed.
 */
const ENTRY_RE = /<script[^>]*\btype="module"[^>]*\bsrc="([^"]*\/assets\/index-[^"]+\.js)"/i

export function extractEntryBundle(html: string): string | null {
  const match = ENTRY_RE.exec(html)
  return match ? new URL(match[1], 'https://x.invalid').pathname : null
}

export function runningEntryBundle(doc: Document = document): string | null {
  const script = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
  return script ? new URL(script.src, 'https://x.invalid').pathname : null
}

export async function fetchLatestEntryBundle(): Promise<string | null> {
  const response = await fetch(`/?v=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'text/html' } })
  if (!response.ok) return null
  return extractEntryBundle(await response.text())
}
