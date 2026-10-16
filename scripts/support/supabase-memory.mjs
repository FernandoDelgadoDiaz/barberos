// In-memory stand-in for @supabase/supabase-js used by the log-service tests.
// Supports only the query-builder surface log-service touches.
import { randomUUID } from 'node:crypto'

export const db = { tables: {}, users: {}, failInsertOn: null }

export function resetDb(seed) {
  db.tables = structuredClone(seed.tables)
  db.users = { ...seed.users }
  db.failInsertOn = null
}

class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'select'; this.opts = {}; this.returning = false }
  select(_cols, opts = {}) { if (this.mode !== 'insert' && this.mode !== 'delete') this.mode = 'select'; else this.returning = true; this.opts = opts; return this }
  insert(rows) { this.mode = 'insert'; this.rows = Array.isArray(rows) ? rows : [rows]; this.many = Array.isArray(rows); return this }
  delete() { this.mode = 'delete'; return this }
  eq(c, v) { this.filters.push(r => r[c] === v); return this }
  in(c, vs) { this.filters.push(r => vs.includes(r[c])); return this }
  gt(c, v) { this.filters.push(r => Number(r[c]) > v); return this }
  gte(c, v) { this.filters.push(r => r[c] >= v); return this }
  lte(c, v) { this.filters.push(r => r[c] <= v); return this }
  single() { this.single_ = true; return this }
  maybeSingle() { this.maybe = true; return this }
  rowsOf() { return (db.tables[this.table] ||= []) }
  run() {
    if (this.mode === 'insert') {
      if (db.failInsertOn === this.table) return { data: null, error: { message: `forced failure on ${this.table}` } }
      const inserted = this.rows.map(r => ({ id: randomUUID(), ...structuredClone(r) }))
      this.rowsOf().push(...inserted)
      return { data: this.single_ ? inserted[0] : inserted, error: null }
    }
    const matched = this.rowsOf().filter(r => this.filters.every(f => f(r)))
    if (this.mode === 'delete') {
      db.tables[this.table] = this.rowsOf().filter(r => !matched.includes(r))
      return { data: null, error: null }
    }
    if (this.opts.head) return { data: null, count: matched.length, error: null }
    if (this.single_) return matched.length === 1 ? { data: matched[0], error: null } : { data: null, error: { message: 'not single' } }
    if (this.maybe) return { data: matched[0] ?? null, error: null }
    return { data: matched, count: matched.length, error: null }
  }
  then(resolve, reject) { try { resolve(this.run()) } catch (e) { reject(e) } }
}

export function createClient() {
  return {
    from: table => new Query(table),
    auth: { getUser: async token => db.users[token] ? { data: { user: db.users[token] }, error: null } : { data: { user: null }, error: { message: 'bad token' } } },
  }
}
