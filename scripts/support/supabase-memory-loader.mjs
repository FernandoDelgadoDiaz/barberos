// Node module hook: resolve @supabase/supabase-js to the in-memory fake.
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return { url: ${JSON.stringify(new URL('./supabase-memory.mjs', import.meta.url).href)}, shortCircuit: true }
  return next(specifier, context)
}`))
