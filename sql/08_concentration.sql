-- 08_concentration.sql
-- Purpose: concentration of function-call activity: share of FC-signed transactions per receiver
--          contract the key was scoped to, per week, from sql/02 joined to key scope.
-- Tables: `keytell.tx_classified` (sql/02) and `keytell.key_events` (sql/01).
-- Dry-run bytes: depends on sql/01 and sql/02; NOT RUN in this build. analysis/weekly.py computes the
--          same concentration from the block sample (fc_receivers.csv, concentration_top10.json).
SELECT DATE_TRUNC(t.block_date, ISOWEEK) AS week_monday, k.fc_receiver_id, COUNT(*) AS fc_transactions
FROM `keytell.tx_classified` t
JOIN `keytell.key_events` k ON k.account_id = t.account_id AND k.public_key = t.public_key AND k.action_kind = 'ADD_KEY'
WHERE t.bucket IN ('FUNCTION_CALL', 'DELEGATED_INNER_FC') AND t.block_date BETWEEN @start AND @end
GROUP BY week_monday, k.fc_receiver_id
ORDER BY week_monday, fc_transactions DESC
