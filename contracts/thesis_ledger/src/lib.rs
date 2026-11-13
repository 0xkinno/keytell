//! Thesis ledger: the Keytell pre-registration contract.
//!
//! The publisher registers a claim before its test window opens: the statement, the metric and
//! outcome definitions, the comparator and threshold, and the SHA-256 of the method document and of
//! the exact SQL and sampler code. After that nobody can change any of it: there is no edit method,
//! no upgrade method and, once the deployer key is deleted, no key on this account at all.
//!
//! A crank, holding a function-call key limited to `post`, posts one observation per weekly period
//! once that period has ended: the claim's metric error, the two baseline errors, the SHA-256 of the
//! query output the numbers came from, and the bytes the query scanned. Periods only move forward.
//!
//! After the window ends anyone may call `resolve`. The contract counts the periods in which the
//! claim's metric beat both baselines and compares that share with the registered threshold. The
//! status is set once and the claim freezes.
//!
//! The contract trusts the crank's numbers. Trust in those numbers comes from `make verify`, which
//! recomputes every posted value from public data and compares the hashes, not from this contract.

pub mod events;

#[cfg(test)]
mod tests;

use near_sdk::json_types::{I64, U64};
use near_sdk::serde_json::json;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise};

pub const NS: u64 = 1_000_000_000;
pub const WEEK_SECS: u64 = 604_800;
pub const MAX_PERIODS: u32 = 104;
/// Storage prepaid at registration for each period the crank may post (an observation is about 250 bytes).
pub const OBS_STORAGE: NearToken = NearToken::from_micronear(3_000);
/// After the window ends, the crank has this long to post its last periods. A claim that still has
/// too few periods after the grace resolves as Failed, so a silent crank cannot keep a claim open.
pub const LAPSE_GRACE_SECS: u64 = 30 * 86_400;
pub const E6: i128 = 1_000_000;

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Comparator {
    /// Lower is better: a period counts as a win when `value_e6` is strictly below both baselines.
    LowerBeatsBothShare,
    /// Higher is better: a period counts as a win when `value_e6` is strictly above both baselines.
    HigherBeatsBothShare,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Open,
    Passed,
    Failed,
}

