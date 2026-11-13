//! The whole ledger on a real local NEAR node: register, every refusal as a real failed
//! transaction, posts signed by a function-call key limited to `post`, resolve, and the missing
//! edit method. Needs `target/near/thesis_ledger/thesis_ledger.wasm` (fleet/repro-build.sh) and,
//! in containers without CAP_SYS_RESOURCE, LD_PRELOAD=fleet/shim/libfdlimit.so.
use anyhow::Result;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::{AccessKey, NearToken, SecretKey};
use near_workspaces::{Account, AccountId, Contract, Worker};
use near_workspaces::network::Sandbox;
use serde_json::{json, Value};

const H: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NS: u64 = 1_000_000_000;
const PERIOD: u64 = 60;

fn wasm() -> Vec<u8> {
    let p = "../../target/near/thesis_ledger/thesis_ledger.wasm";
    std::fs::read(p).unwrap_or_else(|e| panic!("read {p}: {e}. Run fleet/repro-build.sh first"))
}

fn fail_text(o: &ExecutionFinalResult) -> String {
    format!("{:?}", o.failures())
}

async fn now_ns(w: &Worker<Sandbox>) -> Result<u64> {
    Ok(w.view_block().await?.timestamp())
}

async fn wait_until(w: &Worker<Sandbox>, t: u64) -> Result<()> {
    while now_ns(w).await? < t {
        w.fast_forward(20).await?;
    }
    Ok(())
}

async fn call(a: &Account, to: &AccountId, m: &str, args: Value, dep: NearToken) -> Result<ExecutionFinalResult> {
    Ok(a.call(to, m).args_json(args).deposit(dep).gas(near_workspaces::types::Gas::from_tgas(100)).transact().await?)
}

fn claim(id: &str, start: u64, periods: u64) -> Value {
    json!({ "claim": {
        "id": id, "statement": "Sandbox claim", "metric": "fc_signed_tx", "outcome": "usdc_volume",
        "comparator": "LowerBeatsBothShare", "threshold_e6": "500000",
        "window_start_ns": start.to_string(), "window_end_ns": (start + periods * PERIOD * NS).to_string(),
        "period_secs": PERIOD.to_string(), "min_periods": 2,
        "method_sha256": H, "sql_sha256": H, "data_commit": "abcdef1"
    }})
}

fn obs(v: i64) -> Value {
    json!({ "value_e6": v.to_string(), "baseline_daa_e6": "10", "baseline_price_e6": "20", "rows_sha256": H, "bytes_scanned": "1" })
}

struct World {
    w: Worker<Sandbox>,
    ledger: Contract,
    publisher: Account,
    crank_fc: Account,
    stranger: Account,
}

async fn world() -> Result<World> {
    let w = near_workspaces::sandbox().await?;
    let root = w.root_account()?;
    let publisher = root.create_subaccount("publisher").initial_balance(NearToken::from_near(20)).transact().await?.into_result()?;
    let crank = root.create_subaccount("crank").initial_balance(NearToken::from_near(5)).transact().await?.into_result()?;
    let stranger = root.create_subaccount("stranger").initial_balance(NearToken::from_near(5)).transact().await?.into_result()?;
    let ledger_acc = root.create_subaccount("ledger").initial_balance(NearToken::from_near(10)).transact().await?.into_result()?;
    let ledger = ledger_acc.deploy(&wasm()).await?.into_result()?;
    ledger.call("new").args_json(json!({ "publisher": publisher.id(), "crank": crank.id() })).transact().await?.into_result()?;
    // The crank signs with a function-call key limited to `post` on the ledger, like the deployed one.
    let sk = SecretKey::from_random(near_workspaces::types::KeyType::ED25519);
    crank
        .batch(crank.id())
        .add_key(sk.public_key(), AccessKey::function_call_access(ledger.id(), &["post"], Some(NearToken::from_millinear(250))))
        .transact()
        .await?
        .into_result()?;
    let crank_fc = Account::from_secret_key(crank.id().clone(), sk, &w);
    Ok(World { w, ledger, publisher, crank_fc, stranger })
}

