-- Payments we can't attribute: unknown customer or no merchant
SELECT
  (SELECT count(*) FROM payments p WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = p.customer_id)) AS unknown_customer,
  (SELECT count(*) FROM payments WHERE merchant_id IS NULL) AS no_merchant;
