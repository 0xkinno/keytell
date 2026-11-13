"""The pre-registered test (docs/METHOD.md). Reads data/out/weekly.csv; writes data/out/results.json,
data/out/lags.csv, data/out/oos_errors.csv and data/out/directions.csv. No network. Seeds fixed.

  python analysis/method.py            the backtest (in-sample lag choice, out-of-sample test)
  python analysis/method.py --forward  per-week errors for the forward claim's periods
"""
import json
import math
import sys

import numpy as np
import pandas as pd
from scipy import stats

SEED = 20261113
LAGS = range(1, 9)
AR_ORDER = 2
BOOT_REPS = 2000
BLOCK = 4
IN_START, IN_END = "2023-10-16", "2024-12-23"      # Mondays, inclusive
OOS_START, OOS_END = "2024-12-30", "2026-11-02"   # the backtest; the forward claim starts after

FORWARD_START = "2026-11-16"
OUTCOME = "usdc_census"
CANDIDATES = {                                     # name -> weekly.csv column
    "fc_signed_tx": "fc_tx_census",
    "fc_share": "fc_share",
    "daa": "daa",
    "tx_count": "census_tx",
    "price": "price",
}
HEADLINE, BASELINES = "fc_signed_tx", ("daa", "price")
RISE_PCTL = 67                                     # "rose" = above the in-sample 67th percentile


def dlog(s: pd.Series) -> pd.Series:
    s = s.astype(float).where(s > 0)
    return np.log(s).diff()


def design(df: pd.DataFrame, x: str | None, k: int) -> pd.DataFrame:
    """Rows t with y_t, y_{t-1..AR_ORDER} and, if x is given, x_{t-k}; all in log changes."""
    out = pd.DataFrame({"monday": df["monday"], "y": df["_y"]})
    for j in range(1, AR_ORDER + 1):
        out[f"y{j}"] = df["_y"].shift(j)
    if x is not None:
        out["x"] = df[f"_x_{x}"].shift(k)
    return out


def ols_fit(d: pd.DataFrame):
    cols = [c for c in d.columns if c not in ("monday", "y")]
    X = np.column_stack([np.ones(len(d))] + [d[c].to_numpy() for c in cols])
    beta, *_ = np.linalg.lstsq(X, d["y"].to_numpy(), rcond=None)
    return cols, beta


def ols_predict(cols, beta, row) -> float:
    return float(beta[0] + sum(b * row[c] for c, b in zip(cols, beta[1:])))


def prepare(weekly: pd.DataFrame) -> pd.DataFrame:
    df = weekly.sort_values("monday").reset_index(drop=True).copy()
    # Before IN_START the outcome census lacks USDC.e (no NEP-141 events until 2023-10-11): masked,
    # so no log change is computed across the coverage break.
    df.loc[df["monday"] < IN_START, OUTCOME] = np.nan
    df["_y"] = dlog(df[OUTCOME])
    for name, col in CANDIDATES.items():
        df[f"_x_{name}"] = dlog(df[col])
    return df


def in_sample_lag(df: pd.DataFrame, name: str):
    """Best lag on the in-sample window: the largest in-sample reduction in squared error over AR(2)."""
    rows = []
    for k in LAGS:
        d_ar = design(df, None, 0)
        d_x = design(df, name, k)
        m = (df["monday"] >= IN_START) & (df["monday"] <= IN_END)
        both = d_x[m].dropna()
        ar = d_ar.loc[both.index]
        if len(both) < 20:
            rows.append({"candidate": name, "lag": k, "n": len(both), "in_gain": math.nan})
            continue
        c1, b1 = ols_fit(ar)
        c2, b2 = ols_fit(both)
        sse_ar = sum((ar.loc[i, "y"] - ols_predict(c1, b1, ar.loc[i])) ** 2 for i in ar.index)
        sse_x = sum((both.loc[i, "y"] - ols_predict(c2, b2, both.loc[i])) ** 2 for i in both.index)
        rho, _ = stats.spearmanr(both["x"], both["y"])
        rows.append({"candidate": name, "lag": k, "n": len(both), "in_gain": 1 - sse_x / sse_ar, "in_spearman": rho})
    lags = pd.DataFrame(rows)
    best = lags.dropna(subset=["in_gain"]).sort_values(["in_gain", "lag"], ascending=[False, True])
    return (int(best.iloc[0]["lag"]) if len(best) else None), lags