/// What the publisher sends to `register`.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ClaimInput {
    pub id: String,
    pub statement: String,
    pub metric: String,
    pub outcome: String,
    pub comparator: Comparator,
    /// Share of posted periods that must be wins, in millionths (600000 = 60 percent).
    pub threshold_e6: U64,
    pub window_start_ns: U64,
    pub window_end_ns: U64,
    pub period_secs: U64,
    pub min_periods: u32,
    pub method_sha256: String,
    pub sql_sha256: String,
    pub data_commit: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Claim {
    pub id: String,
    pub statement: String,
    pub metric: String,
    pub outcome: String,
    pub comparator: Comparator,
    pub threshold_e6: U64,
    pub window_start_ns: U64,
    pub window_end_ns: U64,
    pub period_secs: U64,
    pub min_periods: u32,
    pub method_sha256: String,
    pub sql_sha256: String,
    pub data_commit: String,
    pub registered_at_ns: U64,
    pub status: Status,
    pub posted: u32,
    pub wins: u32,
    pub last_period: Option<u32>,
    pub resolved_at_ns: Option<U64>,
    pub resolution_note: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Observation {
    /// The claim metric's error (or score) for the period, in millionths.
    pub value_e6: I64,
    pub baseline_daa_e6: I64,
    pub baseline_price_e6: I64,
    /// SHA-256 (hex) of the query output file the three numbers were computed from.
    pub rows_sha256: String,
    pub bytes_scanned: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct ObservationView {
    pub period: u32,
    pub period_start_ns: U64,
    pub period_end_ns: U64,
    pub value_e6: I64,
    pub baseline_daa_e6: I64,
    pub baseline_price_e6: I64,
    pub rows_sha256: String,
    pub bytes_scanned: U64,
    pub win: bool,
    pub posted_at_ns: U64,
}

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Claims,
    Observations,
}

#[near(contract_state, contract_metadata(version = "1.0.0", link = "https://github.com/0xkinno/keytell", standard(standard = "nep297", version = "1.0.0"), standard(standard = "keytell", version = "1.0.0")))]
#[derive(PanicOnDefault)]
pub struct ThesisLedger {
    pub publisher: AccountId,
    pub crank: AccountId,
    claims: IterableMap<String, Claim>,
    observations: LookupMap<(String, u32), ObservationView>,
}

fn is_hex64(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn valid_id(s: &str) -> bool {
    !s.is_empty() && s.len() <= 64 && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

/// Whether the period's value beats both baselines under the comparator.
pub fn is_win(c: Comparator, v: i64, daa: i64, price: i64) -> bool {
    match c {
        Comparator::LowerBeatsBothShare => v < daa && v < price,
        Comparator::HigherBeatsBothShare => v > daa && v > price,
    }
}

/// Pass when wins / posted >= threshold, computed in integers.
pub fn passes(wins: u32, posted: u32, threshold_e6: u64) -> bool {
    posted > 0 && (wins as i128) * E6 >= (threshold_e6 as i128) * (posted as i128)
}

#[near]
impl ThesisLedger {
    #[init]
    pub fn new(publisher: AccountId, crank: AccountId) -> Self {
        Self {
            publisher,
            crank,
            claims: IterableMap::new(Key::Claims),
            observations: LookupMap::new(Key::Observations),
        }
    }

    /// Registers a claim. Publisher only; the window must not have started; every field is fixed
    /// from here on. The deposit covers the claim's storage plus one observation per possible period;
    /// any excess is refunded.
    #[payable]
    pub fn register(&mut self, claim: ClaimInput) -> U64 {
        let now = env::block_timestamp();
        require!(env::predecessor_account_id() == self.publisher, "E_NOT_PUBLISHER");
        require!(claim.window_start_ns.0 > now, "E_WINDOW_STARTED");
        require!(valid_id(&claim.id), "E_BAD_ID");
        require!(!self.claims.contains_key(&claim.id), "E_CLAIM_EXISTS");
        require!(claim.period_secs.0 >= 60, "E_BAD_PERIOD");
        require!(claim.window_end_ns.0 > claim.window_start_ns.0, "E_BAD_WINDOW");
        let span = claim.window_end_ns.0 - claim.window_start_ns.0;
        let period_ns = claim.period_secs.0 * NS;
        require!(span % period_ns == 0, "E_BAD_WINDOW");
        let periods = span / period_ns;
        require!(periods <= MAX_PERIODS as u64, "E_TOO_MANY_PERIODS");
        require!(claim.min_periods >= 1 && (claim.min_periods as u64) <= periods, "E_BAD_MIN_PERIODS");
        require!(claim.threshold_e6.0 >= 1 && claim.threshold_e6.0 <= 1_000_000, "E_BAD_THRESHOLD");
        require!(is_hex64(&claim.method_sha256) && is_hex64(&claim.sql_sha256), "E_BAD_HASH");
        require!(claim.data_commit.len() >= 7 && claim.data_commit.len() <= 64, "E_BAD_COMMIT");
        require!(!claim.statement.is_empty() && claim.statement.len() <= 1024, "E_BAD_TEXT");
        require!(claim.metric.len() <= 512 && claim.outcome.len() <= 512, "E_BAD_TEXT");

        let before = env::storage_usage();
        let stored = Claim {
            id: claim.id.clone(),
            statement: claim.statement,
            metric: claim.metric,
            outcome: claim.outcome,
            comparator: claim.comparator,
            threshold_e6: claim.threshold_e6,
            window_start_ns: claim.window_start_ns,
            window_end_ns: claim.window_end_ns,
            period_secs: claim.period_secs,
            min_periods: claim.min_periods,
            method_sha256: claim.method_sha256,
            sql_sha256: claim.sql_sha256,
            data_commit: claim.data_commit,
            registered_at_ns: U64(now),
            status: Status::Open,
            posted: 0,
            wins: 0,
            last_period: None,
            resolved_at_ns: None,
            resolution_note: None,
        };
        self.claims.insert(claim.id.clone(), stored.clone());
        self.claims.flush();
        let used = env::storage_usage().saturating_sub(before);
        let cost = env::storage_byte_cost().saturating_mul(used as u128).saturating_add(OBS_STORAGE.saturating_mul(periods as u128));
        let deposit = env::attached_deposit();
        require!(deposit >= cost, "E_STORAGE_DEPOSIT");
        let refund = deposit.saturating_sub(cost);
        if !refund.is_zero() {
            let _ = Promise::new(env::predecessor_account_id()).transfer(refund);
        }
        events::emit("claim_registered", json!({
            "claim_id": stored.id, "statement": stored.statement, "metric": stored.metric, "outcome": stored.outcome,
            "comparator": stored.comparator, "threshold_e6": stored.threshold_e6,
            "window_start_ns": stored.window_start_ns, "window_end_ns": stored.window_end_ns,
            "period_secs": stored.period_secs, "min_periods": stored.min_periods,
            "method_sha256": stored.method_sha256, "sql_sha256": stored.sql_sha256, "data_commit": stored.data_commit,
            "registered_at_ns": stored.registered_at_ns,
        }));
        U64(periods)
    }

    /// Posts one period's observation. Crank only; the claim is open; the period has ended and lies
    /// inside the window; periods strictly increase; one post per period.
    pub fn post(&mut self, claim_id: String, period: u32, observation: Observation) {
        require!(env::predecessor_account_id() == self.crank, "E_NOT_CRANK");
        let now = env::block_timestamp();
        let mut c = self.claims.get(&claim_id).cloned().unwrap_or_else(|| env::panic_str("E_NO_CLAIM"));
        require!(c.status == Status::Open, "E_RESOLVED");
        let period_ns = c.period_secs.0 * NS;
        let start = c.window_start_ns.0 + (period as u64) * period_ns;
        let end = start + period_ns;
        require!(end <= c.window_end_ns.0, "E_OUT_OF_WINDOW");
        require!(now >= end, "E_PERIOD_NOT_ENDED");
        if let Some(last) = c.last_period {
            require!(period != last, "E_ALREADY_POSTED");
            require!(period > last, "E_BACKDATE");
        }
        require!(is_hex64(&observation.rows_sha256), "E_BAD_HASH");
        let win = is_win(c.comparator, observation.value_e6.0, observation.baseline_daa_e6.0, observation.baseline_price_e6.0);
        let view = ObservationView {
            period,
            period_start_ns: U64(start),
            period_end_ns: U64(end),
            value_e6: observation.value_e6,
            baseline_daa_e6: observation.baseline_daa_e6,
            baseline_price_e6: observation.baseline_price_e6,
            rows_sha256: observation.rows_sha256,
            bytes_scanned: observation.bytes_scanned,
            win,
            posted_at_ns: U64(now),
        };
        self.observations.insert((claim_id.clone(), period), view.clone());
        c.posted += 1;
        if win {
            c.wins += 1;
        }
        c.last_period = Some(period);
        self.claims.insert(claim_id.clone(), c.clone());
        events::emit("observation_posted", json!({
            "claim_id": claim_id, "period": period, "period_start_ns": view.period_start_ns, "period_end_ns": view.period_end_ns,
            "value_e6": view.value_e6, "baseline_daa_e6": view.baseline_daa_e6, "baseline_price_e6": view.baseline_price_e6,
            "rows_sha256": view.rows_sha256, "bytes_scanned": view.bytes_scanned, "win": win,
            "posted": c.posted, "wins": c.wins,
        }));
    }

    /// Resolves a claim after its window ends. Anyone may call. Passed when the share of winning
    /// periods reaches the registered threshold; Failed otherwise, or when too few periods were posted
    /// by the end of the grace after the window.
    pub fn resolve(&mut self, claim_id: String) -> Status {
        let now = env::block_timestamp();
        let mut c = self.claims.get(&claim_id).cloned().unwrap_or_else(|| env::panic_str("E_NO_CLAIM"));
        require!(c.status == Status::Open, "E_RESOLVED");
        require!(now >= c.window_end_ns.0, "E_WINDOW_OPEN");
        let note;
        if c.posted < c.min_periods {
            require!(now >= c.window_end_ns.0 + LAPSE_GRACE_SECS * NS, "E_TOO_FEW_PERIODS");
            c.status = Status::Failed;
            note = format!("too few periods posted: {} of at least {}", c.posted, c.min_periods);
        } else if passes(c.wins, c.posted, c.threshold_e6.0) {
            c.status = Status::Passed;
            note = format!("{} of {} periods beat both baselines; threshold {} per million", c.wins, c.posted, c.threshold_e6.0);
        } else {
            c.status = Status::Failed;
            note = format!("{} of {} periods beat both baselines; threshold {} per million", c.wins, c.posted, c.threshold_e6.0);
        }
        c.resolved_at_ns = Some(U64(now));
        c.resolution_note = Some(note.clone());
        self.claims.insert(claim_id.clone(), c.clone());
        events::emit("claim_resolved", json!({
            "claim_id": claim_id, "status": c.status, "wins": c.wins, "posted": c.posted,
            "threshold_e6": c.threshold_e6, "resolved_at_ns": U64(now), "note": note,
            "resolved_by": env::predecessor_account_id(),
        }));
        c.status
    }

    // ---------- views ----------

    pub fn get_claim(&self, claim_id: String) -> Option<Claim> {
        self.claims.get(&claim_id).cloned()
    }

    pub fn list_claims(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Claim> {
        self.claims
            .values()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .cloned()
            .collect()
    }

    pub fn claim_count(&self) -> u32 {
        self.claims.len()
    }

    pub fn observations(&self, claim_id: String) -> Vec<ObservationView> {
        let Some(c) = self.claims.get(&claim_id) else { return vec![] };
        let Some(last) = c.last_period else { return vec![] };
        (0..=last).filter_map(|p| self.observations.get(&(claim_id.clone(), p)).cloned()).collect()
    }

    /// Seconds until `resolve` can be called (0 once the window has ended).
    pub fn secs_to_resolve(&self, claim_id: String) -> Option<U64> {
        let c = self.claims.get(&claim_id)?;
        let now = env::block_timestamp();
        Some(U64(c.window_end_ns.0.saturating_sub(now) / NS))
    }

    pub fn roles(&self) -> near_sdk::serde_json::Value {
        json!({ "publisher": self.publisher, "crank": self.crank })
    }
}
