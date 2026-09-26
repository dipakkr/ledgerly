-- Enforce ledger integrity: one payment per UPI transaction, every payment belongs to a
-- customer and a merchant. Clears the duplicate charges left by the UPI retry bug first.
DELETE FROM payments p
  USING payments q
  WHERE p.upi_txn_ref = q.upi_txn_ref
    AND p.id > q.id;

ALTER TABLE payments ADD CONSTRAINT payments_upi_txn_ref_key UNIQUE (upi_txn_ref);
ALTER TABLE payments ADD CONSTRAINT payments_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE payments ALTER COLUMN merchant_id SET NOT NULL;
