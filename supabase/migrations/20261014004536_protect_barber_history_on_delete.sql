-- Deleting a profile must never cascade through historical shifts/appointments.
-- Deferred NO ACTION still permits deleting an entire tenant in one transaction.
BEGIN;

-- Las instalaciones creadas por los scripts versionados y la base de producción
-- usan nombres distintos para estas mismas claves foráneas.
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS fk_shifts_barber;
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_barber_id_fkey;
ALTER TABLE public.shifts ADD CONSTRAINT fk_shifts_barber
  FOREIGN KEY (barber_id) REFERENCES public.profiles(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS fk_appointments_barber;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_barber_id_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT fk_appointments_barber
  FOREIGN KEY (barber_id) REFERENCES public.profiles(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

COMMIT;
