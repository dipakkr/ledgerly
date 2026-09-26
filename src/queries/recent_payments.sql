-- Latest payments with customer and merchant names
SELECT p.id, p.created_at, p.amount, p.status, p.upi_txn_ref,
       c.full_name AS customer, m.name AS merchant
FROM payments p
LEFT JOIN customers c ON c.id = p.customer_id
LEFT JOIN merchants m ON m.id = p.merchant_id
ORDER BY p.created_at DESC, p.id DESC
LIMIT 50;
