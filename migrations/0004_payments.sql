-- customer_id has no FK yet: payments were imported from the old gateway before accounts were migrated.
-- merchant_id is nullable: the legacy POS integration didn't send it.
CREATE TABLE payments (
  id          bigserial PRIMARY KEY,
  customer_id bigint NOT NULL,
  merchant_id bigint REFERENCES merchants(id),
  amount      numeric(12,2) NOT NULL,
  status      text NOT NULL CHECK (status IN ('captured', 'refunded', 'failed')),
  upi_txn_ref text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