def one_step_errors(df: pd.DataFrame, name: str | None, k: int, start: str, end: str | None = None) -> pd.DataFrame:
    """Expanding-window one-step forecasts: for each week t in [start, end], fit on weeks from IN_START
    to t-1, forecast y_t. Returns monday, y, forecast, error."""
    d = design(df, name, k)
    out = []
    targets = df.index[(df["monday"] >= start) & ((df["monday"] <= end) if end else True)]
    for t in targets:
        train = d[(d["monday"] >= IN_START) & (d.index < t)].dropna()
        row = d.loc[t]
        if row.isna().any() or len(train) < 20:
            out.append({"monday": df.loc[t, "monday"], "y": row["y"], "forecast": math.nan, "error": math.nan})
            continue
        cols, beta = ols_fit(train)
        f = ols_predict(cols, beta, row)
        out.append({"monday": df.loc[t, "monday"], "y": row["y"], "forecast": f, "error": row["y"] - f})
    return pd.DataFrame(out)


def block_bootstrap_mean(x: np.ndarray, rng: np.random.Generator, reps=BOOT_REPS, block=BLOCK):
    x = x[~np.isnan(x)]
    n = len(x)
    if n < 2 * block:
        return (math.nan, math.nan)
    nb = math.ceil(n / block)
    means = np.empty(reps)
    for r in range(reps):
        starts = rng.integers(0, n - block + 1, nb)
        idx = np.concatenate([np.arange(s, s + block) for s in starts])[:n]
        means[r] = x[idx].mean()
    return (float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5)))


def spearman_ci(a: np.ndarray, b: np.ndarray, rng, reps=BOOT_REPS, block=BLOCK):
    m = ~(np.isnan(a) | np.isnan(b))
    a, b = a[m], b[m]
    n = len(a)
    if n < 2 * block:
        return (math.nan, math.nan, math.nan)
    rho = stats.spearmanr(a, b)[0]
    nb = math.ceil(n / block)
    rs = []
    for _ in range(reps):
        starts = rng.integers(0, n - block + 1, nb)
        idx = np.concatenate([np.arange(s, s + block) for s in starts])[:n]
        rs.append(stats.spearmanr(a[idx], b[idx])[0])
    return (float(rho), float(np.nanpercentile(rs, 2.5)), float(np.nanpercentile(rs, 97.5)))


def directions(df, name, k, errs_index):
    """Both error directions on the out-of-sample weeks, at the candidate's in-sample lag."""
    ins = df[(df["monday"] >= IN_START) & (df["monday"] <= IN_END)]
    x = df[f"_x_{name}"].shift(k)
    x_cut = np.nanpercentile(df.loc[ins.index, f"_x_{name}"], RISE_PCTL)
    y_cut = np.nanpercentile(ins["_y"], RISE_PCTL)
    rows = []
    for t in errs_index:
        xr, yr = x.loc[t], df.loc[t, "_y"]
        if np.isnan(xr) or np.isnan(yr):
            continue
        flag, rose = xr > x_cut, yr > y_cut
        kind = "hit" if flag and rose else "false_alarm" if flag else "miss" if rose else "quiet"
        rows.append({"candidate": name, "lag": k, "monday": df.loc[t, "monday"], "signal_dlog": xr, "outcome_dlog": yr, "kind": kind})
    return rows


