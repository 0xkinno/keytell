"""Runs the classification logic of sql/02 on the shared fixtures (scripts/fixtures/keys.json) as
BigQuery WITH tables: the real tx, del and ke CTEs are swapped for literal rows, the rest of the file
runs unchanged. Literal tables scan 0 bytes. Runs only when BQ_TEST=1 and credentials exist."""
import json, os, sys

if os.environ.get("BQ_TEST") != "1":
    print("skip sql fixture test: set BQ_TEST=1 with BigQuery credentials to run it")
    sys.exit(0)
from google.cloud import bigquery

fx = json.load(open("scripts/fixtures/keys.json"))
q = lambda s: "NULL" if s is None else "'" + str(s).replace("'", "\\'") + "'"
tx = " UNION ALL ".join(
    f"SELECT {q(t['hash'])} AS transaction_hash, {q(t['signer'])} AS signer_account_id, {q(t['publicKey'])} AS signer_public_key, {t['ts']} AS block_timestamp"
    for t in fx["transactions"])
dl = [t for t in fx["transactions"] if t.get("delegate")]
dele = " UNION ALL ".join(
    f"SELECT {q(t['hash'])} AS transaction_hash, {q(t['delegate']['sender'])} AS inner_signer, {q(t['delegate']['publicKey'])} AS inner_public_key" for t in dl)
ke = " UNION ALL ".join(
    f"SELECT {q(e['account'])} AS account_id, {q(e['publicKey'])} AS public_key, {q(e['kind'])} AS action_kind, {q(e.get('permission'))} AS permission_kind, {e['ts']} AS block_timestamp, {e['idx']} AS index_in_action_receipt"
    for e in fx["key_events"])
body = open("sql/02_tx_classified.sql").read().split("signing AS (", 1)[1]
sql = f"WITH tx AS ({tx}),\ndel AS ({dele}),\nke AS ({ke}),\nsigning AS (" + body
client = bigquery.Client(project=os.environ["BQ_PROJECT"])
got = {r["transaction_hash"]: r["bucket"] for r in client.query(sql).result()}
bad = 0
for t in fx["transactions"]:
    ok = got.get(t["hash"]) == t["expect"]
    bad += not ok
    print(f"{'PASS' if ok else 'FAIL'} {t['hash']} {t['case']}: sql {got.get(t['hash'])}, expected {t['expect']}")
print(f"{len(fx['transactions']) - bad} of {len(fx['transactions'])} fixtures agree between sql/02 and the expected buckets")
sys.exit(1 if bad else 0)
