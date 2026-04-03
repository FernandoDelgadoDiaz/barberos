export function Summary() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Resumen del Día</h1>
        <p className="text-gray-300 mt-2">Consulta tus métricas diarias</p>
      </div>

      <div className="bg-[#111] rounded-xl p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="p-4 bg-[var(--secondary)]/20 rounded-full inline-flex mb-6">
            <svg className="w-12 h-12 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-white mb-4">
            Disponible al cierre del día
          </h3>
          <p className="text-gray-400">
            El resumen detallado de servicios, comisiones y ganancias se generará automáticamente al final de cada jornada.
          </p>
          <div className="mt-6 p-4 bg-[#1a1a1a] rounded-lg">
            <p className="text-sm text-gray-400">
              Próximamente
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}