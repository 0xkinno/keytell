-- 02_tx_classified.sql
-- Purpose: classify each transaction by its signing key at signing time: the latest ADD_KEY for
--          (signer, public key) strictly before the transaction with no DELETE_KEY after it and
--          before the transaction. Delegate actions (NEP-366) are classified by the inner signer.
--          Same rule as scripts/lib/classify.ts (permissionAt, classify); one documented difference:
--          SQL cannot base58-decode, so a 64-hex implicit signer with no key event is IMPLICIT_FULL
--          whatever its key, where the TypeScript twin checks that the key derives the name.
-- Tables: transactions, transaction_actions, and key_events (sql/01 materialised as
--          `@project.keytell.key_events`). The CTEs `tx`, `del` and `ke` are replaced by fixtures in
--          tests (BigQuery WITH fixtures), so the logic runs on tiny tables.
-- Range: block_date between @start and @end.
-- Dry-run bytes: depends on key_events; NOT RUN in this build (sql/01 is above budget).
WITH
tx AS (
  SELECT transaction_hash, signer_account_id, signer_public_key, block_timestamp
  FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
  WHERE block_date BETWEEN @start AND @end
),
del AS (
  SELECT transaction_hash,
    JSON_VALUE(args, '$.Delegate.delegate_action.sender_id') AS inner_signer,
    JSON_VALUE(args, '$.Delegate.delegate_action.public_key') AS inner_public_key
  FROM `bigquery-public-data.crypto_near_mainnet_us.transaction_actions`
  WHERE block_date BETWEEN @start AND @end AND action_kind = 'DELEGATE_ACTION'
),
ke AS (
  SELECT account_id, public_key, action_kind, permission_kind, block_timestamp, index_in_action_receipt
  FROM `keytell.key_events`
),
signing AS (
  SELECT tx.transaction_hash, tx.block_timestamp,
    COALESCE(del.inner_signer, tx.signer_account_id) AS account_id,
    COALESCE(del.inner_public_key, tx.signer_public_key) AS public_key,
    del.transaction_hash IS NOT NULL AS delegated
  FROM tx LEFT JOIN del USING (transaction_hash)
),
latest AS (
  SELECT s.*, ke.action_kind, ke.permission_kind,
    ROW_NUMBER() OVER (PARTITION BY s.transaction_hash
                       ORDER BY ke.block_timestamp DESC, ke.index_in_action_receipt DESC) AS rn
  FROM signing s
  LEFT JOIN ke ON ke.account_id = s.account_id AND ke.public_key = s.public_key AND ke.block_timestamp < s.block_timestamp
)
SELECT transaction_hash, account_id, public_key, delegated,
  CASE
    WHEN action_kind = 'ADD_KEY' AND permission_kind = 'FunctionCall' THEN IF(delegated, 'DELEGATED_INNER_FC', 'FUNCTION_CALL')
    WHEN action_kind = 'ADD_KEY' AND permission_kind = 'FullAccess' THEN IF(delegated, 'DELEGATED_INNER_FULL', 'FULL_ACCESS')
    WHEN action_kind IS NULL AND NOT delegated AND REGEXP_CONTAINS(account_id, r'^[0-9a-f]{64}$') THEN 'IMPLICIT_FULL'
    WHEN action_kind IS NULL AND delegated AND REGEXP_CONTAINS(account_id, r'^[0-9a-f]{64}$') THEN 'DELEGATED_INNER_FULL'
    ELSE 'UNKNOWN'
  END AS bucket
FROM latest
WHERE rn = 1
