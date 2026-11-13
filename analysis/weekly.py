"""Builds the weekly series from committed inputs only. No network.

Inputs
  data/raw/sample/<week>.blocks.csv, <week>.txs.csv, <week>.meta.json   (scripts/sample-chain.ts)
  data/raw/price.csv                                                    (scripts/fetch-price.ts)
  data/out/bq_daily.csv, optional                                       (sql/04_daa.sql via scripts/bq.py)

Outputs
  data/out/weekly.csv        one row per ISO week: estimates, shares, intervals, sources
  data/out/fc_receivers.csv  contracts that function-call keys were scoped to, by sampled count
"""
import glob
import json
import math
import os

import numpy as np
import pandas as pd

RAW = "data/raw/sample"
OUT = "data/out"
FC_BUCKETS = {"FUNCTION_CALL", "DELEGATED_INNER_FC"}
BUCKETS = ["FUNCTION_CALL", "FULL_ACCESS", "IMPLICIT_FULL", "DELEGATED_INNER_FC", "DELEGATED_INNER_FULL", "UNKNOWN"]


def wilson(k: int, n: int, z: float = 1.96):
    if n == 0:
        return (math.nan, math.nan)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def load_weeks():
    metas = sorted(glob.glob(f"{RAW}/*.meta.json"))
    rows, txs_all = [], []
    for mp in metas:
        m = json.load(open(mp))
        w = m["week"]
        b = pd.read_csv(f"{RAW}/{w}.blocks.csv")
        t = pd.read_csv(f"{RAW}/{w}.txs.csv", dtype=str, keep_default_na=False)
        H, n = m["heights_in_week"], len(b)
        scale = H / n
        counts = t["bucket"].value_counts().to_dict()
        k_fc = sum(counts.get(x, 0) for x in FC_BUCKETS)
        nt = len(t)
        lo, hi = wilson(k_fc, nt)
        tx_est = scale * b["n_tx"].sum()
        row = {
            "week": w,
            "monday": m["monday"],
            "heights_in_week": H,
            "blocks_sampled": n,
            "blocks_present": int(b["exists"].sum()),
            "txs_in_sampled_blocks": int(b["n_tx"].sum()),
            "txs_classified": nt,
            "tx_count": tx_est,
            "usdc_volume": scale * b["usdc_volume_e6"].astype(float).sum() / 1e6,
            "usdc_native_volume": scale * b["usdc_native_e6"].astype(float).sum() / 1e6,
            "usdc_transfers": scale * b["usdc_transfers"].sum(),
            "deploys": scale * b["deploys"].sum(),
            "fc_share": k_fc / nt if nt else math.nan,
            "fc_share_lo": lo,
            "fc_share_hi": hi,
            "fc_tx": (k_fc / nt) * tx_est if nt else math.nan,
            "fc_only_share": counts.get("FUNCTION_CALL", 0) / nt if nt else math.nan,
            "unknown_share": counts.get("UNKNOWN", 0) / nt if nt else math.nan,
            "archival_lookups": m.get("archival_lookups"),
            "distinct_signers_classified": t["signer"].nunique() if nt else 0,
        }
        for bk in BUCKETS:
            row[f"n_{bk.lower()}"] = counts.get(bk, 0)
        rows.append(row)
        t = t.assign(week=w)
        txs_all.append(t)
    weekly = pd.DataFrame(rows).sort_values("monday").reset_index(drop=True)
    txs = pd.concat(txs_all, ignore_index=True) if txs_all else pd.DataFrame()
    return weekly, txs


def add_price(weekly: pd.DataFrame) -> pd.DataFrame:
    p = pd.read_csv("data/raw/price.csv", parse_dates=["date"])
    p["monday"] = (p["date"] - pd.to_timedelta(p["date"].dt.weekday, unit="D")).dt.strftime("%Y-%m-%d")
    wk = p.groupby("monday")["price_usd"].mean().rename("price").reset_index()
    return weekly.merge(wk, on="monday", how="left")


def _monday(d: pd.Series) -> pd.Series:
    return (d - pd.to_timedelta(d.dt.weekday, unit="D")).dt.strftime("%Y-%m-%d")


