//! Unit and property tests. Each test name is a claim the README links to.

use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, AccountId, NearToken};
use proptest::prelude::*;

const H: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WEEK_NS: u64 = WEEK_SECS * NS;
const T0: u64 = 1_000 * WEEK_NS; // registration time in tests
const START: u64 = T0 + WEEK_NS; // window opens one week after registration

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn publisher() -> AccountId {
    acc("keytell.testnet")
}
fn crank() -> AccountId {
    acc("crank.keytell.testnet")
}

fn ctx(pred: AccountId, ts: u64, deposit: NearToken) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("ledger.keytell.testnet"))
        .predecessor_account_id(pred)
        .block_timestamp(ts)
        .attached_deposit(deposit)
        .account_balance(NearToken::from_near(10));
    testing_env!(b.build());
}

fn input(id: &str, weeks: u64) -> ClaimInput {
    ClaimInput {
        id: id.into(),
        statement: "Function-call-signed activity leads USDC volume better than DAA or price.".into(),
        metric: "fc_signed_tx".into(),
        outcome: "usdc_volume".into(),
        comparator: Comparator::LowerBeatsBothShare,
        threshold_e6: U64(600_000),
        window_start_ns: U64(START),
        window_end_ns: U64(START + weeks * WEEK_NS),
        period_secs: U64(WEEK_SECS),
        min_periods: (weeks as u32).min(4),
        method_sha256: H.into(),
        sql_sha256: H.into(),
        data_commit: "abcdef1".into(),
    }
}

fn obs(v: i64, daa: i64, price: i64) -> Observation {
    Observation { value_e6: I64(v), baseline_daa_e6: I64(daa), baseline_price_e6: I64(price), rows_sha256: H.into(), bytes_scanned: U64(1) }
}

fn fresh() -> ThesisLedger {
    ctx(acc("deployer.testnet"), T0, NearToken::from_yoctonear(0));
    near_sdk::mock::with_mocked_blockchain(|b| drop(b.take_storage()));
    ctx(acc("deployer.testnet"), T0, NearToken::from_yoctonear(0));
    ThesisLedger::new(publisher(), crank())
}

fn registered(weeks: u64) -> ThesisLedger {
    let mut l = fresh();
    ctx(publisher(), T0, NearToken::from_near(1));
    l.register(input("c1", weeks));
    l
}

fn post_at(l: &mut ThesisLedger, period: u32, o: Observation) {
    ctx(crank(), START + (period as u64 + 1) * WEEK_NS, NearToken::from_yoctonear(0));
    l.post("c1".into(), period, o);
}

#[test]
fn register_stores_every_field_and_emits_event() {
    let l = registered(8);
    let c = l.get_claim("c1".into()).unwrap();
    assert_eq!(c.threshold_e6.0, 600_000);
    assert_eq!(c.status, Status::Open);
    assert_eq!(c.registered_at_ns.0, T0);
    assert!(get_logs().iter().any(|x| x.contains("\"event\":\"claim_registered\"")));
}

#[test]
#[should_panic(expected = "E_NOT_PUBLISHER")]
fn refuses_register_by_non_publisher() {
    let mut l = fresh();
    ctx(crank(), T0, NearToken::from_near(1));
    l.register(input("c1", 8));
}

#[test]
#[should_panic(expected = "E_WINDOW_STARTED")]
fn refuses_register_after_window_start() {
    let mut l = fresh();
    ctx(publisher(), START, NearToken::from_near(1));
    l.register(input("c1", 8));
}

#[test]
#[should_panic(expected = "E_CLAIM_EXISTS")]
fn refuses_duplicate_claim_id() {
    let mut l = registered(8);
    ctx(publisher(), T0, NearToken::from_near(1));
    l.register(input("c1", 8));
}

#[test]
#[should_panic(expected = "E_STORAGE_DEPOSIT")]
fn refuses_register_without_storage_deposit() {
    let mut l = fresh();
    ctx(publisher(), T0, NearToken::from_millinear(1));
    l.register(input("c1", 8));
}

#[test]
#[should_panic(expected = "E_BAD_HASH")]
fn refuses_register_with_malformed_hash() {
    let mut l = fresh();
    ctx(publisher(), T0, NearToken::from_near(1));
    let mut i = input("c1", 8);
    i.sql_sha256 = "not-a-hash".into();
    l.register(i);
}

