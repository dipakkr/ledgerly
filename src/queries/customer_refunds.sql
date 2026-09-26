-- Refunds with the payment they reverse and who received them
SELECT r.id, r.created_at, r.amount, r.reason, p.upi_txn_ref, c.full_name AS customer
FROM refunds r
JOIN payments p ON p.id = r.payment_id
LEFT JOIN customers c ON c.id = p.customer_id
ORDER BY r.created_at DESC, r.id DESC
LIMIT 50;
