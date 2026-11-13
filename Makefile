# Keytell: one-command rebuild and verification.
#   make setup     install the pinned Python and Node toolchain (once)
#   make verify    rerun the analysis from committed data, fail on any drift, then check the chain (no keys)
#   make rebuild   rerun the BigQuery census if credentials exist (else reuse committed data/out), then analyze
#   make analyze   weekly series -> pre-registered test -> controls -> memo -> FACTS
#   make sample    rerun the keyless block sample for weeks FROM..TO (Mondays), no account needed
#   make forward   refresh the forward weeks (sample + census + errors) for the crank
#   make test      contract unit, property and sandbox tests; classifier twin tests
PY ?= .venv/bin/python
FROM ?= 2025-01-06
TO ?= 2025-01-06
SAMPLE_OUT ?= data/raw/sample
BQ = GOOGLE_APPLICATION_CREDENTIALS=$${GOOGLE_APPLICATION_CREDENTIALS} $(PY) -I scripts/bq.py

.PHONY: setup verify rebuild analyze sample forward test charts census

setup:
	python3 -m venv .venv && $(PY) -m pip install -q -r analysis/requirements.txt
	npm ci

analyze:
	$(PY) analysis/weekly.py
	$(PY) analysis/method.py
	$(PY) analysis/controls.py
	npx tsx scripts/facts.ts
	$(PY) analysis/memo.py
	npx tsx scripts/facts.ts
	$(PY) analysis/findings.py
	npx tsx scripts/readme.ts
	npx tsx scripts/readme.ts --tpl docs/SUBMISSION.template.md --out SUBMISSION_NEARHACKATHON.md

charts: analyze

verify: analyze
	@# CSVs are written at 6 significant digits and FACTS.json is rounded, so last-bit float noise
	@# between machines cannot flip the check; raw JSON floats are compared through FACTS.json.
	@git diff --quiet -- 'data/out/*.csv' docs/FACTS.json data/out/memo.md docs/FINDINGS.md README.md || (echo "FAIL drift: the rebuild changed committed outputs:"; git diff --stat -- 'data/out/*.csv' docs/FACTS.json data/out/memo.md docs/FINDINGS.md README.md; exit 1)
	@echo "PASS rebuild: data/out CSVs, the memo, FINDINGS, README and docs/FACTS.json reproduce exactly from committed inputs"
	npx tsx scripts/facts.ts --check
	npx tsx scripts/verify.ts

census:
	@if [ -z "$$GOOGLE_APPLICATION_CREDENTIALS" ] || [ -z "$$BQ_PROJECT" ]; then \
	  echo "No BigQuery credentials (GOOGLE_APPLICATION_CREDENTIALS, BQ_PROJECT): reusing committed data/out/bq_*.csv"; \
	else \
	  $(BQ) sql/05_usdc_volume.sql --start 2022-01-03 --end 2024-12-29 --out data/out/bq_usdc_in.csv && \
	  $(BQ) sql/04_daa.sql --start 2022-01-03 --end 2024-12-29 --out data/out/bq_daa_in.csv && \
	  $(BQ) sql/05_usdc_volume.sql --start 2024-12-30 --end 2026-11-08 --out data/out/bq_usdc_oos.csv && \
	  $(BQ) sql/04_daa.sql --start 2024-12-30 --end 2026-11-08 --out data/out/bq_daa_oos.csv; \
	fi

rebuild: census analyze

sample:
	npx tsx scripts/sample-chain.ts --from $(FROM) --to $(TO) --blocks 60 --txs 200 --out $(SAMPLE_OUT)

forward:
	@monday=$$(python3 -c "import datetime as d;t=d.date.today();m=t-d.timedelta(days=t.weekday()+7);print(m)"); \
	echo "forward: sampling and census through the week of $$monday"; \
	npx tsx scripts/sample-chain.ts --from 2026-11-09 --to $$monday --blocks 60 --txs 200 --out data/raw/sample; \
	if [ -n "$$BQ_PROJECT" ]; then \
	  end=$$(python3 -c "import datetime as d;print(d.date.fromisoformat('$$monday')+d.timedelta(days=6))"); \
	  $(BQ) sql/05_usdc_volume.sql --start 2026-11-09 --end $$end --out data/out/bq_usdc_fwd.csv && \
	  $(BQ) sql/04_daa.sql --start 2026-11-09 --end $$end --out data/out/bq_daa_fwd.csv; \
	fi; \
	$(PY) analysis/weekly.py && $(PY) analysis/method.py --forward

test:
	cargo test --profile proptest -p thesis_ledger --lib
	LD_PRELOAD=$$PWD/fleet/shim/libfdlimit.so cargo test -p thesis_ledger --test sandbox
	npx tsx --test scripts/classify.test.ts
	BQ_TEST=$${BQ_TEST:-0} $(PY) -I scripts/sql_fixture_test.py
