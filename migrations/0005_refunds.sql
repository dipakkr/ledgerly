CREATE TABLE refunds (
  id         bigserial PRIMARY KEY,
  payment_id bigint NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount     numeric(12,2) NOT NULL CHECK (amount > 0),
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
