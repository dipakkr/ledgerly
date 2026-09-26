-- Dashboard KPIs: gross volume, refunds, net
SELECT
  (SELECT count(*) FROM payments WHERE status <> 'failed')                  AS payments,
  (SELECT coalesce(sum(amount), 0) FROM payments WHERE status <> 'failed')  AS gross_volume,
  (SELECT count(*) FROM refunds)                                            AS refunds,
  (SELECT coalesce(sum(amount), 0) FROM refunds)                            AS refunded,
  (SELECT coalesce(sum(amount), 0) FROM payments WHERE status <> 'failed')
    - (SELECT coalesce(sum(amount), 0) FROM refunds)                        AS net_volume;
