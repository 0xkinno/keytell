//! NEP-297 events, standard `keytell`, version `1.0.0`. Each event carries enough to rebuild every
//! claim and observation from logs alone (`scripts/verify.ts` does exactly that).

use near_sdk::env;
use near_sdk::serde_json::{json, Value};

pub const STANDARD: &str = "keytell";
pub const VERSION: &str = "1.0.0";

pub fn emit(event: &str, data: Value) {
    let payload = json!({ "standard": STANDARD, "version": VERSION, "event": event, "data": [data] });
    env::log_str(&format!("EVENT_JSON:{payload}"));
}