#[tokio::test]
async fn register_post_resolve_and_every_refusal_on_a_real_node() -> Result<()> {
    let World { w, ledger, publisher, crank_fc, stranger } = world().await?;
    let id = ledger.id();
    let start = now_ns(&w).await? + 40 * NS;

    // Refusals at registration.
    let r = call(&stranger, id, "register", claim("c1", start, 3), NearToken::from_near(1)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_NOT_PUBLISHER"), "{}", fail_text(&r));
    let r = call(&publisher, id, "register", claim("c1", start, 3), NearToken::from_millinear(1)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_STORAGE_DEPOSIT"), "{}", fail_text(&r));
    let r = call(&publisher, id, "register", claim("late", now_ns(&w).await?, 3), NearToken::from_near(1)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_WINDOW_STARTED"), "{}", fail_text(&r));

    // Registered; a second registration of the same id is refused.
    let r = call(&publisher, id, "register", claim("c1", start, 3), NearToken::from_near(1)).await?;
    assert!(r.is_success(), "{}", fail_text(&r));
    assert!(r.logs().iter().any(|l| l.contains("claim_registered")));
    let r = call(&publisher, id, "register", claim("c1", start, 3), NearToken::from_near(1)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_CLAIM_EXISTS"), "{}", fail_text(&r));

    // There is no method to edit a threshold: the call fails with MethodNotFound.
    let r = call(&publisher, id, "edit_threshold", json!({ "claim_id": "c1", "threshold_e6": "1" }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("MethodNotFound"), "{}", fail_text(&r));

    // The function-call key cannot call anything but `post`.
    let r = crank_fc.call(id, "resolve").args_json(json!({ "claim_id": "c1" })).transact().await;
    assert!(r.is_err() || r.unwrap().is_failure(), "a post-only key must not resolve");

    // Before the first period ends.
    let r = call(&crank_fc, id, "post", json!({ "claim_id": "c1", "period": 0, "observation": obs(1) }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_PERIOD_NOT_ENDED"), "{}", fail_text(&r));
    // A stranger cannot post.
    wait_until(&w, start + PERIOD * NS).await?;
    let r = call(&stranger, id, "post", json!({ "claim_id": "c1", "period": 0, "observation": obs(1) }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_NOT_CRANK"), "{}", fail_text(&r));

    // Posts land, signed by the function-call key.
    let r = call(&crank_fc, id, "post", json!({ "claim_id": "c1", "period": 0, "observation": obs(1) }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_success(), "{}", fail_text(&r));
    let r = call(&crank_fc, id, "post", json!({ "claim_id": "c1", "period": 0, "observation": obs(1) }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_ALREADY_POSTED"), "{}", fail_text(&r));
    wait_until(&w, start + 3 * PERIOD * NS).await?;
    let r = call(&crank_fc, id, "post", json!({ "claim_id": "c1", "period": 2, "observation": obs(99) }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_success(), "{}", fail_text(&r));
    let r = call(&crank_fc, id, "post", json!({ "claim_id": "c1", "period": 1, "observation": obs(1) }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_BACKDATE"), "{}", fail_text(&r));
    let r = call(&crank_fc, id, "post", json!({ "claim_id": "c1", "period": 3, "observation": obs(1) }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_OUT_OF_WINDOW"), "{}", fail_text(&r));

    // Anyone resolves: 1 win of 2 periods meets the 50 percent threshold.
    let r = call(&stranger, id, "resolve", json!({ "claim_id": "c1" }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_success(), "{}", fail_text(&r));
    assert_eq!(r.json::<String>()?, "Passed");
    let r = call(&stranger, id, "resolve", json!({ "claim_id": "c1" }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_RESOLVED"), "{}", fail_text(&r));

    let c: Value = ledger.view("get_claim").args_json(json!({ "claim_id": "c1" })).await?.json()?;
    assert_eq!(c["status"], "Passed");
    assert_eq!(c["threshold_e6"], "500000");
    let o: Vec<Value> = ledger.view("observations").args_json(json!({ "claim_id": "c1" })).await?.json()?;
    assert_eq!(o.len(), 2);
    Ok(())
}

#[tokio::test]
async fn early_resolve_is_refused() -> Result<()> {
    let World { w, ledger, publisher, stranger, .. } = world().await?;
    let start = now_ns(&w).await? + 40 * NS;
    call(&publisher, ledger.id(), "register", claim("c2", start, 2), NearToken::from_near(1)).await?.into_result()?;
    let r = call(&stranger, ledger.id(), "resolve", json!({ "claim_id": "c2" }), NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && fail_text(&r).contains("E_WINDOW_OPEN"), "{}", fail_text(&r));
    Ok(())
}