#[test]
#[should_panic(expected = "E_BAD_WINDOW")]
fn refuses_window_not_whole_periods() {
    let mut l = fresh();
    ctx(publisher(), T0, NearToken::from_near(1));
    let mut i = input("c1", 8);
    i.window_end_ns = U64(i.window_end_ns.0 + 1);
    l.register(i);
}

#[test]
#[should_panic(expected = "E_NOT_CRANK")]
fn refuses_post_by_non_crank() {
    let mut l = registered(8);
    ctx(publisher(), START + WEEK_NS, NearToken::from_yoctonear(0));
    l.post("c1".into(), 0, obs(1, 2, 3));
}

#[test]
#[should_panic(expected = "E_PERIOD_NOT_ENDED")]
fn refuses_post_before_period_ends() {
    let mut l = registered(8);
    ctx(crank(), START + WEEK_NS - 1, NearToken::from_yoctonear(0));
    l.post("c1".into(), 0, obs(1, 2, 3));
}

#[test]
#[should_panic(expected = "E_OUT_OF_WINDOW")]
fn refuses_post_outside_window() {
    let mut l = registered(8);
    ctx(crank(), START + 20 * WEEK_NS, NearToken::from_yoctonear(0));
    l.post("c1".into(), 8, obs(1, 2, 3));
}

#[test]
#[should_panic(expected = "E_ALREADY_POSTED")]
fn refuses_duplicate_post() {
    let mut l = registered(8);
    post_at(&mut l, 2, obs(1, 2, 3));
    post_at(&mut l, 2, obs(1, 2, 3));
}

#[test]
#[should_panic(expected = "E_BACKDATE")]
fn refuses_backdated_post() {
    let mut l = registered(8);
    post_at(&mut l, 3, obs(1, 2, 3));
    post_at(&mut l, 1, obs(1, 2, 3));
}

#[test]
#[should_panic(expected = "E_WINDOW_OPEN")]
fn refuses_early_resolve() {
    let mut l = registered(8);
    post_at(&mut l, 0, obs(1, 2, 3));
    ctx(acc("anyone.testnet"), START + 8 * WEEK_NS - 1, NearToken::from_yoctonear(0));
    l.resolve("c1".into());
}

#[test]
#[should_panic(expected = "E_TOO_FEW_PERIODS")]
fn refuses_resolve_with_too_few_periods_inside_grace() {
    let mut l = registered(8);
    post_at(&mut l, 0, obs(1, 2, 3));
    ctx(acc("anyone.testnet"), START + 8 * WEEK_NS, NearToken::from_yoctonear(0));
    l.resolve("c1".into());
}

#[test]
fn silent_crank_lapses_to_failed_after_grace() {
    let mut l = registered(8);
    post_at(&mut l, 0, obs(1, 2, 3));
    ctx(acc("anyone.testnet"), START + 8 * WEEK_NS + LAPSE_GRACE_SECS * NS, NearToken::from_yoctonear(0));
    assert_eq!(l.resolve("c1".into()), Status::Failed);
}

#[test]
fn resolve_passes_when_share_of_wins_reaches_threshold() {
    let mut l = registered(5);
    // 3 of 5 wins = 60 percent, threshold 60 percent.
    for (p, (v, d, x)) in [(1, 2, 3), (5, 2, 3), (1, 2, 3), (1, 2, 3), (9, 2, 3)].into_iter().enumerate() {
        post_at(&mut l, p as u32, obs(v, d, x));
    }
    ctx(acc("anyone.testnet"), START + 5 * WEEK_NS, NearToken::from_yoctonear(0));
    assert_eq!(l.resolve("c1".into()), Status::Passed);
    assert!(get_logs().iter().any(|x| x.contains("\"event\":\"claim_resolved\"")));
}

#[test]
fn resolve_fails_below_threshold_and_a_tie_with_a_baseline_is_not_a_win() {
    let mut l = registered(5);
    // Wins: periods 0 and 2 only; period 1 ties the DAA baseline.
    for (p, (v, d, x)) in [(1, 2, 3), (2, 2, 3), (1, 2, 3), (4, 2, 3), (5, 2, 3)].into_iter().enumerate() {
        post_at(&mut l, p as u32, obs(v, d, x));
    }
    ctx(acc("anyone.testnet"), START + 5 * WEEK_NS, NearToken::from_yoctonear(0));
    assert_eq!(l.resolve("c1".into()), Status::Failed);
    assert_eq!(l.get_claim("c1".into()).unwrap().wins, 2);
}

