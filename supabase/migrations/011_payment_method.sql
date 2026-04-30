ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'transferencia'));
