"""NEAR Intents weekly volume: an exploratory secondary outcome.

Not part of the registered test: the Intents Explorer key arrived after the claim was registered, so
nothing here can change the verdict. It answers two questions, with the same transforms the method uses
(weekly log changes) and each signal at the lag registered on in-sample weeks (data/out/results.json):
  1. Does sampled Intents volume move with the registered outcome, BigQuery USDC volume?
  2. How does each candidate signal, at its registered lag, rank-correlate with Intents volume?
Intervals: moving-block bootstrap (block 4, 2,000 resamples, seed 20261116).
Writes data/out/intents_exploratory.json.
"""
import json

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

BLOCK, REPS, SEED = 4, 2000, 20261116


def boot_spearman(x, y):
    x, y = np.asarray(x), np.asarray(y)
    n = len(x)
    rng = np.random.default_rng(SEED)
    stats = []
    for _ in range(REPS):
        starts = rng.integers(0, n - BLOCK + 1, size=int(np.ceil(n / BLOCK)))
        idx = np.concatenate([np.arange(s, s + BLOCK) for s in starts])[:n]
        r = spearmanr(x[idx], y[idx]).statistic
        if np.isfinite(r):
            stats.append(r)
    lo, hi = np.percentile(stats, [2.5, 97.5])
    return float(spearmanr(x, y).statistic), float(lo), float(hi)


def main():
    w = pd.read_csv("data/out/weekly.csv")
    it = pd.read_csv("data/raw/intents_weekly.csv")
    res = json.load(open("data/out/results.json"))
    lags = res["best_in_sample_lag"]
    w = w.set_index("monday").sort_index()
    it = it.set_index("monday").sort_index()
    df = w.join(it[["est_usd", "est_usd_lo", "est_usd_hi", "est_tx"]], how="left")
    lc = lambda s: np.log(s.where(s > 0)).diff()
    out = {"note": "Exploratory secondary outcome, not part of the registered test; cannot change the verdict.",
           "weeks": int(it.shape[0]), "first_week": it.week.iloc[0], "last_week": it.week.iloc[-1],
           "median_weekly_usd": float(it.est_usd.median()), "latest_week": it.week.iloc[-1], "latest_usd": float(it.est_usd.iloc[-1]),
           "latest_usd_lo": float(it.est_usd_lo.iloc[-1]), "latest_usd_hi": float(it.est_usd_hi.iloc[-1])}
    y = lc(df["est_usd"])
    usdc = lc(df["usdc_census"])
    m = pd.concat([y, usdc], axis=1).dropna()
    r, lo, hi = boot_spearman(m.iloc[:, 0], m.iloc[:, 1])
    out["with_usdc_census"] = {"spearman": r, "ci95": [lo, hi], "weeks": len(m)}
    cand = {"fc_signed_tx": "fc_tx_census", "daa": "daa", "price": "price", "tx_count": "census_tx"}
    out["signals"] = {}
    for name, col in cand.items():
        k = int(lags[name])
        x = lc(df[col]).shift(k)
        mm = pd.concat([x, y], axis=1).dropna()
        if len(mm) < 12:
            continue
        r, lo, hi = boot_spearman(mm.iloc[:, 0], mm.iloc[:, 1])
        out["signals"][name] = {"lag": k, "spearman": r, "ci95": [lo, hi], "weeks": len(mm)}
    json.dump(out, open("data/out/intents_exploratory.json", "w"), indent=2)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
