-- 06_retention.sql
-- Purpose: secondary outcome, 30-day retained signers: accounts that signed in week t and again in
--          any of weeks t+4 to t+8, per week t.
-- Tables: bigquery-public-data.crypto_near_mainnet_us.transactions
-- Range: block_date between @start and @end (partition column).
-- Dry-run bytes: about 154 GB for 2022-01-03 to 2026-11-08 on top of sql/04, which takes the rebuild
--          over its 300 GB budget. NOT RUN in this build; reported as not computable within budget.
WITH w AS (
  SELECT DISTINCT signer_account_id AS a, DATE_TRUNC(block_date, ISOWEEK) AS wk
  FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
  WHERE block_date BETWEEN @start AND @end
)
SELECT w.wk AS week_monday,
  COUNT(DISTINCT w.a) AS signers,
  COUNT(DISTINCT IF(l.a IS NOT NULL, w.a, NULL)) AS retained_4_to_8_weeks
FROM w
LEFT JOIN w AS l
  ON l.a = w.a AND l.wk BETWEEN DATE_ADD(w.wk, INTERVAL 4 WEEK) AND DATE_ADD(w.wk, INTERVAL 8 WEEK)
GROUP BY week_monday
ORDER BY week_monday
