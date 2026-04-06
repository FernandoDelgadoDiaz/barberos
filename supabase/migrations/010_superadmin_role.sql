-- Asignar rol superadmin al usuario owner@demo.com
-- Ejecutar en Supabase SQL Editor

UPDATE profiles
SET role = 'superadmin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'owner@demo.com');