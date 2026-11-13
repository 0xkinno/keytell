-- 05_usdc_volume.sql
-- Purpose: the primary outcome. Daily USDC moved on NEAR by NEP-141 ft_transfer events, native USDC
--          (contract id from Circle's documentation) and bridged USDC.e, counting the receiving side
--          of each transfer once (positive deltas only), successful events only.
-- Tables: bigquery-public-data.crypto_near_mainnet_us.ft_events
-- Range: block_date between @start and @end (partition column).
-- Dry-run bytes: 20.3 GB for 2022-01-03 to 2026-11-08 (measured 13 Nov 2026).
SELECT
  block_date,
  contract_account_id,
  COUNT(*) AS transfers,
  CAST(SUM(SAFE_CAST(delta_amount AS BIGNUMERIC)) / 1000000 AS FLOAT64) AS usdc
FROM `bigquery-public-data.crypto_near_mainnet_us.ft_events`
WHERE block_date BETWEEN @start AND @end
  AND contract_account_id IN (
    '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
    'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near')
  AND cause = 'ft_transfer'
  AND status LIKE 'SUCCESS%'
  AND SAFE_CAST(delta_amount AS BIGNUMERIC) > 0
GROUP BY block_date, contract_account_id
ORDER BY block_date, contract_account_id