#[test]
#[should_panic(expected = "E_RESOLVED")]
fn refuses_post_after_resolve() {
    let mut l = registered(4);
    for p in 0..4 {
        post_at(&mut l, p, obs(1, 2, 3));
    }
    ctx(acc("anyone.testnet"), START + 4 * WEEK_NS, NearToken::from_yoctonear(0));
    l.resolve("c1".into());
    post_at(&mut l, 3, obs(1, 2, 3));
}

#[test]
#[should_panic(expected = "E_RESOLVED")]
fn refuses_second_resolve() {
    let mut l = registered(4);
    for p in 0..4 {
        post_at(&mut l, p, obs(1, 2, 3));
    }
    ctx(acc("anyone.testnet"), START + 4 * WEEK_NS, NearToken::from_yoctonear(0));
    l.resolve("c1".into());
    l.resolve("c1".into());
}

#[test]
fn observations_view_returns_posted_periods_in_order() {
    let mut l = registered(8);
    post_at(&mut l, 0, obs(1, 2, 3));
    post_at(&mut l, 2, obs(9, 2, 3));
    let v = l.observations("c1".into());
    assert_eq!(v.iter().map(|o| o.period).collect::<Vec<_>>(), vec![0, 2]);
    assert!(v[0].win && !v[1].win);
}

#[test]
fn higher_comparator_counts_strictly_greater() {
    assert!(is_win(Comparator::HigherBeatsBothShare, 5, 4, 3));
    assert!(!is_win(Comparator::HigherBeatsBothShare, 4, 4, 3));
    assert!(passes(3, 5, 600_000));
    assert!(!passes(2, 5, 600_000));
    assert!(!passes(0, 0, 1));
}

#[derive(Debug, Clone)]
enum Op {
    Post { by_crank: bool, period: u32, v: i64 },
    Register { by_publisher: bool, threshold: u64 },
    Resolve { week: u64 },
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        (any::<bool>(), 0u32..12, -5i64..5).prop_map(|(by_crank, period, v)| Op::Post { by_crank, period, v }),
        (any::<bool>(), 1u64..1_000_000).prop_map(|(by_publisher, threshold)| Op::Register { by_publisher, threshold }),
        (0u64..50).prop_map(|week| Op::Resolve { week }),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10_000))]

    /// No sequence of calls changes a registered claim's terms, posts periods out of order, or
    /// changes a status once it is set.
    #[test]
    fn no_call_sequence_changes_terms_or_reorders_periods(ops in proptest::collection::vec(op(), 1..25)) {
        let mut l = registered(8);
        let terms = |c: &Claim| format!("{:?}", (c.statement.clone(), c.metric.clone(), c.outcome.clone(), c.comparator, c.threshold_e6.0,
            c.window_start_ns.0, c.window_end_ns.0, c.period_secs.0, (c.min_periods, c.method_sha256.clone(), c.sql_sha256.clone(), c.data_commit.clone(), c.registered_at_ns.0)));
        let before = terms(&l.get_claim("c1".into()).unwrap());
        let mut frozen: Option<Status> = None;
        for o in ops {
            let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match o {
                Op::Post { by_crank, period, v } => {
                    ctx(if by_crank { crank() } else { publisher() }, START + 9 * WEEK_NS, NearToken::from_yoctonear(0));
                    l.post("c1".into(), period, obs(v, 0, 0));
                }
                Op::Register { by_publisher, threshold } => {
                    ctx(if by_publisher { publisher() } else { crank() }, T0, NearToken::from_near(1));
                    let mut i = input("c1", 8);
                    i.threshold_e6 = U64(threshold);
                    l.register(i);
                }
                Op::Resolve { week } => {
                    ctx(acc("anyone.testnet"), START + week * WEEK_NS, NearToken::from_yoctonear(0));
                    l.resolve("c1".into());
                }
            }));
            let _ = r;
            let c = l.get_claim("c1".into()).unwrap();
            prop_assert_eq!(terms(&c), before.clone());
            if let Some(s) = frozen { prop_assert_eq!(c.status, s); }
            if c.status != Status::Open { frozen = Some(c.status); }
            let periods: Vec<u32> = l.observations("c1".into()).iter().map(|o| o.period).collect();
            prop_assert!(periods.windows(2).all(|w| w[0] < w[1]));
            prop_assert_eq!(periods.len() as u32, c.posted);
        }
    }
}
