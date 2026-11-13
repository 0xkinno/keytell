-- 00_probe_schema.sql
-- Purpose: the platform probe. Column list of every table we query, and the first and last
--          partition day per table (metadata only, no table scan). scripts/bq_probe.py runs these
--          and writes data/probe/*.json; PLATFORM_PROBE.md quotes the results.
-- Tables: bigquery-public-data.crypto_near_mainnet_us.INFORMATION_SCHEMA.{COLUMNS,PARTITIONS}
-- Dry-run bytes: 0.01 GB each (measured 13 Nov 2026).
SELECT table_name, column_name, data_type
FROM `bigquery-public-data.crypto_near_mainnet_us.INFORMATION_SCHEMA.COLUMNS`
ORDER BY table_name, ordinal_position;

SELECT table_name, MIN(partition_id) AS first_day, MAX(partition_id) AS last_day, COUNT(*) AS days, SUM(total_rows) AS total_rows
FROM `bigquery-public-data.crypto_near_mainnet_us.INFORMATION_SCHEMA.PARTITIONS`
WHERE partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
GROUP BY table_name
ORDER BY table_name;
