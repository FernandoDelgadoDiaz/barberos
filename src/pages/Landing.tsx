import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import type { Variants } from 'framer-motion';

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const BAR_VALUES = [12000, 18000, 22000, 47500, 31000, 38000, 15000];
const BAR_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const BAR_MAX = Math.max(...BAR_VALUES);

const HERO_BG = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1600&q=80';
const PAIN_BG = 'https://plus.unsplash.com/premium_photo-1673468922192-52594b42cc2b?w=1600&q=80';
const CTA_BG = 'https://images.unsplash.com/photo-1626653395376-1f6bae92125e?w=1600&q=80';

const Landing = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [countUp, setCountUp] = useState({ billing: 0, profit: 0, services: 0 });

  const demoRef = useRef<HTMLDivElement>(null);
  const demoInView = useInView(demoRef, { once: true });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!demoInView) return;
    const targets = { billing: 47500, profit: 19000, services: 8 };
    const steps = 60;
    let step = 0;
    const id = setInterval(() => {
      step++;
      const p = step / steps;
      setCountUp({
        billing: Math.round(targets.billing * p),
        profit: Math.round(targets.profit * p),
        services: Math.round(targets.services * p),
      });
      if (step >= steps) clearInterval(id);
    }, 25);
    return () => clearInterval(id);
  }, [demoInView]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const navLinks = [
    { label: 'Funcionalidades', id: 'funcionalidades' },
    { label: 'Cómo funciona', id: 'como-funciona' },
    { label: 'Preguntas', id: 'preguntas' },
  ];

  const faqItems = [
    {
      q: '¿Puedo cambiar las comisiones cuando quiera?',
      a: 'Sí, desde Configuración puedes modificar las reglas de comisión en cualquier momento. El cambio aplica a partir del próximo servicio.',
    },
    {
      q: '¿Mis barberos ven lo que ganan los demás?',
      a: 'No. Cada barbero ve solo sus propios servicios y su propia ganancia del día.',
    },
    {
      q: '¿Puedo agregar y quitar servicios del catálogo?',
      a: 'Sí, desde tu panel puedes agregar servicios, cambiar precios y activar o desactivar los que no uses.',
    },
    {
      q: '¿Necesito instalar algo?',
      a: 'No, funciona en cualquier celular o computadora con internet. Sin apps, sin instalaciones.',
    },
  ];

  const painCards = [
    { icon: '🚫', title: 'Pagaste comisiones mal', desc: 'Porque nadie registró bien cuántos cortes hizo cada uno y tuviste que fiarte de la memoria.' },
    { icon: '📝', title: 'Papel, memoria y excusas', desc: 'Los barberos anotan en papel, en el celular, o directamente no anotan. Nunca cierra.' },
    { icon: '💥', title: 'Liquidaciones que terminan en pelea', desc: 'Cada quincena es una negociación. Yo hice más, eso no lo contamos, faltó un servicio.' },
    { icon: '📱', title: 'Sin identidad propia', desc: 'Usas apps genéricas que no tienen nada que ver con tu barbería. Tus clientes no te recuerdan a ti, recuerdan la app.' },
  ];

  const features = [
    {
      title: 'Registra servicios en segundos',
      desc: 'Cada barbero registra desde su celular. Tú lo ves al instante en tu panel.',
      svg: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      title: 'Comisiones 100% configurables',
      desc: 'Fijas % por servicio, por barbero, por cantidad de asistencias. Se calculan solas.',
      svg: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      ),
    },
    {
      title: 'Tu catálogo de servicios',
      desc: 'Agregas, editas y sacas servicios y precios cuando quieras, sin llamar a nadie.',
      svg: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    {
      title: 'Panel en vivo desde donde estés',
      desc: 'Ves lo que pasa en tu local en tiempo real, aunque no estés ahí.',
      svg: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      title: 'Tu marca, no la nuestra',
      desc: 'Tus colores, tu nombre. Los barberos ven tu barbería, no una app genérica.',
      svg: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
  ];

  const steps = [
    { num: '01', title: 'Registrarte gratis', desc: '2 minutos, sin tarjeta. Tu barbería configurada y lista para usar.' },
    { num: '02', title: 'Configurar a tu manera', desc: 'Cargas servicios, precios y las reglas de comisión. Tú decides todo.' },
    { num: '03', title: 'Tu equipo arranca hoy', desc: 'Cada barbero entra con su usuario. Tú ves todo en tiempo real.' },
  ];

  const tableRows = [
    { service: 'Degradé completo', barber: 'Nicolás', amount: '$5.500', time: 'hace 8 min' },
    { service: 'Corte + barba', barber: 'Sebastián', amount: '$4.200', time: 'hace 21 min' },
    { service: 'Fade clásico', barber: 'Nicolás', amount: '$3.800', time: 'hace 35 min' },
    { service: 'Barba perfilada', barber: 'Sebastián', amount: '$2.500', time: 'hace 52 min' },
    { service: 'Corte clásico', barber: 'Nicolás', amount: '$3.800', time: 'hace 1h 10min' },
  ];

  const badge = (text: string, red = true) => (
    <span style={{
      display: 'inline-block',
      border: `1px solid ${red ? '#E63030' : 'rgba(255,255,255,0.3)'}`,
      color: red ? '#E63030' : 'rgba(255,255,255,0.55)',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.1em',
      padding: '5px 14px',
      borderRadius: '9999px',
      marginBottom: '20px',
    }}>
      {text}
    </span>
  );

  return (
    <div style={{ backgroundColor: '#0A0A0A', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif', overflowX: 'hidden' }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: 'rgba(10,10,10,0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          maxWidth: '1280px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 24px', height: '68px',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '26px', height: '26px', backgroundColor: '#E63030', borderRadius: '5px', flexShrink: 0 }} />
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '17px', whiteSpace: 'nowrap' }}>Aliada Barberías</span>
          </div>

          {/* Desktop links */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              {navLinks.map((l) => (
                <button
                  key={l.id}
                  onClick={() => scrollToSection(l.id)}
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.65)', fontSize: '15px',
                    cursor: 'pointer', transition: 'color 0.2s',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                >
                  {l.label}
                </button>
              ))}
              <a
                href="/register"
                style={{
                  backgroundColor: '#E63030', color: '#ffffff',
                  padding: '10px 22px', borderRadius: '9999px',
                  fontWeight: 600, textDecoration: 'none', fontSize: '14px',
                }}
              >
                Empezar gratis
              </a>
            </div>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', padding: '8px' }}
              aria-label="Menú"
            >
              {menuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {menuOpen && isMobile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28 }}
              style={{
                overflow: 'hidden',
                backgroundColor: 'rgba(15,15,15,0.97)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {navLinks.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => scrollToSection(l.id)}
                    style={{
                      background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)',
                      fontSize: '16px', cursor: 'pointer', textAlign: 'left', padding: '10px 0',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
                <a
                  href="/register"
                  style={{
                    backgroundColor: '#E63030', color: '#ffffff',
                    padding: '12px 24px', borderRadius: '9999px',
                    fontWeight: 600, textDecoration: 'none', textAlign: 'center',
                    marginTop: '8px', display: 'block',
                  }}
                >
                  Empezar gratis
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh',
        backgroundImage: `url(${HERO_BG})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        position: 'relative', display: 'flex', alignItems: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)' }} />
        <div style={{
          maxWidth: '1280px', margin: '0 auto',
          padding: '80px 24px 100px', position: 'relative', zIndex: 1, width: '100%',
        }}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.14 } } }}
          >
            <motion.div variants={fadeInUp} transition={{ duration: 0.6 }}>
              <span style={{
                display: 'inline-block',
                border: '1px solid #E63030', color: '#E63030',
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
                padding: '5px 14px', borderRadius: '9999px', marginBottom: '28px',
              }}>
                ● SISTEMA DE GESTIÓN PROFESIONAL
              </span>
            </motion.div>

            <motion.h1 variants={fadeInUp} transition={{ duration: 0.7 }} style={{ margin: '0 0 24px', lineHeight: 1.08 }}>
              <span style={{
                display: 'block', color: '#ffffff', fontWeight: 700,
                fontSize: 'clamp(3rem,6vw,5rem)',
              }}>
                El sistema que trabaja
              </span>
              <span style={{
                display: 'block', color: '#E63030', fontWeight: 700,
                fontSize: 'clamp(3rem,6vw,5rem)',
              }}>
                mientras tú cortas
              </span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              transition={{ duration: 0.7 }}
              style={{
                color: 'rgba(255,255,255,0.72)', fontSize: 'clamp(1rem,2vw,1.2rem)',
                maxWidth: '560px', lineHeight: 1.7, margin: '0 0 36px',
              }}
            >
              Registra servicios, calcula comisiones automáticamente y controla tu barbería desde el celular. Sin planillas, sin discusiones, sin errores.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.7 }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '28px' }}
            >
              <a
                href="/register"
                style={{
                  backgroundColor: '#E63030', color: '#ffffff',
                  padding: '16px 32px', borderRadius: '9999px',
                  fontWeight: 600, textDecoration: 'none', fontSize: '16px',
                  display: 'inline-block',
                }}
              >
                Empezar 15 días gratis →
              </a>
              <button
                onClick={() => scrollToSection('demo')}
                style={{
                  border: '1px solid #ffffff', color: '#ffffff',
                  background: 'transparent', padding: '16px 32px',
                  borderRadius: '9999px', fontWeight: 600, fontSize: '16px', cursor: 'pointer',
                }}
              >
                Ver cómo funciona
              </button>
            </motion.div>

            <motion.p
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
              style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}
            >
              ✓ Sin tarjeta de crédito · Sin compromiso · Cancelas cuando quieras
            </motion.p>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 9, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          onClick={() => scrollToSection('stats')}
          style={{
            position: 'absolute', bottom: '28px',
            left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </section>

      {/* ── STATS BAR ── */}
      <section id="stats" style={{ backgroundColor: '#111111', padding: '56px 24px' }}>
        <div style={{
          maxWidth: '900px', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap',
          justifyContent: 'center', alignItems: 'center', gap: '0',
        }}>
          {[
            { value: '3 clicks', label: 'para registrar un servicio' },
            { value: '100% automático', label: 'el cálculo de comisiones' },
            { value: 'Tiempo real', label: 'visibilidad del dueño, desde donde esté' },
          ].map((stat, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'stretch' }}>
              {idx > 0 && (
                <div style={{ width: '1px', backgroundColor: '#333', margin: '0 32px', alignSelf: 'stretch', minHeight: '60px' }} />
              )}
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.13 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{
                  color: '#ffffff', fontWeight: 700,
                  fontSize: 'clamp(2.4rem,5vw,4rem)', lineHeight: 1.05, marginBottom: '8px',
                }}>
                  {stat.value}
                </div>
                <div style={{ color: '#999999', fontSize: '13px', maxWidth: '190px' }}>
                  {stat.label}
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PAIN SECTION ── */}
      <section
        id="funcionalidades"
        style={{
          backgroundImage: `url(${PAIN_BG})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          position: 'relative', padding: '96px 24px',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)' }} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ textAlign: 'center', marginBottom: '56px' }}
          >
            {badge('¿ESTO TE SUENA FAMILIAR?', false)}
            <h2 style={{
              color: '#ffffff', fontWeight: 700,
              fontSize: 'clamp(1.8rem,4vw,3rem)', margin: '0 0 14px',
            }}>
              El caos que quieres dejar atrás
            </h2>
            <p style={{ color: '#999', fontSize: '17px', maxWidth: '520px', margin: '0 auto' }}>
              Cada uno de estos problemas le cuesta dinero real a tu negocio
            </p>
          </motion.div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            {painCards.map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px', padding: '32px',
                }}
              >
                <div style={{ fontSize: '34px', marginBottom: '14px' }}>{card.icon}</div>
                <h3 style={{ color: '#ffffff', fontWeight: 700, fontSize: '18px', marginBottom: '10px' }}>
                  {card.title}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.58)', lineHeight: 1.7, fontSize: '15px', margin: 0 }}>
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ backgroundColor: '#0A0A0A', padding: '96px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ textAlign: 'center', marginBottom: '56px' }}
          >
            {badge('FUNCIONALIDADES')}
            <h2 style={{
              color: '#ffffff', fontWeight: 700,
              fontSize: 'clamp(1.8rem,4vw,3rem)', margin: 0,
            }}>
              Todo el control, desde tu celular
            </h2>
          </motion.div>

          {/* Row 1 — 3 cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px', marginBottom: '20px',
          }}>
            {features.slice(0, 3).map((feat, idx) => (
              <FeatureCard key={idx} feat={feat} delay={idx * 0.1} />
            ))}
          </div>

          {/* Row 2 — 2 cards centered */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            flexWrap: 'wrap', gap: '20px',
          }}>
            {features.slice(3).map((feat, idx) => (
              <div key={idx} style={{ flex: '0 1 380px' }}>
                <FeatureCard feat={feat} delay={0.3 + idx * 0.1} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="como-funciona" style={{ backgroundColor: '#111111', padding: '96px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ textAlign: 'center', marginBottom: '64px' }}
          >
            {badge('CÓMO FUNCIONA')}
            <h2 style={{
              color: '#ffffff', fontWeight: 700,
              fontSize: 'clamp(1.8rem,4vw,3rem)', margin: 0,
            }}>
              En 3 pasos, tu barbería digitalizada
            </h2>
          </motion.div>

          <div style={{
            display: 'flex', flexWrap: 'wrap',
            justifyContent: 'center', gap: '8px',
            position: 'relative',
          }}>
            {/* Connector line */}
            {!isMobile && (
              <div style={{
                position: 'absolute', top: '56px',
                left: '18%', right: '18%',
                height: '2px',
                background: 'linear-gradient(to right, rgba(230,48,48,0.15), rgba(230,48,48,0.5), rgba(230,48,48,0.15))',
              }} />
            )}

            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.65, delay: idx * 0.18 }}
                style={{
                  flex: '1 1 240px', maxWidth: '280px',
                  textAlign: 'center', position: 'relative', zIndex: 1,
                  padding: '0 16px',
                }}
              >
                <div style={{
                  color: '#E63030', fontWeight: 700,
                  fontSize: 'clamp(2.5rem,5vw,3.5rem)',
                  lineHeight: 1, marginBottom: '12px',
                }}>
                  {step.num}
                </div>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  border: '2px solid #E63030',
                  backgroundColor: 'rgba(230,48,48,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: '26px',
                }}>
                  {idx === 0 ? '🚀' : idx === 1 ? '⚙️' : '✅'}
                </div>
                <h3 style={{ color: '#ffffff', fontWeight: 700, fontSize: '17px', marginBottom: '10px' }}>
                  {step.title}
                </h3>
                <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.65, margin: 0 }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO PANEL ── */}
      <section id="demo" style={{ backgroundColor: '#0A0A0A', padding: '96px 24px' }} ref={demoRef}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ textAlign: 'center', marginBottom: '48px' }}
          >
            {badge('DEMO EN VIVO')}
            <h2 style={{
              color: '#ffffff', fontWeight: 700,
              fontSize: 'clamp(1.8rem,4vw,3rem)', margin: '0 0 14px',
            }}>
              Así se ve tu panel en vivo
            </h2>
            <p style={{ color: '#888', fontSize: '17px', margin: 0 }}>
              Toda la información de tu negocio, en tiempo real, desde cualquier lugar.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            style={{
              backgroundColor: '#111111',
              border: '1px solid #222222',
              borderRadius: '18px', overflow: 'hidden',
            }}
          >
            {/* Dashboard header */}
            <div style={{
              backgroundColor: '#1a1a1a',
              padding: '14px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid #222',
              flexWrap: 'wrap', gap: '8px',
            }}>
              <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '13px' }}>
                La Barbería RG · Panel del dueño
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ color: '#666', fontSize: '12px' }}>Jue 24 de abril</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    display: 'inline-block', width: '8px', height: '8px',
                    borderRadius: '50%', backgroundColor: '#22c55e',
                    boxShadow: '0 0 0 3px rgba(34,197,94,0.25)',
                  }} />
                  <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>EN VIVO</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              {/* KPI row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px', marginBottom: '16px',
              }}>
                {[
                  { label: 'FACTURACIÓN HOY', value: `$${countUp.billing.toLocaleString('es-AR')}`, sub: '↑12% vs. ayer', subColor: '#22c55e' },
                  { label: 'TU GANANCIA', value: `$${countUp.profit.toLocaleString('es-AR')}`, sub: '40% del total', subColor: '#999' },
                  { label: 'SERVICIOS', value: `${countUp.services}`, sub: 'completados hoy', subColor: '#999' },
                  { label: 'BARBEROS ACTIVOS', value: '2/2', sub: 'online', subColor: '#22c55e' },
                ].map((kpi, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#0d0d0d', border: '1px solid #222',
                    borderRadius: '10px', padding: '16px',
                  }}>
                    <div style={{ color: '#555', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', marginBottom: '6px' }}>
                      {kpi.label}
                    </div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', marginBottom: '4px' }}>
                      {kpi.value}
                    </div>
                    <div style={{ color: kpi.subColor, fontSize: '11px' }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{
                backgroundColor: '#0d0d0d', border: '1px solid #222',
                borderRadius: '12px', padding: '20px', marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{ color: '#555', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em' }}>
                    INGRESOS ESTA SEMANA
                  </span>
                  <span style={{ color: '#22c55e', fontSize: '12px' }}>↑24% vs sem. anterior</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '88px' }}>
                  {BAR_VALUES.map((val, idx) => (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: `${(val / BAR_MAX) * 68}px` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.65, delay: 0.2 + idx * 0.07, ease: 'easeOut' }}
                        style={{
                          width: '100%',
                          backgroundColor: idx === 3 ? '#E63030' : 'rgba(230,48,48,0.38)',
                          borderRadius: '4px 4px 0 0',
                          transformOrigin: 'bottom',
                        }}
                      />
                      <span style={{ color: '#444', fontSize: '9px', whiteSpace: 'nowrap' }}>
                        {BAR_DAYS[idx]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{
                backgroundColor: '#0d0d0d', border: '1px solid #222',
                borderRadius: '12px', overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a1a1a' }}>
                  <span style={{ color: '#555', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em' }}>
                    ÚLTIMOS SERVICIOS
                  </span>
                </div>
                {tableRows.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 20px',
                      borderBottom: idx < tableRows.length - 1 ? '1px solid #1a1a1a' : 'none',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                    <span style={{ color: '#e0e0e0', fontSize: '13px', flex: '2 1 120px' }}>{row.service}</span>
                    <span style={{ color: '#777', fontSize: '12px', flex: '1 1 80px' }}>{row.barber}</span>
                    <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '13px', flex: '0 0 auto' }}>{row.amount}</span>
                    <span style={{ color: '#444', fontSize: '11px', flex: '0 0 auto' }}>{row.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="preguntas" style={{ backgroundColor: '#111111', padding: '96px 24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{
              color: '#ffffff', fontWeight: 700,
              fontSize: 'clamp(1.8rem,4vw,3rem)',
              textAlign: 'center', margin: '0 0 48px',
            }}
          >
            Preguntas frecuentes
          </motion.h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                style={{
                  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: '16px', overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  style={{
                    width: '100%', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                    padding: '22px 24px', background: 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    gap: '16px',
                  }}
                >
                  <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '15px' }}>{item.q}</span>
                  <motion.div
                    animate={{ rotate: openFaq === idx ? 45 : 0 }}
                    transition={{ duration: 0.28 }}
                    style={{ color: '#E63030', flexShrink: 0 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === idx && (
                    <motion.div
                      key="body"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p style={{
                        color: '#888', fontSize: '14px',
                        lineHeight: 1.72, padding: '0 24px 22px', margin: 0,
                      }}>
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{
        backgroundImage: `url(${CTA_BG})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        position: 'relative', padding: '128px 24px',
        textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.70)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <span style={{
              display: 'inline-block',
              backgroundColor: 'rgba(230,48,48,0.18)',
              border: '1px solid #E63030', color: '#ff9090',
              fontSize: '13px', fontWeight: 600,
              padding: '8px 20px', borderRadius: '9999px', marginBottom: '36px',
            }}>
              ✓ 15 días gratis · Sin tarjeta de crédito
            </span>

            <h2 style={{ fontWeight: 700, fontSize: 'clamp(2rem,5vw,3.5rem)', margin: '0 0 6px', lineHeight: 1.12 }}>
              <span style={{ display: 'block', color: '#ffffff' }}>Toma el control de</span>
              <span style={{ display: 'block', color: '#E63030' }}>tu dinero hoy</span>
            </h2>

            <p style={{
              color: 'rgba(255,255,255,0.6)', fontSize: '17px',
              maxWidth: '500px', margin: '24px auto 40px', lineHeight: 1.7,
            }}>
              Deja de perder dinero por falta de control. Empieza gratis y configura tu barbería en menos de 5 minutos.
            </p>

            <a
              href="/register"
              style={{
                display: 'inline-block',
                backgroundColor: '#E63030', color: '#ffffff',
                padding: '20px 44px', borderRadius: '9999px',
                fontWeight: 700, fontSize: '19px',
                textDecoration: 'none', marginBottom: '20px',
              }}
            >
              Empezar gratis ahora →
            </a>

            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '13px', margin: 0 }}>
              Sin compromiso. Cancelas cuando quieras.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        backgroundColor: '#050505',
        borderTop: '1px solid #1a1a1a',
        padding: '64px 24px 32px',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Logo + tagline */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '48px' }}>
            <div style={{ width: '26px', height: '26px', backgroundColor: '#E63030', borderRadius: '5px', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>Aliada Barberías</div>
              <div style={{ color: '#444', fontSize: '13px' }}>Sistema de gestión profesional para barberías.</div>
            </div>
          </div>

          {/* Columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '32px', marginBottom: '48px',
          }}>
            {[
              {
                title: 'Producto',
                items: [
                  <button key="f" onClick={() => scrollToSection('funcionalidades')} style={footerLinkStyle}>Funcionalidades</button>,
                  <button key="c" onClick={() => scrollToSection('como-funciona')} style={footerLinkStyle}>Cómo funciona</button>,
                  <button key="p" onClick={() => scrollToSection('preguntas')} style={footerLinkStyle}>Preguntas</button>,
                ],
              },
              {
                title: 'Cuenta',
                items: [
                  <a key="l" href="/login" style={{ ...footerLinkStyle, textDecoration: 'none' }}>Login</a>,
                  <a key="r" href="/register" style={{ ...footerLinkStyle, textDecoration: 'none' }}>Registro</a>,
                ],
              },
              {
                title: 'Legal',
                items: [
                  <span key="t" style={footerLinkStyle}>Términos</span>,
                  <span key="p" style={footerLinkStyle}>Privacidad</span>,
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 style={{ color: '#ffffff', fontWeight: 600, fontSize: '13px', marginBottom: '16px', letterSpacing: '0.05em' }}>
                  {col.title}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.items}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '24px', textAlign: 'center' }}>
            <p style={{ color: '#2a2a2a', fontSize: '13px', margin: 0 }}>© 2026 Aliada Barberías</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const footerLinkStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  color: '#444', fontSize: '13px',
  cursor: 'pointer', textAlign: 'left', padding: 0,
  display: 'block',
};

interface FeatureCardProps {
  feat: { title: string; desc: string; svg: React.ReactNode };
  delay: number;
}

const FeatureCard = ({ feat, delay }: FeatureCardProps) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#1a1a1a',
        border: `1px solid ${hovered ? '#E63030' : '#2a2a2a'}`,
        borderRadius: '20px', padding: '32px',
        transition: 'border-color 0.25s',
        height: '100%', boxSizing: 'border-box',
      }}
    >
      <div style={{
        width: '52px', height: '52px', borderRadius: '12px',
        backgroundColor: 'rgba(230,48,48,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px',
      }}>
        {feat.svg}
      </div>
      <h3 style={{ color: '#ffffff', fontWeight: 700, fontSize: '17px', marginBottom: '10px' }}>
        {feat.title}
      </h3>
      <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>
        {feat.desc}
      </p>
    </motion.div>
  );
};

export default Landing;
