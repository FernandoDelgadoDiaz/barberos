export function Tenants() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Gestión de Barberías</h1>
        <p className="text-gray-300 mt-2">Administrador del sistema</p>
      </div>

      <div className="bg-[#111] rounded-xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-[var(--secondary)]/20 rounded-lg">
            <svg className="w-6 h-6 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-medium text-white">Superadmin</h3>
            <p className="text-gray-400">Gestión de todas las barberías</p>
          </div>
        </div>

        <div className="border-2 border-dashed border-[#1c1c1c] rounded-lg p-12 text-center">
          <p className="text-gray-500">
            Panel de administración en desarrollo
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Panel de administración para gestionar múltiples barberías, usuarios y configuraciones globales
          </p>
        </div>
      </div>
    </div>
  )
}