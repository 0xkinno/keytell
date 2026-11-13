-- 07_deploys.sql
-- Purpose: secondary outcome, daily DEPLOY_CONTRACT actions.
-- Tables: bigquery-public-data.crypto_near_mainnet_us.receipt_actions
-- Range: block_date between @start and @end (partition column).
-- Dry-run bytes: 481.4 GB for 2022-01-03 to 2026-11-08 (measured 13 Nov 2026). NOT RUN: above the
--          300 GB budget. Deploys are estimated from the block sample instead (blocks.csv `deploys`).
SELECT block_date, COUNT(*) AS deploys
FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`
WHERE block_date BETWEEN @start AND @end AND action_kind = 'DEPLOY_CONTRACT'
GROUP BY block_date
ORDER BY block_date
