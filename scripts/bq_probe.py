"""Platform probe for BigQuery: schema, date range, signer key column, ADD_KEY argument shape.
Writes data/probe/*.json. Needs GOOGLE_APPLICATION_CREDENTIALS and BQ_PROJECT."""
import json, os, sys
from google.cloud import bigquery

DS = "bigquery-public-data.crypto_near_mainnet_us"
client = bigquery.Client(project=os.environ["BQ_PROJECT"])
os.makedirs("data/probe", exist_ok=True)

def run(name, sql, cap_gb=20):
    dry = client.query(sql, job_config=bigquery.QueryJobConfig(dry_run=True, use_query_cache=False))
    gb = dry.total_bytes_processed / 1e9
    print(f"{name}: dry run {gb:.3f} GB", flush=True)
    if gb > cap_gb:
        raise SystemExit(f"{name} would scan {gb:.1f} GB, above the {cap_gb} GB cap")
    rows = [dict(r) for r in client.query(sql).result()]
    out = {"query": sql, "bytes_scanned_dry_run": dry.total_bytes_processed, "rows": rows}
    json.dump(out, open(f"data/probe/{name}.json", "w"), indent=2, default=str)
    return rows

if __name__ == "__main__":
    which = sys.argv[1:] or ["tables", "columns"]
    if "tables" in which:
        run("tables", f"SELECT table_name, table_type FROM `{DS}.INFORMATION_SCHEMA.TABLES` ORDER BY table_name")
    if "columns" in which:
        run("columns", f"SELECT table_name, column_name, data_type FROM `{DS}.INFORMATION_SCHEMA.COLUMNS` ORDER BY table_name, ordinal_position")
    if "range" in which:
        # Partition metadata, not a table scan: first and last day each table holds.
        run("date_range", f"SELECT table_name, MIN(partition_id) AS first_day, MAX(partition_id) AS last_day, COUNT(*) AS days, SUM(total_rows) AS total_rows FROM `{DS}.INFORMATION_SCHEMA.PARTITIONS` WHERE partition_id NOT IN ('__NULL__', '__UNPARTITIONED__') GROUP BY table_name ORDER BY table_name")
    if "addkey" in which:
        run("add_key_sample", f"SELECT block_timestamp, signer_account_id, receipt_receiver_account_id, action_kind, is_delegate_action, args FROM `{DS}.receipt_actions` WHERE block_date = '2025-01-15' AND action_kind = 'ADD_KEY' LIMIT 5")
        run("delete_key_sample", f"SELECT block_timestamp, receipt_receiver_account_id, action_kind, args FROM `{DS}.receipt_actions` WHERE block_date = '2025-01-15' AND action_kind = 'DELETE_KEY' LIMIT 3")
    if "kinds" in which:
        run("action_kinds", f"SELECT action_kind, is_delegate_action, COUNT(*) AS n FROM `{DS}.receipt_actions` WHERE block_date = '2025-01-15' GROUP BY 1, 2 ORDER BY n DESC")
        run("tx_sample", f"SELECT transaction_hash, signer_account_id, signer_public_key, receiver_account_id, status FROM `{DS}.transactions` WHERE block_date = '2025-01-15' LIMIT 3")
        run("ft_sample", f"SELECT contract_account_id, affected_account_id, involved_account_id, delta_amount, cause, status, standard FROM `{DS}.ft_events` WHERE block_date = '2025-01-15' AND contract_account_id = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1' LIMIT 4")
    if "shapes" in which:
        run("add_key_function_call_sample", f"SELECT block_timestamp, receipt_receiver_account_id, args FROM `{DS}.receipt_actions` WHERE block_date = '2024-06-05' AND action_kind = 'ADD_KEY' AND args NOT LIKE '%FullAccess%' LIMIT 3")
        run("delegate_action_sample", f"SELECT transaction_hash, signer_account_id, signer_public_key, receiver_account_id, args FROM `{DS}.transaction_actions` WHERE block_date = '2024-06-05' AND action_kind = 'DELEGATE_ACTION' LIMIT 2")