def add_census(weekly: pd.DataFrame) -> pd.DataFrame:
    """Census series from BigQuery outputs committed in data/out (sql/04 and sql/05).
    A week counts only when all seven days are present; otherwise it is a gap, not a value."""
    daa_files = sorted(glob.glob(f"{OUT}/bq_daa_*.csv"))
    usdc_files = sorted(glob.glob(f"{OUT}/bq_usdc_*.csv"))
    if daa_files:
        d = pd.concat([pd.read_csv(f, parse_dates=["block_date"]) for f in daa_files]).drop_duplicates("block_date")
        d["monday"] = _monday(d["block_date"])
        g = d.groupby("monday").agg(daa=("active_accounts", "mean"), census_tx=("transactions", "sum"), census_days=("block_date", "count")).reset_index()
        g.loc[g["census_days"] < 7, ["daa", "census_tx"]] = np.nan
        weekly = weekly.merge(g, on="monday", how="left")
    else:
        weekly["daa"] = np.nan
        weekly["census_tx"] = np.nan
    if usdc_files:
        u = pd.concat([pd.read_csv(f, parse_dates=["block_date"]) for f in usdc_files]).drop_duplicates(["block_date", "contract_account_id"])
        u["monday"] = _monday(u["block_date"])
        native = u["contract_account_id"].str.startswith("17208628")
        u["usdc_native"] = np.where(native, u["usdc"], 0.0)
        g = u.groupby("monday").agg(usdc_census=("usdc", "sum"), usdc_census_native=("usdc_native", "sum"), usdc_census_transfers=("transfers", "sum")).reset_index()
        weekly = weekly.merge(g, on="monday", how="left")
        # A week with no USDC events in a covered range is a real zero.
        covered = weekly["census_tx"].notna()
        for c in ["usdc_census", "usdc_census_native", "usdc_census_transfers"]:
            weekly.loc[covered & weekly[c].isna(), c] = 0.0
    else:
        weekly["usdc_census"] = np.nan
    # The headline FC series: sampled share times the census transaction count.
    weekly["fc_tx_census"] = weekly["fc_share"] * weekly["census_tx"]
    weekly["census_source"] = np.where(weekly["census_tx"].notna(), "BigQuery crypto_near_mainnet_us", "gap")
    return weekly


def fc_receivers(txs: pd.DataFrame) -> pd.DataFrame:
    if txs.empty:
        return pd.DataFrame(columns=["fc_receiver", "sampled_fc_txs", "share_of_fc", "weeks_seen"])
    fc = txs[txs["bucket"].isin(FC_BUCKETS)].copy()
    fc["scope"] = np.where(fc["bucket"] == "DELEGATED_INNER_FC", fc["del_fc_receiver"], fc["fc_receiver"])
    g = fc.groupby("scope").agg(sampled_fc_txs=("hash", "count"), weeks_seen=("week", "nunique")).reset_index()
    g = g.rename(columns={"scope": "fc_receiver"}).sort_values("sampled_fc_txs", ascending=False)
    g["share_of_fc"] = g["sampled_fc_txs"] / g["sampled_fc_txs"].sum()
    return g


IN_START, IN_END = "2023-10-16", "2024-12-23"


def fc_scope(t: pd.DataFrame) -> pd.Series:
    return pd.Series(np.where(t["bucket"] == "DELEGATED_INNER_FC", t["del_fc_receiver"], t["fc_receiver"]), index=t.index)


def variants(txs: pd.DataFrame, weekly: pd.DataFrame) -> pd.DataFrame:
    """Per-week FC shares under the pre-registered controls (docs/METHOD.md, Controls)."""
    if txs.empty:
        return weekly
    t = txs.merge(weekly[["week", "monday"]], on="week", how="left")
    t["scope"] = fc_scope(t)
    is_fc = t["bucket"].isin(FC_BUCKETS)
    ins = (t["monday"] >= IN_START) & (t["monday"] <= IN_END)
    top_scopes = t[is_fc & ins]["scope"].value_counts().head(10).index.tolist()
    top_signers = t[is_fc & ins]["signer"].value_counts().head(10).index.tolist()
    deleg = t["bucket"].str.startswith("DELEGATED")
    unk = t["bucket"] == "UNKNOWN"

    def share(num_mask, den_mask=None):
        den = den_mask if den_mask is not None else pd.Series(True, index=t.index)
        g = pd.DataFrame({"week": t["week"], "num": num_mask & den, "den": den}).groupby("week").sum()
        return (g["num"] / g["den"].where(g["den"] > 0)).rename(None)

    v = pd.DataFrame({
        "share_fc_only": share(t["bucket"] == "FUNCTION_CALL"),
        "share_all_delegated_fc": share(is_fc | deleg),
        "share_excl_delegated": share(t["bucket"] == "FUNCTION_CALL", ~deleg),
        "share_unknown_as_fc": share(is_fc | unk),
        "share_unknown_as_full": share(is_fc),
        "share_ex_top10_scopes": share(is_fc & ~t["scope"].isin(top_scopes), ~(is_fc & t["scope"].isin(top_scopes))),
        "share_ex_top10_signers": share(is_fc & ~t["signer"].isin(top_signers), ~(is_fc & t["signer"].isin(top_signers))),
    })
    top1 = t[is_fc].groupby("week")["scope"].agg(lambda s: s.value_counts(normalize=True).iloc[0] if len(s) else np.nan).rename("top_scope_share_of_fc")
    v = v.join(top1).reset_index().rename(columns={"index": "week"})
    json.dump({"top10_fc_scopes_in_sample": top_scopes, "top10_fc_signers_in_sample": top_signers}, open(f"{OUT}/concentration_top10.json", "w"), indent=2)
    return weekly.merge(v, on="week", how="left")


def main():
    os.makedirs(OUT, exist_ok=True)
    weekly, txs = load_weeks()
    weekly = add_price(weekly)
    weekly = add_census(weekly)
    weekly = variants(txs, weekly)
    weekly.to_csv(f"{OUT}/weekly.csv", index=False, float_format="%.6g")
    fc_receivers(txs).to_csv(f"{OUT}/fc_receivers.csv", index=False, float_format="%.6g")
    print(f"weekly.csv: {len(weekly)} weeks, {weekly['monday'].min()} to {weekly['monday'].max()}")


if __name__ == "__main__":
    main()