def backtest(weekly: pd.DataFrame) -> dict:
    rng = np.random.default_rng(SEED)
    df = prepare(weekly)
    lag_tables, best = [], {}
    for name in CANDIDATES:
        k, t = in_sample_lag(df, name)
        best[name] = k
        lag_tables.append(t)
    lags = pd.concat(lag_tables, ignore_index=True)

    oos_last = min(df["monday"].max(), OOS_END)
    base = one_step_errors(df, None, 0, OOS_START, OOS_END)
    errs = {"ar2": base}
    for name, k in best.items():
        if k is not None:
            errs[name] = one_step_errors(df, name, k, OOS_START, OOS_END)
    table = pd.DataFrame({"monday": base["monday"], "y": base["y"], "e_ar2": base["error"]})
    for name in best:
        if name in errs:
            table[f"e_{name}"] = errs[name]["error"].to_numpy()
    valid = table.dropna()
    sse_ar = float((valid["e_ar2"] ** 2).sum())
    gains = {name: (1 - float((valid[f"e_{name}"] ** 2).sum()) / sse_ar) if f"e_{name}" in valid else None for name in CANDIDATES}

    comparisons = {}
    for b in BASELINES:
        d = (valid[f"e_{HEADLINE}"] ** 2 - valid[f"e_{b}"] ** 2).to_numpy()
        lo, hi = block_bootstrap_mean(d, rng)
        comparisons[b] = {"mean_sq_error_difference": float(d.mean()), "ci95": [lo, hi], "headline_better": bool(hi < 0)}
    passed = all(gains[HEADLINE] is not None and gains[b] is not None and gains[HEADLINE] > gains[b] for b in BASELINES) and all(c["headline_better"] for c in comparisons.values())

    corr = []
    for name in CANDIDATES:
        for k in LAGS:
            for window, m in (("in_sample", (df["monday"] >= IN_START) & (df["monday"] <= IN_END)), ("out_of_sample", (df["monday"] >= OOS_START) & (df["monday"] <= OOS_END))):
                a = df[f"_x_{name}"].shift(k)[m].to_numpy()
                b = df["_y"][m].to_numpy()
                rho, lo, hi = spearman_ci(a, b, rng)
                corr.append({"candidate": name, "lag": k, "window": window, "spearman": rho, "ci_lo": lo, "ci_hi": hi})

    dir_rows = []
    idx = df.index[df["monday"].isin(valid["monday"])]
    for name in (HEADLINE,) + BASELINES:
        if best.get(name):
            dir_rows += directions(df, name, best[name], idx)
    dirs = pd.DataFrame(dir_rows)

    lags.to_csv("data/out/lags.csv", index=False, float_format="%.6g")
    table.to_csv("data/out/oos_errors.csv", index=False, float_format="%.6g")
    pd.DataFrame(corr).to_csv("data/out/correlations.csv", index=False, float_format="%.6g")
    dirs.to_csv("data/out/directions.csv", index=False, float_format="%.6g")
    counts = dirs.groupby(["candidate", "kind"]).size().unstack(fill_value=0).to_dict("index") if len(dirs) else {}
    return {
        "outcome": OUTCOME,
        "headline": HEADLINE,
        "baselines": list(BASELINES),
        "in_sample": [IN_START, IN_END],
        "out_of_sample": [OOS_START, oos_last],
        "oos_weeks_scored": int(len(valid)),
        "best_in_sample_lag": best,
        "oos_gain_vs_ar2": gains,
        "comparisons": comparisons,
        "passed": bool(passed),
        "verdict": "The data supported the claim" if passed else "The data did not support the claim",
        "direction_counts": counts,
        "seed": SEED,
        "bootstrap": {"reps": BOOT_REPS, "block_weeks": BLOCK},
    }


def forward(weekly: pd.DataFrame, lags: dict) -> pd.DataFrame:
    """Absolute one-step error, in millionths of a log change, for each forward week: the values the
    crank posts as value_e6 (headline), baseline_daa_e6 and baseline_price_e6."""
    df = prepare(weekly)
    cols = {}
    for name in (HEADLINE,) + BASELINES:
        e = one_step_errors(df, name, lags[name], FORWARD_START)
        cols[name] = e
    out = pd.DataFrame({"monday": cols[HEADLINE]["monday"]})
    for name, e in cols.items():
        out[f"abs_err_e6_{name}"] = (e["error"].abs() * 1e6).round().astype("Int64")
    return out


if __name__ == "__main__":
    weekly = pd.read_csv("data/out/weekly.csv", dtype={"monday": str})
    if "--forward" in sys.argv:
        res = json.load(open("data/out/results.json"))
        forward(weekly, res["best_in_sample_lag"]).to_csv("data/out/forward_errors.csv", index=False)
        print("wrote data/out/forward_errors.csv")
    else:
        res = backtest(weekly)
        json.dump(res, open("data/out/results.json", "w"), indent=2, default=float)
        print(json.dumps({k: res[k] for k in ("best_in_sample_lag", "oos_gain_vs_ar2", "comparisons", "verdict", "oos_weeks_scored")}, indent=2, default=float))
