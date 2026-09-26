CREATE INDEX payments_customer_id_idx ON payments (customer_id);
CREATE INDEX payments_created_at_idx ON payments (created_at);
CREATE INDEX refunds_payment_id_idx ON refunds (payment_id);
