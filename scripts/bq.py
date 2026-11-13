"""Runs one committed SQL file on BigQuery behind a dry-run gate and a byte cap.

  python scripts/bq.py sql/04_daa.sql --start 2022-01-03 --end 2024-12-29 --out data/out/bq_daa_in.csv

Every run first dry-runs the query and refuses if it would scan more than --cap-gb (default 120).
It writes the CSV, and appends one line to data/out/bq_runs.jsonl: file, sha256 of the SQL, range,
dry-run bytes, bytes billed, the output's sha256 and row count, and when it ran. Needs
GOOGLE_APPLICATION_CREDENTIALS (a service account with BigQuery Job User) and BQ_PROJECT.
"""
import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import sys

from google.cloud import bigquery

ON_DEMAND_USD_PER_TIB = 6.25  # published BigQuery on-demand price; the first 1 TiB each month is free


def sha256_file(p: str) -> str:
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sql")
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cap-gb", type=float, default=120)
    ap.add_argument("--dry", action="store_true", help="dry run only")
    a = ap.parse_args()

    sql = open(a.sql).read()
    params = [
        bigquery.ScalarQueryParameter("start", "DATE", a.start),
        bigquery.ScalarQueryParameter("end", "DATE", a.end),
    ]
    client = bigquery.Client(project=os.environ["BQ_PROJECT"])
    dry = client.query(sql, job_config=bigquery.QueryJobConfig(dry_run=True, use_query_cache=False, query_parameters=params))
    gb = dry.total_bytes_processed / 1e9
    print(f"{a.sql} {a.start}..{a.end}: dry run {gb:.2f} GB", flush=True)
    if a.dry:
        return
    if gb > a.cap_gb:
        sys.exit(f"refused: {gb:.1f} GB is above the {a.cap_gb} GB cap")
    job = client.query(sql, job_config=bigquery.QueryJobConfig(query_parameters=params))
    rows = list(job.result())
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", newline="") as f:
        w = csv.writer(f)
        if rows:
            w.writerow(rows[0].keys())
            for r in rows:
                w.writerow([v.isoformat() if hasattr(v, "isoformat") else v for v in r.values()])
    billed = job.total_bytes_billed or 0
    rec = {
        "sql": a.sql, "sql_sha256": hashlib.sha256(sql.encode()).hexdigest(), "start": a.start, "end": a.end,
        "dry_run_bytes": dry.total_bytes_processed, "bytes_billed": billed,
        "usd_at_on_demand_price": round(billed / 2**40 * ON_DEMAND_USD_PER_TIB, 4),
        "out": a.out, "out_sha256": sha256_file(a.out), "rows": len(rows),
        "job_id": job.job_id, "ran_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }
    with open("data/out/bq_runs.jsonl", "a") as f:
        f.write(json.dumps(rec) + "\n")
    print(f"wrote {a.out}: {len(rows)} rows, billed {billed/1e9:.2f} GB")


if __name__ == "__main__":
    main()
