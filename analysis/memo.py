"""Writes the one-page investment memo for the analyst from docs/FACTS.json only: data/out/memo.md.
Every number carries a link to the file or query it came from. No network.
"""
import json

REPO = "https://github.com/0xkinno/keytell/blob/main"


def pct(x, d=1):
    return "n/a" if x is None else f"{x * 100:.{d}f}%"


def link(text, path):
    return f"[{text}]({REPO}/{path})"


def main():
    f = json.load(open("docs/FACTS.json"))
    c, b, ctl, lat, d = f.get("claim"), f.get("backtest"), f.get("controls"), f.get("latest"), f["data"]
    L = []
    L.append("# Investment memo: is NEAR usage real?")
    L.append("")
    L.append("Prepared with Keytell for an investment committee. Analyst: Tolu Adeyemi (fictional). Not investment advice.")
    L.append("")
    L.append("## The question")
    L.append("Is anyone actually using NEAR, or is it bots and airdrop farmers? Daily active accounts and price are cheap to fake, so this memo tests a signal that is harder to fake: transactions signed by function-call keys, the scoped keys apps and agents use.")
    L.append("")
    L.append("## The claim, fixed before the data")
    if c:
        L.append(f"> {c['statement']}")
        L.append("")
        L.append(f"Registered on NEAR testnet at {c['registered_at']} in `{c['ledger']}` (claim `{c['id']}`), before any out-of-sample query ran: [registration transaction](https://testnet.nearblocks.io/txns/{c['registration_tx']}). Method hash `{c['method_sha256'][:16]}...` ({link('docs/METHOD.md', 'docs/METHOD.md')}), code manifest hash `{c['sql_sha256'][:16]}...`. Both match the repository: {'yes' if c['method_sha256_matches_repo'] and c['sql_sha256_matches_repo'] else 'no'}.")
    L.append("")
    passed = bool(b and b.get("passed"))
    L.append("## Evidence for" if passed else "## What the test found")
    if b:
        g = b["oos_gain"]
        L.append(f"- Backtest verdict: **{b['verdict']}** ({link('results.json', 'data/out/results.json')}).")
        L.append(f"- Out-of-sample gain in forecasting weekly USDC volume over {b['oos_weeks_scored']} weeks, against an AR(2) baseline (positive means a smaller error than the baseline, negative a larger one): function-call-signed activity {pct(g.get('fc_signed_tx'))}, daily active accounts {pct(g.get('daa'))}, price {pct(g.get('price'))} ({link('oos_errors.csv', 'data/out/oos_errors.csv')}).")
        L.append(f"- Mean squared-error difference against DAA {b['vs_daa']['mean_sq_error_difference']} (95% interval {b['vs_daa']['ci95'][0]} to {b['vs_daa']['ci95'][1]}); against price {b['vs_price']['mean_sq_error_difference']} ({b['vs_price']['ci95'][0]} to {b['vs_price']['ci95'][1]}). Negative favours function-call keys.")
    if lat:
        L.append(f"- In {lat['week']}, {pct(lat['fc_share'])} of sampled mainnet transactions were signed by a function-call key (interval {pct(lat['fc_share_lo'])} to {pct(lat['fc_share_hi'])}) ({link('weekly.csv', 'data/out/weekly.csv')}).")
    L.append("")
    L.append("## Evidence against" if passed else "## The controls")
    if ctl:
        names = [k for k, v in ctl["variants"].items() if v["would_pass"]]
        verb = "would still pass" if passed else "would pass"
        which = f": {', '.join(n.replace('_', ' ') for n in names)}" if names else ""
        note = "" if passed or not names else " These are registered controls, not the headline, so they do not change the verdict."
        L.append(f"- {len(names)} of {len(ctl['variants'])} control reruns {verb} the registered rule{which} ({link('controls.json', 'data/out/controls.json')}).{note}")
        L.append(f"- Timing placebo: the real gain beats {pct(ctl['placebo']['share_beaten'], 0)} of {ctl['placebo']['reps']} shifted placebos; the bar is 95% ({link('placebo.csv', 'data/out/placebo.csv')}).")
    L.append(f"- Concentration: the ten most common function-call scopes carry {pct(f['concentration']['top10_share_of_sampled_fc_all_weeks'])} of sampled function-call transactions ({link('fc_receivers.csv', 'data/out/fc_receivers.csv')}).")
    if b:
        dd = b["directions"]["fc_signed_tx"]
        L.append(f"- Errors in both directions, out of sample: {dd['false_alarms']} false alarms and {dd['misses']} misses against {dd['hits']} hits ({link('directions.csv', 'data/out/directions.csv')}).")
    L.append(f"- The key mix is a sample ({d['transactions_classified']} transactions classified), not a census; USDC volume before 2023-10-16 is not in the census.")
    L.append("")
    L.append("## What would change this conclusion")
    if passed:
        L.append("- The forward claim on chain failing: fewer than half of the 12 forward weeks won, resolved by anyone after the window.")
        L.append("- A control that breaks the result when rerun on new weeks: concentration, relayer treatment, unknown keys, or placebo.")
        L.append("- DAA or price forecasting USDC volume as well as function-call activity over the same weeks.")
    else:
        L.append("- The forward claim on chain succeeding: at least half of the 12 forward weeks won, resolved by anyone after the window. That is new evidence, not a rerun of these weeks.")
        L.append("- A new pre-registered claim, written down before its data, that holds out of sample. Picking a passing control after the fact would not count.")
        L.append("- The weekly USDC census proving wrong or incomplete in a way that changes the out-of-sample errors.")
    L.append("")
    L.append("## Rebuild it")
    L.append(f"`git clone https://github.com/0xkinno/keytell && cd keytell && make verify` recomputes every number here from committed outputs and checks the hashes posted on chain. A full census rebuild scans {f['cost']['rebuild_gb']} GB on BigQuery ({link('bq_runs.jsonl', 'data/out/bq_runs.jsonl')}).")
    L.append("")
    L.append("## Analyst attestation")
    L.append("I have read the evidence against as well as the evidence for, and the decision is mine. Signature below (NEP-413).")
    open("data/out/memo.md", "w").write("\n".join(L) + "\n")
    print("wrote data/out/memo.md")


if __name__ == "__main__":
    main()
