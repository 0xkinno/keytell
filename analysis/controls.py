"""Controls that could break the claim (docs/METHOD.md, Controls). Reads data/out/weekly.csv and
data/out/results.json; writes data/out/controls.json and data/out/placebo.csv. No network. Seed fixed.

Each control swaps the headline series for a variant and reruns the same out-of-sample comparison
at the headline's in-sample lag:
  concentration  FC share without the top 10 function-call scopes, and without the top 10 FC signers
  relayers       FUNCTION_CALL only; every delegated transaction counted as FC; delegated excluded
  unknown keys   every UNKNOWN counted as FC; every UNKNOWN counted as full access
  episodes       weeks flagged as possible bot or farming episodes left out of the scoring
  placebo        the FC series circularly shifted by 1,000 random offsets of at least 8 weeks
"""
import json

import numpy as np
import pandas as pd

import method as M

VARIANTS = {
    "concentration_ex_top10_scopes": "share_ex_top10_scopes",
    "concentration_ex_top10_signers": "share_ex_top10_signers",
    "relayers_fc_only": "share_fc_only",
    "relayers_all_delegated_as_fc": "share_all_delegated_fc",
    "relayers_delegated_excluded": "share_excl_delegated",
    "unknown_all_fc": "share_unknown_as_fc",
    "unknown_all_full": "share_unknown_as_full",
}
PLACEBO_REPS = 1000
EPISODE_TOP_SCOPE = 0.5    # one scope carries at least half the week's sampled FC transactions
EPISODE_DAA_SPIKE = 3.0    # DAA at least 3x its trailing 8-week median


def compare(df: pd.DataFrame, k: int, rng, exclude: set | None = None) -> dict:
    base = M.one_step_errors(df, None, 0, M.OOS_START, M.OOS_END)
    e = {"ar2": base["error"].to_numpy()}
    for name in (M.HEADLINE,) + M.BASELINES:
        lag = k if name == M.HEADLINE else RES["best_in_sample_lag"][name]
        e[name] = M.one_step_errors(df, name, lag, M.OOS_START, M.OOS_END)["error"].to_numpy()
    t = pd.DataFrame(e)
    t["monday"] = base["monday"].to_numpy()
    if exclude:
        t = t[~t["monday"].isin(exclude)]
    t = t.dropna()
    sse = float((t["ar2"] ** 2).sum())
    gains = {n: 1 - float((t[n] ** 2).sum()) / sse for n in (M.HEADLINE,) + M.BASELINES}
    out = {"weeks": int(len(t)), "oos_gain_vs_ar2": gains, "comparisons": {}}
    ok = all(gains[M.HEADLINE] > gains[b] for b in M.BASELINES)
    for b in M.BASELINES:
        d = (t[M.HEADLINE] ** 2 - t[b] ** 2).to_numpy()
        lo, hi = M.block_bootstrap_mean(d, rng)
        out["comparisons"][b] = {"mean_sq_error_difference": float(d.mean()), "ci95": [lo, hi], "headline_better": bool(hi < 0)}
        ok = ok and hi < 0
    out["would_pass"] = bool(ok)
    return out


def episodes(weekly: pd.DataFrame) -> pd.DataFrame:
    w = weekly.sort_values("monday").copy()
    trailing = w["daa"].rolling(8, min_periods=4).median().shift(1)
    w["flag_top_scope"] = w["top_scope_share_of_fc"] >= EPISODE_TOP_SCOPE
    w["flag_daa_spike"] = w["daa"] >= EPISODE_DAA_SPIKE * trailing
    f = w[w["flag_top_scope"] | w["flag_daa_spike"]][["week", "monday", "top_scope_share_of_fc", "daa", "flag_top_scope", "flag_daa_spike"]]
    return f


def main():
    global RES
    RES = json.load(open("data/out/results.json"))
    weekly = pd.read_csv("data/out/weekly.csv", dtype={"monday": str})
    k = RES["best_in_sample_lag"][M.HEADLINE]
    rng = np.random.default_rng(M.SEED + 1)
    out = {"headline_lag": k, "variants": {}}

    for label, col in VARIANTS.items():
        w = weekly.copy()
        w["fc_tx_census"] = w[col] * w["census_tx"]
        out["variants"][label] = compare(M.prepare(w), k, rng)

    ep = episodes(weekly)
    ep.to_csv("data/out/episodes.csv", index=False, float_format="%.6g")
    out["variants"]["episodes_excluded"] = compare(M.prepare(weekly), k, rng, exclude=set(ep["monday"]))
    out["episodes_flagged"] = int(len(ep))

    # Placebo: circular shifts of the headline log-change series, keeping its own autocorrelation.
    df = M.prepare(weekly)
    real = out_gain = None
    base_err = M.one_step_errors(df, None, 0, M.OOS_START, M.OOS_END)["error"].to_numpy()
    def gain_of(frame):
        e = M.one_step_errors(frame, M.HEADLINE, k, M.OOS_START, M.OOS_END)["error"].to_numpy()
        m = ~(np.isnan(e) | np.isnan(base_err))
        return 1 - float((e[m] ** 2).sum()) / float((base_err[m] ** 2).sum())
    real = gain_of(df)
    col = f"_x_{M.HEADLINE}"
    series = df[col].to_numpy()
    valid = ~np.isnan(series)
    n = int(valid.sum())
    gains = []
    for _ in range(PLACEBO_REPS):
        shift = int(rng.integers(8, n - 8))
        shuffled = series.copy()
        shuffled[valid] = np.roll(series[valid], shift)
        f = df.copy()
        f[col] = shuffled
        gains.append(gain_of(f))
    gains = np.array(gains)
    pd.DataFrame({"placebo_oos_gain": gains}).to_csv("data/out/placebo.csv", index=False, float_format="%.6g")
    out["placebo"] = {
        "reps": PLACEBO_REPS, "real_oos_gain": real,
        "placebo_p95": float(np.percentile(gains, 95)),
        "share_of_placebos_beaten": float((real > gains).mean()),
        "real_beats_95pct": bool(real > np.percentile(gains, 95)),
    }
    json.dump(out, open("data/out/controls.json", "w"), indent=2, default=float)
    print(json.dumps({"placebo": out["placebo"], "would_pass": {k2: v["would_pass"] for k2, v in out["variants"].items()}}, indent=2))


if __name__ == "__main__":
    main()
