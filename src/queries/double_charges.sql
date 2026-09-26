-- Customers charged more than once for the same UPI transaction, and whether they got a refund
SELECT p.upi_txn_ref, count(*) AS charges, sum(p.amount) AS charged,
       coalesce(sum(r.amount), 0) AS refunded, min(c.full_name) AS customer
FROM payments p
LEFT JOIN refunds r ON r.payment_id = p.id
LEFT JOIN customers c ON c.id = p.customer_id
GROUP BY p.upi_txn_ref
HAVING count(*) > 1
ORDER BY charged DESC;
