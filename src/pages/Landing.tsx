import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import type { Variants } from 'framer-motion';


// Particle component
const FloatingParticle = () => {
  const x = Math.random() * 100;
  const y = Math.random() * 100;
  const duration = 4 + Math.random() * 4;
  const delay = Math.random() * 2;

  return (
    <motion.div
      className="absolute w-0.5 h-0.5 bg-[#C8A97E] rounded-full opacity-30"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{
        y: [0, -20, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
    />
  );
};

const Landing = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [countUpValues, setCountUpValues] = useState({ total: 0, comission: 0 });

  // Custom cursor effect (desktop only)
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (!isDesktop) return;

    setCursorVisible(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // CountUp animation for demo panel
  const demoRef = useRef<HTMLDivElement>(null);
  const demoInView = useInView(demoRef, { once: true });

  useEffect(() => {
    if (demoInView) {
      const interval = setInterval(() => {
        setCountUpValues((prev) => ({
          total: prev.total < 18500 ? prev.total + 500 : 18500,
          comission: prev.comission < 9250 ? prev.comission + 250 : 9250,
        }));
      }, 30);
      return () => clearInterval(interval);
    }
  }, [demoInView]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMenuOpen(false);
    }
  };

  const heroVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  };

  const faqItems = [
    { q: '¿Necesito instalar algo?', a: 'No, BarberOS funciona en la nube. Solo necesitás un navegador web.' },
    { q: '¿Mis barberos pueden acceder?', a: 'Sí, cada barbero tiene su usuario y ve solo sus servicios y comisiones.' },
    { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, sin compromiso. Cancelás desde tu panel y no se renueva.' },
    { q: '¿Mis datos están seguros?', a: 'Totalmente. Usamos Supabase con RLS, backups automáticos y encriptación.' },
  ];

  // Floating particles array
  const particles = Array.from({ length: 20 }, (_, i) => <FloatingParticle key={i} />);

  return (
    <div className="bg-[#1a1a1a] text-white font-body overflow-hidden relative">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Radial gradient that follows cursor */}
      {cursorVisible && (
        <div
          className="fixed pointer-events-none rounded-full -translate-x-1/2 -translate-y-1/2 z-0"
          style={{
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(200,169,126,0.06) 0%, transparent 70%)',
            left: mousePosition.x,
            top: mousePosition.y,
            willChange: 'transform',
          }}
        />
      )}

      {/* Custom cursor (desktop only) */}
      {cursorVisible && (
        <div
          className="fixed w-5 h-5 rounded-full border border-[#C8A97E] pointer-events-none z-50 mix-blend-difference"
          style={{
            left: mousePosition.x - 10,
            top: mousePosition.y - 10,
            transition: 'transform 0.1s ease-out, background 0.2s',
            willChange: 'transform',
          }}
        />
      )}

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none z-0">{particles}</div>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-[rgba(26,26,26,0.7)] backdrop-blur-xl border-b border-[rgba(200,169,126,0.2)] py-4 px-6 lg:px-16">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#C8A97E]"></div>
            <span
              className="font-display font-bold text-2xl tracking-tighter bg-gradient-to-r from-[#C8A97E] via-[#F0D5A0] to-[#C8A97E] bg-clip-text text-transparent"
              style={{ backgroundSize: '200% auto' }}
            >
              BARBEROS
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {['Inicio', 'Servicios', 'Equipo', 'Precios'].map((item) => (
              <button
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className="relative text-[#E0E0E0] hover:text-[#C8A97E] font-medium text-lg transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-[#C8A97E] after:w-0 hover:after:w-full after:transition-all after:duration-300"
              >
                {item}
              </button>
            ))}
            <a
              href="/register"
              className="border border-[#C8A97E] text-[#C8A97E] bg-transparent px-6 py-3 rounded-full font-semibold hover:shadow-[0_0_20px_rgba(200,169,126,0.4)] hover:bg-[#C8A97E] hover:text-[#1a1a1a] transition-all duration-300"
            >
              Registrar
            </a>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden bg-[rgba(36,36,36,0.9)] backdrop-blur-lg border-b border-[#383838] px-6 overflow-hidden"
            >
              <div className="flex flex-col gap-4 py-4">
                {['Inicio', 'Servicios', 'Equipo', 'Precios'].map((item) => (
                  <button
                    key={item}
                    onClick={() => scrollToSection(item.toLowerCase())}
                    className="text-left text-[#E0E0E0] hover:text-[#C8A97E] py-2 text-lg transition-colors"
                  >
                    {item}
                  </button>
                ))}
                <a
                  href="/register"
                  className="border border-[#C8A97E] text-[#C8A97E] bg-transparent px-6 py-3 rounded-full font-semibold text-center hover:bg-[#C8A97E] hover:text-[#1a1a1a] transition-colors"
                >
                  Registrar
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-16 py-12 lg:py-24 max-w-7xl mx-auto relative">
        {/* Background gradients */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `
              radial-gradient(600px circle at 20% 50%, rgba(200,169,126,0.08), transparent),
              radial-gradient(400px circle at 80% 50%, rgba(200,169,126,0.04), transparent),
              radial-gradient(800px circle at bottom, rgba(200,169,126,0.03), transparent)
            `,
          }}
        />

        <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left column */}
          <div>
            <motion.h1
              className="font-display font-bold text-5xl lg:text-6xl xl:text-7xl leading-tight tracking-tighter mb-6"
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.1 }}
            >
              {['Controlá cada', 'corte,', 'cada peso,', 'cada barbero.'].map((word, idx) => (
                <motion.span
                  key={word}
                  variants={heroVariants}
                  transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className={`inline-block mr-2 ${idx === 1 || idx === 3 ? 'bg-gradient-to-r from-[#C8A97E] to-[#F0D5A0] bg-clip-text text-transparent' : 'text-white'}`}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              className="text-xl lg:text-2xl text-[#E0E0E0] mb-8 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              Registrá servicios, calculá comisiones al instante, y hacé crecer tu negocio. Todo con tu logo, tus colores.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.8 }}
            >
              <a
                href="/register"
                className="relative bg-[#C8A97E] text-[#1a1a1a] px-8 py-4 rounded-full font-semibold hover:shadow-[0_0_30px_rgba(200,169,126,0.5)] transition-all duration-300 text-center text-lg overflow-hidden group"
              >
                <span className="relative z-10">REGISTRAR MI BARBERÍA GRATIS →</span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white to-transparent group-hover:translate-x-full transition-transform duration-700" />
              </a>
              <button
                onClick={() => scrollToSection('demo')}
                className="border border-[#C8A97E] text-[#C8A97E] bg-transparent px-8 py-4 rounded-full font-semibold hover:bg-[#C8A97E] hover:text-[#1a1a1a] transition-all duration-300 text-lg"
              >
                Ver demo en vivo
              </button>
            </motion.div>
          </div>

          {/* Right column - mockup */}
          <motion.div
            className="relative bg-[rgba(36,36,36,0.6)] backdrop-blur-lg border border-[rgba(200,169,126,0.3)] rounded-2xl p-6 shadow-2xl"
            initial={{ rotateY: -5, rotateX: 2, opacity: 0 }}
            animate={{ rotateY: 0, rotateX: 0, opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            whileHover={{ rotateY: 0, rotateX: 0, scale: 1.02 }}
            style={{
              transformStyle: 'preserve-3d',
              perspective: '1000px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(200,169,126,0.1)',
            }}
          >
            {/* Mockup header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#28ca42]"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping absolute"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full relative"></div>
                </div>
                <span className="text-sm text-[#A0A0A0]">PANEL BARBEROS - EN VIVO</span>
              </div>
            </div>

            <div className="flex">
              {/* Sidebar */}
              <div className="w-1/4 pr-4 border-r border-[rgba(200,169,126,0.2)]">
                <div className="space-y-4">
                  {['Panel en vivo', 'Servicios', 'Equipo', 'Configuración'].map((item, idx) => (
                    <div
                      key={item}
                      className={`py-3 px-4 rounded-lg transition-all ${idx === 0 ? 'bg-[rgba(200,169,126,0.1)] text-[#C8A97E]' : 'text-[#E0E0E0] hover:bg-[rgba(200,169,126,0.05)]'}`}
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
                  <div className="bg-[rgba(42,42,42,0.8)] border border-[rgba(200,169,126,0.2)] rounded-xl p-4">
                    <div className="text-[#A0A0A0] text-sm">Total</div>
                    <div className="text-3xl font-bold text-[#C8A97E]">${countUpValues.total.toLocaleString()}</div>
                  </div>
                  <div className="bg-[rgba(42,42,42,0.8)] border border-[rgba(200,169,126,0.2)] rounded-xl p-4">
                    <div className="text-[#A0A0A0] text-sm">Tu parte</div>
                    <div className="text-3xl font-bold text-[#C8A97E]">${countUpValues.comission.toLocaleString()}</div>
                  </div>
                </div>

                <h3 className="font-display font-bold text-2xl mb-4">TU EQUIPO</h3>
                <div className="space-y-3">
                  {['Fernando', 'Carlos'].map((name) => (
                    <div key={name} className="flex justify-between items-center bg-[rgba(42,42,42,0.8)] border border-[rgba(200,169,126,0.2)] rounded-lg p-4 hover:border-[#C8A97E] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#C8A97E] to-[#F0D5A0] flex items-center justify-center font-bold text-[#1a1a1a]">
                          {name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold">{name}</div>
                          <div className="text-sm text-[#A0A0A0]">Barbero</div>
                        </div>
                      </div>
                      <div className="text-[#C8A97E] font-bold">50%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* El problema */}
      <section id="servicios" className="px-6 lg:px-16 py-20 max-w-6xl mx-auto relative">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, #383838, #383838 1px, transparent 1px, transparent 20px),
                             repeating-linear-gradient(90deg, #383838, #383838 1px, transparent 1px, transparent 20px)`,
            backgroundSize: '20px 20px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 60, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          viewport={{ once: true, amount: 0.3 }}
          className="relative"
        >
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-12">¿Esto te suena familiar?</h2>
          <div className="grid sm:grid-cols-2 gap-8">
            {[
              '✗ Los barberos anotan los cortes en una libreta que después se pierde.',
              '✗ No sabés cuánto gana cada barbero por hora.',
              '✗ Liquidar comisiones es un quilombo cada quincena.',
              '✗ Tu marca desaparece detrás de apps genéricas.',
            ].map((text, idx) => (
              <motion.div
                key={idx}
                className="border-l-4 border-[#C8A97E] pl-6 py-4 bg-[rgba(26,26,26,0.5)] hover:bg-[rgba(200,169,126,0.05)] hover:border-[#F0D5A0] transition-all group cursor-pointer"
                whileHover={{ x: 8 }}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <p className="text-xl text-[#E0E0E0] group-hover:text-white">{text}</p>
                <div className="mt-2 text-[#C8A97E] opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform rotate-0 group-hover:rotate-90 transition-transform">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-16 py-20 bg-[#242424] border-y border-[#383838]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 60, filter: 'blur(10px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-4">Todo lo que necesitás</h2>
            <p className="text-xl text-[#E0E0E0] text-center mb-12 max-w-3xl mx-auto">
              BarberOS reúne en una sola plataforma las herramientas que tu barbería ya debería tener.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
              {[
                { icon: '✂️', title: 'Registro de servicios en 3 clicks', desc: 'Cada corte registrado en segundos desde cualquier dispositivo.' },
                { icon: '📊', title: 'Comisiones configurables', desc: 'Define porcentajes por barbero o por servicio. Se calculan automáticamente.' },
                { icon: '👁️', title: 'Panel en vivo', desc: 'Mirá qué está pasando en tu local en tiempo real, desde tu celular.' },
                { icon: '📈', title: 'Métricas reales', desc: 'Ganancias por hora, servicios más pedidos, días pico. Datos que importan.' },
                { icon: '🎨', title: 'Blanco, a tu imagen', desc: 'Tu logo, tus colores. Parece un sistema hecho a medida para tu marca.' },
              ].map((feat, idx) => (
                <motion.div
                  key={idx}
                  className="bg-[#1a1a1a] border border-[#383838] rounded-2xl p-6 flex flex-col items-center text-center hover:border-[#C8A97E] hover:shadow-[inset_0_0_30px_rgba(200,169,126,0.05)] hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="w-16 h-16 rounded-full bg-[rgba(200,169,126,0.1)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">{feat.icon}</span>
                  </div>
                  <h3 className="font-display font-bold text-2xl mb-3">{feat.title}</h3>
                  <p className="text-[#E0E0E0]">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Demo panel en vivo */}
      <section id="demo" className="px-6 lg:px-16 py-20 max-w-6xl mx-auto" ref={demoRef}>
        <motion.div
          initial={{ opacity: 0, y: 60, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          viewport={{ once: true, amount: 0.3 }}
          className="bg-gradient-to-br from-[#242424] to-[#1e1c19] border border-[rgba(200,169,126,0.4)] rounded-2xl p-8 shadow-[0_0_40px_rgba(200,169,126,0.08)]"
        >
          <div className="flex items-center gap-3 mb-8">
            <motion.div
              className="relative"
              animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="w-4 h-4 bg-green-500 rounded-full animate-ping absolute"></div>
              <div className="w-4 h-4 bg-green-500 rounded-full relative"></div>
            </motion.div>
            <span className="text-[#C8A97E] font-bold text-lg">EN VIVO</span>
          </div>
          <h2 className="font-display font-bold text-4xl lg:text-5xl mb-6">Panel en vivo: así de simple</h2>
          <p className="text-xl text-[#E0E0E0] mb-12 max-w-3xl">
            Cada servicio que registran tus barberos aparece acá al instante. Sin refrescar, sin esperar.
          </p>

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
                  <motion.tr
                    key={idx}
                    className="border-b border-[#383838] last:border-0 hover:bg-[rgba(200,169,126,0.05)]"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                  >
                    <td className="py-4 text-lg">{row.service}</td>
                    <td className="py-4 text-lg font-bold text-[#C8A97E]">{row.price}</td>
                    <td className="py-4 text-lg">{row.barber}</td>
                    <td className="py-4 text-lg text-[#A0A0A0]">{row.time}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* 3 Pasos */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-12">Registrá tu barbería en 3 pasos</h2>
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { num: '01', title: 'Registrate gratis', desc: 'Creá tu cuenta en menos de 2 minutos. No necesitás tarjeta.' },
            { num: '02', title: 'Personalizá', desc: 'Subí tu logo, elegí colores, configura comisiones y agrega a tus barberos.' },
            { num: '03', title: 'Empezá a usar', desc: 'Tu equipo ya puede registrar servicios. Vos ves todo en tiempo real.' },
          ].map((step, idx) => (
            <motion.div
              key={idx}
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: idx * 0.2 }}
              viewport={{ once: true }}
            >
              <div className="font-display font-black text-6xl lg:text-7xl bg-gradient-to-br from-[#C8A97E] to-[rgba(200,169,126,0.3)] bg-clip-text text-transparent mb-4">
                {step.num}
              </div>
              <h3 className="font-display font-bold text-3xl mb-4">{step.title}</h3>
              <p className="text-xl text-[#E0E0E0]">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Equipo */}
      <section id="equipo" className="px-6 lg:px-16 py-20 bg-[#242424] border-y border-[#383838]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 60, filter: 'blur(10px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            viewport={{ once: true, amount: 0.3 }}
          >
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
              ].map((person, idx) => (
                <motion.div
                  key={person.name}
                  className="text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="relative w-40 h-40 mx-auto mb-4">
                    <div
                      className="absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-r from-[#C8A97E] via-[#F0D5A0] to-[#C8A97E] animate-spin"
                      style={{ animationDuration: '3s', backgroundSize: '200% 200%' }}
                    />
                    <img
                      src={person.img}
                      alt={person.name}
                      className="absolute inset-2 w-36 h-36 rounded-full object-cover border-2 border-[#1a1a1a]"
                      loading="lazy"
                    />
                  </div>
                  <h4 className="font-display font-bold text-2xl">{person.name}</h4>
                  <p className="text-[#A0A0A0]">Barbero</p>
                </motion.div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-[#242424] to-[#1e1c19] border border-[#383838] rounded-2xl p-8 max-w-3xl mx-auto relative">
              <div className="text-[120px] absolute -top-10 -left-10 text-[#C8A97E] opacity-10">"</div>
              <p className="text-2xl text-[#E0E0E0] text-center italic relative z-10">
                "Antes perdía 2 horas cada quincena liquidando comisiones. Ahora es automático."
              </p>
              <div className="flex items-center justify-center gap-4 mt-6 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-r from-[#C8A97E] via-[#F0D5A0] to-[#C8A97E] animate-spin" style={{ animationDuration: '4s' }} />
                  <img
                    src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w-150&h=150&fit=crop"
                    alt="Dueño"
                    className="w-16 h-16 rounded-full border-2 border-[#1a1a1a] relative"
                    loading="lazy"
                  />
                </div>
                <div>
                  <div className="font-bold text-xl">Martín López</div>
                  <div className="text-[#A0A0A0]">Barbería Classic, Buenos Aires</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="px-6 lg:px-16 py-20 max-w-4xl mx-auto">
        <motion.div
          className="text-center relative"
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          <div className="inline-block bg-[#C8A97E] text-[#1a1a1a] px-4 py-2 rounded-full font-bold mb-6">
            Gratis 14 días
          </div>
          <h2 className="font-display font-bold text-4xl lg:text-5xl mb-6">Desde USD 15/mes o ARS 25.000/mes</h2>
          <p className="text-xl text-[#E0E0E0] mb-8 max-w-2xl mx-auto">
            Precio por barbería, sin límite de barberos. Cancelás cuando quieras.
          </p>
          <a
            href="/register"
            className="inline-block relative bg-[#C8A97E] text-[#1a1a1a] px-10 py-4 rounded-full font-bold hover:shadow-[0_0_30px_rgba(200,169,126,0.5)] hover:scale-105 transition-all duration-300 text-xl overflow-hidden group"
          >
            <span className="relative z-10">Comenzar prueba gratis</span>
            <div className="absolute inset-0 border-2 border-transparent rounded-full bg-gradient-to-r from-[#C8A97E] via-[#F0D5A0] to-[#C8A97E] animate-spin opacity-30" style={{ animationDuration: '4s' }} />
          </a>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-16 py-20 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-center mb-12">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {faqItems.map((item, idx) => (
            <motion.div
              key={idx}
              className="bg-[#242424] border border-[#383838] rounded-2xl overflow-hidden hover:bg-[rgba(200,169,126,0.03)] transition-colors"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <button
                className="w-full flex justify-between items-center p-6 text-left"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span className="font-display font-bold text-xl">{item.q}</span>
                <motion.div
                  animate={{ rotate: openFaq === idx ? 45 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-[#C8A97E]"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </motion.div>
              </button>
              <AnimatePresence>
                {openFaq === idx && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-6 pb-6"
                  >
                    <p className="text-[#E0E0E0] text-lg">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative pt-12 pb-8 px-6 lg:px-16 overflow-hidden">
        <div
          className="absolute inset-0 top-0 h-64 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(200,169,126,0.03))',
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(200,169,126,0.08), transparent)',
          }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-[#C8A97E]"></div>
                <span className="font-display font-bold text-2xl text-[#C8A97E]">BARBEROS</span>
              </div>
              <p className="text-[#A0A0A0]">Sistema de gestión profesional para barberías.</p>
            </div>
            <div>
              <h4 className="font-display font-bold text-xl mb-4">Producto</h4>
              <ul className="space-y-2 text-[#E0E0E0]">
                <li><button onClick={() => scrollToSection('servicios')} className="hover:text-[#C8A97E]">Servicios</button></li>
                <li><button onClick={() => scrollToSection('equipo')} className="hover:text-[#C8A97E]">Equipo</button></li>
                <li><button onClick={() => scrollToSection('precios')} className="hover:text-[#C8A97E]">Precios</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-bold text-xl mb-4">Recursos</h4>
              <ul className="space-y-2 text-[#E0E0E0]">
                <li><a href="/login" className="hover:text-[#C8A97E]">Login demo</a></li>
                <li><a href="/register" className="hover:text-[#C8A97E]">Registro</a></li>
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
              className="inline-block bg-[#C8A97E] text-[#1a1a1a] px-10 py-4 rounded-full font-bold hover:bg-[#D4B87A] hover:scale-105 transition-all duration-300 text-xl mb-8"
            >
              Empezar gratis
            </a>
            <p className="text-[#A0A0A0]">© 2026 BarberOS - Hecho en Río Gallegos, Santa Cruz, Argentina 🇦🇷</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;