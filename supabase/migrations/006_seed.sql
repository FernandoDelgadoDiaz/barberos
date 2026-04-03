-- INSTRUCCIONES:
-- 1. Ir a Supabase → Authentication → Users → Add user
-- 2. Crear: owner@demo.com / Demo1234!
-- 3. Crear: carlos@demo.com / Demo1234!
-- 4. Crear: gabriel@demo.com / Demo1234!
-- 5. Copiar los UUID de cada usuario y reemplazar abajo
-- 6. Ejecutar este SQL

INSERT INTO tenants (slug, name, primary_color, secondary_color) VALUES
('barber-demo', 'Demo Barbería', '#1a1a2e', '#e94560');

-- REEMPLAZAR LOS UUID ANTES DE EJECUTAR:
INSERT INTO profiles (tenant_id, user_id, role, display_name) VALUES
((SELECT id FROM tenants WHERE slug='barber-demo'), 'UUID_OWNER_AQUI', 'owner', 'Dueño Demo'),
((SELECT id FROM tenants WHERE slug='barber-demo'), 'UUID_CARLOS_AQUI', 'barber', 'Carlos'),
((SELECT id FROM tenants WHERE slug='barber-demo'), 'UUID_GABRIEL_AQUI', 'barber', 'Gabriel');

INSERT INTO services_catalog (tenant_id, name, base_price, duration_min) VALUES
((SELECT id FROM tenants WHERE slug='barber-demo'), 'Corte', 1500, 30),
((SELECT id FROM tenants WHERE slug='barber-demo'), 'Barba', 800, 20),
((SELECT id FROM tenants WHERE slug='barber-demo'), 'Cejas', 500, 15),
((SELECT id FROM tenants WHERE slug='barber-demo'), 'Diseño', 2000, 45);