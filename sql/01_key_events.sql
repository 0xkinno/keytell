-- 01_key_events.sql
-- Purpose: the key ledger. Every ADD_KEY and DELETE_KEY action with its account, public key and,
--          for ADD_KEY, the permission: FullAccess, or FunctionCall with receiver, methods, allowance.
--          JSON paths confirmed on real rows (data/probe/add_key_sample.json,
--          add_key_function_call_sample.json, delete_key_sample.json).
-- Tables: bigquery-public-data.crypto_near_mainnet_us.receipt_actions
-- Range: block_date between @start and @end (partition column).
-- Dry-run bytes: about 9 to 10 GB per day of history (8.5 to 10.2 GB measured for single days in 2024 and
--          2025), roughly 20 TB from genesis. NOT RUN in this build: far above the 300 GB budget. The
--          sampler applies the same rule to sampled transactions through RPC state instead
--          (scripts/sample-chain.ts), and scripts/lib/classify.ts permissionAt() is its tested twin.
SELECT
  receipt_receiver_account_id AS account_id,
  JSON_VALUE(args, '$.public_key') AS public_key,
  action_kind,
  CASE
    WHEN action_kind = 'DELETE_KEY' THEN NULL
    WHEN JSON_VALUE(args, '$.access_key.permission') = 'FullAccess' THEN 'FullAccess'
    WHEN JSON_QUERY(args, '$.access_key.permission.FunctionCall') IS NOT NULL THEN 'FunctionCall'
  END AS permission_kind,
  JSON_VALUE(args, '$.access_key.permission.FunctionCall.receiver_id') AS fc_receiver_id,
  JSON_QUERY(args, '$.access_key.permission.FunctionCall.method_names') AS fc_method_names,
  JSON_VALUE(args, '$.access_key.permission.FunctionCall.allowance') AS fc_allowance,
  block_timestamp,
  receipt_id,
  index_in_action_receipt
FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`
WHERE block_date BETWEEN @start AND @end
  AND action_kind IN ('ADD_KEY', 'DELETE_KEY')
