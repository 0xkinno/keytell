-- 03_weekly_kinds.sql
-- Purpose: weekly transaction counts per key bucket, from sql/02. The census form of the weekly
--          function-call share.
-- Tables: the output of sql/02 materialised as `keytell.tx_classified` (with block_date).
-- Dry-run bytes: depends on sql/02; NOT RUN in this build. The weekly shares used in the analysis come
--          from the block sample (analysis/weekly.py), times the census count from sql/04.
SELECT
  DATE_TRUNC(block_date, ISOWEEK) AS week_monday,
  bucket,
  COUNT(*) AS transactions
FROM `keytell.tx_classified`
WHERE block_date BETWEEN @start AND @end
GROUP BY week_monday, bucket
ORDER BY week_monday, bucket
