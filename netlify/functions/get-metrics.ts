import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface MetricsResponse {
  dia_mas_cortes: { fecha: string; total: number } | null
  hora_pico: { hora: number; total: number } | null
  mes_top: { mes: string; total: number } | null
  barbero_estrella: { nombre: string; servicios: number; generado: number } | null
  servicio_popular: { nombre: string; total: number } | null
  ticket_promedio: number | null
  historico: { total_servicios: number; total_facturado: number; total_owner: number }
  semana_actual: { servicios: number; facturado: number }
  semana_anterior: { servicios: number; facturado: number }
}

interface NetlifyFunctionEvent {
  httpMethod: string
  queryStringParameters: {
    tenant_id?: string
    from?: string
    to?: string
  }
}

function getWeekRange(date: Date): { start: string; end: string } {
  const day = date.getDay() // 0 = Sunday, 1 = Monday, ...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday start
  const monday = new Date(date)
  monday.setDate(diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  monday.setHours(0, 0, 0, 0)
  sunday.setHours(23, 59, 59, 999)

  return {
    start: monday.toISOString(),
    end: sunday.toISOString()
  }
}

function getPreviousWeekRange(date: Date): { start: string; end: string } {
  const previousWeek = new Date(date)
  previousWeek.setDate(date.getDate() - 7)
  return getWeekRange(previousWeek)
}

function addDateFilters(query: any, from?: string, to?: string) {
  let q = query
  if (from) {
    q = q.gte('started_at', from)
  }
  if (to) {
    q = q.lte('started_at', to)
  }
  return q
}

export const handler = async (event: NetlifyFunctionEvent) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  // Only GET allowed
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const { tenant_id, from, to } = event.queryStringParameters || {}

    if (!tenant_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing tenant_id parameter' }),
      }
    }

    // Validate tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .single()

    if (tenantError || !tenant) {
      console.error('Tenant error:', tenantError)
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' }),
      }
    }

    // Helper to execute queries
    const executeQuery = async <T>(query: any): Promise<T | null> => {
      const { data, error } = await query
      if (error) {
        console.error('Query error:', error)
        return null
      }
      return data as T
    }

    // Base query for all metrics
    const baseQuery = supabase
      .from('service_logs')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('status', 'completed')

    const baseQueryWithFilters = addDateFilters(baseQuery, from, to)

    // Fetch all service logs once (with limit for safety)
    const { data: allLogs, error: logsError } = await baseQueryWithFilters.limit(5000)
    if (logsError) {
      console.error('Failed to fetch service logs:', logsError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch service logs' }),
      }
    }

    if (!allLogs || allLogs.length === 0) {
      // No data, return empty response
      const emptyResponse: MetricsResponse = {
        dia_mas_cortes: null,
        hora_pico: null,
        mes_top: null,
        barbero_estrella: null,
        servicio_popular: null,
        ticket_promedio: null,
        historico: { total_servicios: 0, total_facturado: 0, total_owner: 0 },
        semana_actual: { servicios: 0, facturado: 0 },
        semana_anterior: { servicios: 0, facturado: 0 }
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(emptyResponse),
      }
    }

    // a. Día con más cortes
    let diaMasCortes: { fecha: string; total: number } | null = null
    const countsByDay: Record<string, number> = {}
    allLogs.forEach(log => {
      const date = log.started_at.split('T')[0] // YYYY-MM-DD
      countsByDay[date] = (countsByDay[date] || 0) + 1
    })
    let maxDate = ''
    let maxDayCount = 0
    Object.entries(countsByDay).forEach(([date, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count
        maxDate = date
      }
    })
    if (maxDate) {
      diaMasCortes = { fecha: maxDate, total: maxDayCount }
    }

    // b. Hora pico
    let horaPico: { hora: number; total: number } | null = null
    const countsByHour: Record<number, number> = {}
    allLogs.forEach(log => {
      const hour = new Date(log.started_at).getHours()
      countsByHour[hour] = (countsByHour[hour] || 0) + 1
    })
    let maxHour = 0
    let maxHourCount = 0
    Object.entries(countsByHour).forEach(([hourStr, count]) => {
      const hour = parseInt(hourStr)
      if (count > maxHourCount) {
        maxHourCount = count
        maxHour = hour
      }
    })
    if (maxHourCount > 0) {
      horaPico = { hora: maxHour, total: maxHourCount }
    }

    // c. Mes top (más facturación)
    let mesTop: { mes: string; total: number } | null = null
    const revenueByMonth: Record<string, number> = {}
    allLogs.forEach(log => {
      const date = new Date(log.started_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + log.price_charged
    })
    let maxMonth = ''
    let maxRevenue = 0
    Object.entries(revenueByMonth).forEach(([month, revenue]) => {
      if (revenue > maxRevenue) {
        maxRevenue = revenue
        maxMonth = month
      }
    })
    if (maxMonth) {
      mesTop = { mes: maxMonth, total: maxRevenue }
    }

    // d. Barbero estrella (más servicios) - need barber names
    let barberoEstrella: { nombre: string; servicios: number; generado: number } | null = null
    const servicesByBarber: Record<string, { count: number; revenue: number }> = {}
    allLogs.forEach(log => {
      const current = servicesByBarber[log.barber_id] || { count: 0, revenue: 0 }
      current.count += 1
      current.revenue += log.price_charged
      servicesByBarber[log.barber_id] = current
    })

    // Fetch barber names for top barber
    let maxBarberId = ''
    let maxServices = 0
    let maxBarberRevenue = 0
    Object.entries(servicesByBarber).forEach(([barberId, stats]) => {
      if (stats.count > maxServices) {
        maxServices = stats.count
        maxBarberRevenue = stats.revenue
        maxBarberId = barberId
      }
    })

    if (maxBarberId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', maxBarberId)
        .eq('tenant_id', tenant_id)
        .single()
      const nombre = profile?.display_name || 'Barbero'
      barberoEstrella = { nombre, servicios: maxServices, generado: maxBarberRevenue }
    }

    // e. Servicio más popular - need service names
    let servicioPopular: { nombre: string; total: number } | null = null
    const countsByService: Record<string, number> = {}
    allLogs.forEach(log => {
      countsByService[log.service_id] = (countsByService[log.service_id] || 0) + 1
    })

    let maxServiceId = ''
    let maxServiceCount = 0
    Object.entries(countsByService).forEach(([serviceId, count]) => {
      if (count > maxServiceCount) {
        maxServiceCount = count
        maxServiceId = serviceId
      }
    })

    if (maxServiceId) {
      const { data: service } = await supabase
        .from('services_catalog')
        .select('name')
        .eq('id', maxServiceId)
        .eq('tenant_id', tenant_id)
        .single()
      const nombre = service?.name || 'Servicio'
      servicioPopular = { nombre, total: maxServiceCount }
    }

    // f. Ticket promedio
    let ticketPromedio: number | null = null
    const totalRevenue = allLogs.reduce((acc, log) => acc + log.price_charged, 0)
    ticketPromedio = totalRevenue / allLogs.length

    // g. Total histórico (from all logs)
    const totalOwnerEarnings = allLogs.reduce((acc, log) => acc + log.owner_earning, 0)
    const historico = {
      total_servicios: allLogs.length,
      total_facturado: totalRevenue,
      total_owner: totalOwnerEarnings
    }

    // h. Comparación semana actual vs anterior
    const now = new Date()
    const currentWeek = getWeekRange(now)
    const previousWeek = getPreviousWeekRange(now)

    const currentWeekLogs = allLogs.filter(log => {
      const logDate = new Date(log.started_at)
      return logDate >= new Date(currentWeek.start) && logDate <= new Date(currentWeek.end)
    })

    const previousWeekLogs = allLogs.filter(log => {
      const logDate = new Date(log.started_at)
      return logDate >= new Date(previousWeek.start) && logDate <= new Date(previousWeek.end)
    })

    const semana_actual = {
      servicios: currentWeekLogs.length,
      facturado: currentWeekLogs.reduce((acc, log) => acc + log.price_charged, 0)
    }

    const semana_anterior = {
      servicios: previousWeekLogs.length,
      facturado: previousWeekLogs.reduce((acc, log) => acc + log.price_charged, 0)
    }

    // Build response
    const response: MetricsResponse = {
      dia_mas_cortes: diaMasCortes,
      hora_pico: horaPico,
      mes_top: mesTop,
      barbero_estrella: barberoEstrella,
      servicio_popular: servicioPopular,
      ticket_promedio: ticketPromedio,
      historico,
      semana_actual,
      semana_anterior
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    }
  } catch (error: unknown) {
    console.error('Unhandled error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: errorMessage }),
    }
  }
}