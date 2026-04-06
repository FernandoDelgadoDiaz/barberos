import { useState } from 'react'

const ScissorsIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <line x1="20" y1="4" x2="8.12" y2="15.88"/>
    <line x1="14.47" y1="14.48" x2="20" y2="20"/>
    <line x1="8.12" y1="8.12" x2="12" y2="12"/>
  </svg>
)

const PercentIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19"/>
    <circle cx="6.5" cy="6.5" r="2.5"/>
    <circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
)

const EyeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const BarChart3Icon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V10"/>
    <path d="M18 20V4"/>
    <path d="M6 20v-4"/>
  </svg>
)

const BrushIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.395 7.105a.999.999 0 0 1 1.414 0l1.086 1.086a1 1 0 0 1 0 1.414l-9.193 9.193a2 2 0 0 1-2.828 0l-1.414-1.414a2 2 0 0 1 0-2.828l9.193-9.193Z"/>
    <path d="m7 15 2 2"/>
    <path d="M17.5 9.5 21 6"/>
  </svg>
)

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const faqItems = [
    { q: '¿Necesito instalar algo?', a: 'No, BarberOS funciona en la nube. Solo necesitás un navegador web.' },
    { q: '¿Mis barberos pueden acceder?', a: 'Sí, cada barbero tiene su usuario y ve solo sus servicios y comisiones.' },
    { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, sin compromiso. Cancelás desde tu panel y no se renueva.' },
    { q: '¿Mis datos están seguros?', a: 'Totalmente. Usamos Supabase con RLS, backups automáticos y encriptación.' },
  ]

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setMenuOpen(false)
    }
  }

  return (
    <div className="bg-[#1a1a1a] text-white font-body">
      {/* Navegación */}
      <nav className="sticky top-0 z-50 bg-[#1a1a1a] border-b border-[#383838] py-4 px-6 lg:px-16">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent"></div>
            <span className="font-display font-bold text-2xl tracking-tighter text-white">
              BARBER<span className="text-accent">OS</span>
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {['Inicio', 'Servicios', 'Equipo', 'Precios'].map((item) => (
              <button
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className="text-[#E0E0E0] hover:text-accent transition-colors font-medium text-lg"
              >
                {item}
              </button>
            ))}
            <a
              href="/register"
              className="bg-accent text-[#1a1a1a] px-6 py-3 rounded-full font-semibold hover:bg-[#D4B87A] hover:scale-105 transition-all duration-200"
            >
              Registrar
            </a>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#242424] border-b border-[#383838] px-6 py-4">
            <div className="flex flex-col gap-4">
              {['Inicio', 'Servicios', 'Equipo', 'Precios'].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className="text-left text-[#E0E0E0] hover:text-accent py-2 text-lg"
                >
                  {item}
                </button>
              ))}
              <a
                href="/register"
                className="bg-accent text-[#1a1a1a] px-6 py-3 rounded-full font-semibold text-center"
              >
                Registrar
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-16 py-12 lg:py-24 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column */}
          <div>
            <h1 className="font-display font-bold text-5xl lg:text-6xl xl:text-7xl leading-tight tracking-tighter mb-6">
              Controlá cada corte, <span className="text-accent">cada peso</span>, cada barbero.
            </h1>
            <p className="text-xl lg:text-2xl text-[#E0E0E0] mb-8 leading-relaxed">
              Registrá servicios, calculá comisiones al instante, y hacé crecer tu negocio. Todo con tu logo, tus colores.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/register"
                className="bg-accent text-[#1a1a1a] px-8 py-4 rounded-full font-semibold hover:bg-[#D4B87A] hover:scale-105 transition-all duration-200 text-center text-lg"
              >
                REGISTRAR MI BARBERÍA GRATIS →
              </a>
              <button
                onClick={() => scrollToSection('demo')}
                className="border border-accent text-accent bg-transparent px-8 py-4 rounded-full font-semibold hover:bg-accent hover:text-[#1a1a1a] transition-all duration-200 text-lg"
              >
                Ver demo en vivo
              </button>
            </div>
          </div>

          {/* Right column - mockup */}
          <div className="bg-[#242424] border border-[#383838] rounded-2xl shadow-2xl p-6">
            {/* Mockup header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#28ca42]"></div>
              </div>
              <div className="text-sm text-[#A0A0A0]">PANEL BARBEROS</div>
            </div>

            <div className="flex">
              {/* Sidebar */}
              <div className="w-1/4 pr-4 border-r border-[#383838]">
                <div className="space-y-4">
                  {['Panel en vivo', 'Servicios', 'Equipo', 'Configuración'].map((item, idx) => (
                    <div
                      key={item}
                      className={`py-3 px-4 rounded-lg ${idx === 0 ? 'bg-[#383838] text-accent' : 'text-[#E0E0E0] hover:bg-[#2a2a2a]'}`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main content */}
              <div className="w-3/4 pl-6">
                <h3 className="font-display font-bold text-2xl mb-4">Total del día</h3>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-[#2a2a2a] border border-[#383838] rounded-xl p-4">
                    <div className="text-[#A0A0A0] text-sm">Total</div>
                    <div className="text-3xl font-bold">$0</div>
                  </div>
                  <div className="bg-[#2a2a2a] border border-[#383838] rounded-xl p-4">
                    <div className="text-[#A0A0A0] text-sm">Tu parte</div>
                    <div className="text-3xl font-bold">$0</div>
                  </div>
                </div>

                <h3 className="font-display font-bold text-2xl mb-4">TU EQUIPO</h3>
                <div className="space-y-3">
                  {['Fernando', 'Carlos'].map((name) => (
                    <div key={name} className="flex justify-between items-center bg-[#2a2a2a] border border-[#383838] rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-[#1a1a1a]">
                          {name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold">{name}</div>
                          <div className="text-sm text-[#A0A0A0]">Barbero</div>
                        </div>
                      </div>
                      <div className="text-accent font-bold">50%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* El problema */}
      <section id="servicios" className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-12">¿Esto te suena familiar?</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          {[
            '✗ Los barberos anotan los cortes en una libreta que después se pierde.',
            '✗ No sabés cuánto gana cada barbero por hora.',
            '✗ Liquidar comisiones es un quilombo cada quincena.',
            '✗ Tu marca desaparece detrás de apps genéricas.',
          ].map((text, idx) => (
            <div key={idx} className="border-l-4 border-accent pl-6 py-4">
              <p className="text-xl text-[#E0E0E0]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-16 py-20 bg-[#242424] border-y border-[#383838]">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-4">Todo lo que necesitás</h2>
          <p className="text-xl text-[#E0E0E0] text-center mb-12 max-w-3xl mx-auto">
            BarberOS reúne en una sola plataforma las herramientas que tu barbería ya debería tener.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
            {[
              { icon: <ScissorsIcon />, title: 'Registro de servicios en 3 clicks', desc: 'Cada corte registrado en segundos desde cualquier dispositivo.' },
              { icon: <PercentIcon />, title: 'Comisiones configurables', desc: 'Define porcentajes por barbero o por servicio. Se calculan automáticamente.' },
              { icon: <EyeIcon />, title: 'Panel en vivo', desc: 'Mirá qué está pasando en tu local en tiempo real, desde tu celular.' },
              { icon: <BarChart3Icon />, title: 'Métricas reales', desc: 'Ganancias por hora, servicios más pedidos, días pico. Datos que importan.' },
              { icon: <BrushIcon />, title: 'Blanco, a tu imagen', desc: 'Tu logo, tus colores. Parece un sistema hecho a medida para tu marca.' },
            ].map((feat, idx) => (
              <div key={idx} className="bg-[#1a1a1a] border border-[#383838] rounded-2xl p-6 flex flex-col items-center text-center">
                <div className="mb-4">{feat.icon}</div>
                <h3 className="font-display font-bold text-2xl mb-3">{feat.title}</h3>
                <p className="text-[#E0E0E0]">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo panel en vivo */}
      <section id="demo" className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="relative">
            <div className="w-4 h-4 bg-green-500 rounded-full animate-ping absolute"></div>
            <div className="w-4 h-4 bg-green-500 rounded-full relative"></div>
          </div>
          <span className="text-accent font-bold text-lg">EN VIVO</span>
        </div>
        <h2 className="font-display font-bold text-4xl lg:text-5xl mb-6">Panel en vivo: así de simple</h2>
        <p className="text-xl text-[#E0E0E0] mb-12 max-w-3xl">
          Cada servicio que registran tus barberos aparece acá al instante. Sin refrescar, sin esperar.
        </p>

        <div className="bg-[#242424] border-2 border-accent rounded-2xl shadow-2xl p-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#383838]">
                  <th className="text-left py-4 text-[#E0E0E0] font-semibold">Servicio</th>
                  <th className="text-left py-4 text-[#E0E0E0] font-semibold">Precio</th>
                  <th className="text-left py-4 text-[#E0E0E0] font-semibold">Barbero</th>
                  <th className="text-left py-4 text-[#E0E0E0] font-semibold">Hace</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { service: 'Corte caballero', price: '$18.000', barber: 'Fernando', time: '5 min' },
                  { service: 'Barba', price: '$800', barber: 'Carlos', time: '12 min' },
                  { service: 'Corte + barba', price: '$22.000', barber: 'Fernando', time: '18 min' },
                  { service: 'Corte niño', price: '$15.000', barber: 'Lucía', time: '25 min' },
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-[#383838] last:border-0">
                    <td className="py-4 text-lg">{row.service}</td>
                    <td className="py-4 text-lg font-bold text-accent">{row.price}</td>
                    <td className="py-4 text-lg">{row.barber}</td>
                    <td className="py-4 text-lg text-[#A0A0A0]">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-12">Registrá tu barbería en 3 pasos</h2>
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { num: '01', title: 'Registrate gratis', desc: 'Creá tu cuenta en menos de 2 minutos. No necesitás tarjeta.' },
            { num: '02', title: 'Personalizá', desc: 'Subí tu logo, elegí colores, configura comisiones y agrega a tus barberos.' },
            { num: '03', title: 'Empezá a usar', desc: 'Tu equipo ya puede registrar servicios. Vos ves todo en tiempo real.' },
          ].map((step, idx) => (
            <div key={idx} className="text-center">
              <div className="font-display font-black text-6xl lg:text-7xl text-accent mb-4">{step.num}</div>
              <h3 className="font-display font-bold text-3xl mb-4">{step.title}</h3>
              <p className="text-xl text-[#E0E0E0]">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tu equipo */}
      <section id="equipo" className="px-6 lg:px-16 py-20 bg-[#242424] border-y border-[#383838]">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-4">Tu equipo, siempre alineado</h2>
          <p className="text-xl text-[#E0E0E0] text-center mb-12 max-w-3xl mx-auto">
            Cada barbero tiene su propio acceso, registra servicios y ve su comisión en tiempo real.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {[
              { name: 'Fernando', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop' },
              { name: 'Carlos', img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop' },
              { name: 'Lucía', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop' },
              { name: 'Matías', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop' },
            ].map((person) => (
              <div key={person.name} className="text-center">
                <div className="w-40 h-40 mx-auto rounded-full border-4 border-accent overflow-hidden mb-4">
                  <img src={person.img} alt={person.name} className="w-full h-full object-cover" />
                </div>
                <h4 className="font-display font-bold text-2xl">{person.name}</h4>
                <p className="text-[#A0A0A0]">Barbero</p>
              </div>
            ))}
          </div>

          <div className="bg-[#1a1a1a] border border-[#383838] rounded-2xl p-8 max-w-3xl mx-auto">
            <p className="text-2xl text-[#E0E0E0] text-center italic">
              "Antes perdía 2 horas cada quincena liquidando comisiones. Ahora es automático."
            </p>
            <div className="flex items-center justify-center gap-4 mt-6">
              <img
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop"
                alt="Dueño"
                className="w-16 h-16 rounded-full border-2 border-accent"
              />
              <div>
                <div className="font-bold text-xl">Martín López</div>
                <div className="text-[#A0A0A0]">Barbería Classic, Buenos Aires</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="px-6 lg:px-16 py-20 max-w-4xl mx-auto">
        <div className="text-center">
          <div className="inline-block bg-accent text-[#1a1a1a] px-4 py-2 rounded-full font-bold mb-6">
            Gratis 14 días
          </div>
          <h2 className="font-display font-bold text-4xl lg:text-5xl mb-6">Desde USD 15/mes o ARS 25.000/mes</h2>
          <p className="text-xl text-[#E0E0E0] mb-8 max-w-2xl mx-auto">
            Precio por barbería, sin límite de barberos. Cancelás cuando quieras.
          </p>
          <a
            href="/register"
            className="inline-block bg-accent text-[#1a1a1a] px-10 py-4 rounded-full font-bold hover:bg-[#D4B87A] hover:scale-105 transition-all duration-200 text-xl"
          >
            Comenzar prueba gratis
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-16 py-20 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-12">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {faqItems.map((item, idx) => (
            <div key={idx} className="bg-[#242424] border border-[#383838] rounded-2xl overflow-hidden">
              <button
                className="w-full flex justify-between items-center p-6 text-left"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span className="font-display font-bold text-xl">{item.q}</span>
                <ChevronDownIcon className={`transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-6">
                  <p className="text-[#E0E0E0] text-lg">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#242424] border-t border-[#383838] pt-12 pb-8 px-6 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-accent"></div>
                <span className="font-display font-bold text-2xl">BARBEROS</span>
              </div>
              <p className="text-[#A0A0A0]">Sistema de gestión profesional para barberías.</p>
            </div>
            <div>
              <h4 className="font-display font-bold text-xl mb-4">Producto</h4>
              <ul className="space-y-2 text-[#E0E0E0]">
                <li><button onClick={() => scrollToSection('servicios')} className="hover:text-accent">Servicios</button></li>
                <li><button onClick={() => scrollToSection('equipo')} className="hover:text-accent">Equipo</button></li>
                <li><button onClick={() => scrollToSection('precios')} className="hover:text-accent">Precios</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-bold text-xl mb-4">Recursos</h4>
              <ul className="space-y-2 text-[#E0E0E0]">
                <li><a href="/login" className="hover:text-accent">Login demo</a></li>
                <li><a href="/register" className="hover:text-accent">Registro</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-bold text-xl mb-4">Legal</h4>
              <ul className="space-y-2 text-[#E0E0E0]">
                <li>Términos</li>
                <li>Privacidad</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#383838] pt-8 text-center">
            <h3 className="font-display font-bold text-3xl mb-6">Crea tu propia barbería digital en 3 pasos</h3>
            <a
              href="/register"
              className="inline-block bg-accent text-[#1a1a1a] px-10 py-4 rounded-full font-bold hover:bg-[#D4B87A] hover:scale-105 transition-all duration-200 text-xl mb-8"
            >
              Empezar gratis
            </a>
            <p className="text-[#A0A0A0]">© 2026 BarberOS - Hecho en Río Gallegos, Santa Cruz, Argentina</p>
          </div>
        </div>
      </footer>
    </div>
  )
}