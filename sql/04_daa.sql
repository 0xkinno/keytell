-- 04_daa.sql
-- Purpose: daily transaction count and daily active accounts (distinct transaction signers).
-- Tables: bigquery-public-data.crypto_near_mainnet_us.transactions
-- Range: block_date between @start and @end (in-sample 2022-01-03 to 2024-12-29; out-of-sample
--        2024-12-30 to 2026-11-08), always filtered on the partition column.
-- Dry-run bytes: 88.4 GB in-sample, 65.3 GB out-of-sample (153.7 GB for both, measured 13 Nov 2026).
SELECT
  block_date,
  COUNT(*) AS transactions,
  COUNT(DISTINCT signer_account_id) AS active_accounts
FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
WHERE block_date BETWEEN @start AND @end
GROUP BY block_date
ORDER BY block_date
