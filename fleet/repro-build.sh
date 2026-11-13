#!/usr/bin/env bash
# Builds thesis_ledger inside the pinned reproducible image, from the committed tree, exactly as
# `cargo near build reproducible-wasm` does (same image digest, same NEP-330 build info), but
# runnable behind a TLS-intercepting proxy: set CA_BUNDLE to mount its certificate.
# Output: target/near/thesis_ledger/thesis_ledger.wasm and fleet/ours-wasm.sha256.
set -euo pipefail
IMAGE="sourcescan/cargo-near:0.22.0-rust-1.97.1@sha256:7467038bdddc86484b73b416eeadce926ff59013e128e53dec5a19e1cb4b2234"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REV="$(git -C "$ROOT" rev-parse HEAD)"
test -z "$(git -C "$ROOT" status --porcelain -- contracts Cargo.toml Cargo.lock rust-toolchain.toml)" || { echo "commit first: reproducible builds use the committed tree"; exit 1; }
WORK="$(mktemp -d)"
git -C "$ROOT" archive "$REV" | tar -x -C "$WORK"
CA_ARGS=()
if [ -n "${CA_BUNDLE:-}" ]; then CA_ARGS=(-v "$CA_BUNDLE:/ca.crt:ro" -e SSL_CERT_FILE=/ca.crt -e CARGO_HTTP_CAINFO=/ca.crt -e HTTPS_PROXY -e HTTP_PROXY -e NO_PROXY); fi
c=thesis_ledger
docker run --rm --network host -u 0:0 -v "$WORK:/home/near/code" "${CA_ARGS[@]}" \
  --workdir "/home/near/code/contracts/$c" \
  -e NEP330_BUILD_INFO_BUILD_ENVIRONMENT="$IMAGE" \
  -e NEP330_BUILD_INFO_SOURCE_CODE_SNAPSHOT="git+https://github.com/0xkinno/keytell?rev=$REV" \
  -e NEP330_BUILD_INFO_CONTRACT_PATH="contracts/$c" \
  -e NEP330_LINK="https://github.com/0xkinno/keytell/tree/$REV" \
  "$IMAGE" /bin/bash -c "cargo near build non-reproducible-wasm --locked --no-abi"
mkdir -p "$ROOT/target/near/$c"
cp "$WORK/target/near/$c/$c.wasm" "$ROOT/target/near/$c/$c.wasm"
(cd "$ROOT/target/near" && sha256sum */*.wasm | sed "s#\$# (commit $REV)#") | tee "$ROOT/fleet/ours-wasm.sha256"
