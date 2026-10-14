-- Deleting a profile must never cascade through historical shifts/appointments.
-- Deferred NO ACTION still permits deleting an entire tenant in one transaction.
BEGIN;

ALTER TABLE public.shifts DROP CONSTRAINT fk_shifts_barber;
ALTER TABLE public.shifts ADD CONSTRAINT fk_shifts_barber
  FOREIGN KEY (barber_id) REFERENCES public.profiles(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.appointments DROP CONSTRAINT fk_appointments_barber;
ALTER TABLE public.appointments ADD CONSTRAINT fk_appointments_barber
  FOREIGN KEY (barber_id) REFERENCES public.profiles(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

COMMIT;
