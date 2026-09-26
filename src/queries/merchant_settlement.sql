-- What each merchant is owed: captured volume minus refunds
SELECT m.id, m.name, m.city,
       count(p.id) AS payments,
       coalesce(sum(p.amount) FILTER (WHERE p.status <> 'failed'), 0) AS captured,
       coalesce(sum(r.amount), 0) AS refunded,
       coalesce(sum(p.amount) FILTER (WHERE p.status <> 'failed'), 0) - coalesce(sum(r.amount), 0) AS payable
FROM merchants m
LEFT JOIN payments p ON p.merchant_id = m.id
LEFT JOIN refunds r ON r.payment_id = p.id
GROUP BY m.id
ORDER BY payable DESC
LIMIT 20;
