ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_payment_method text DEFAULT 'efectivo'
    CHECK (tip_payment_method IN ('efectivo', 'transferencia')),
  ADD COLUMN IF NOT EXISTS others_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS others_payment_method text DEFAULT 'efectivo'
    CHECK (others_payment_method IN ('efectivo', 'transferencia'));
