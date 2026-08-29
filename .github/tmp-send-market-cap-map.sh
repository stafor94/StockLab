#!/usr/bin/env bash
set -euo pipefail

tmp="${RUNNER_TEMP}/market-cap-private"
sender_json="$tmp/sender-map.json"
sender_cms="$tmp/sender-map.cms"

if [ -n "${MARKET_SOURCE_MAP_JSON:-}" ]; then
  python3 - <<'PY'
import json, os
from pathlib import Path
source = json.loads(os.environ['MARKET_SOURCE_MAP_JSON'])
assets = source.get('assets')
if not isinstance(assets, dict):
    raise SystemExit('Private market source secret has an invalid structure.')
ids = [*(f'K{i:03d}' for i in range(1, 41)), *(f'KE{i:03d}' for i in range(1, 13)), *(f'U{i:03d}' for i in range(1, 46))]
if any(asset_id not in assets for asset_id in ids):
    raise SystemExit('Private market source secret is missing a supported asset slot.')
filtered = {'schemaVersion': 1, 'assets': {asset_id: assets[asset_id] for asset_id in ids}}
path = Path(os.environ['RUNNER_TEMP']) / 'market-cap-private' / 'sender-map.json'
path.write_text(json.dumps(filtered, separators=(',', ':')))
path.chmod(0o600)
print('Prepared exactly 97 supported private source slots for fresh encryption.')
PY
else
  python3 - <<'PY'
import json, os
from pathlib import Path
assets = {}
for i in range(1, 41):
    assets[f'K{i:03d}'] = {'provider': 'KRX', 'endpoint': 'stk_bydd_trd', 'endpointChanges': [], 'symbol': '000000'}
for i in range(1, 13):
    assets[f'KE{i:03d}'] = {'provider': 'KRX', 'endpoint': 'etf_bydd_trd', 'endpointChanges': [], 'symbol': '000000'}
for i in range(1, 46):
    assets[f'U{i:03d}'] = {'provider': 'NASDAQ', 'assetClass': 'stocks', 'symbol': 'DUMMY'}
path = Path(os.environ['RUNNER_TEMP']) / 'market-cap-private' / 'sender-map.json'
path.write_text(json.dumps({'schemaVersion': 1, 'assets': assets}, separators=(',', ':')))
path.chmod(0o600)
print('Prepared opaque 97-slot placeholder map for in-run official identity reconstruction.')
PY
fi

openssl cms -encrypt -binary -aes-256-cbc -outform DER \
  -in "$sender_json" \
  -out "$sender_cms" \
  "$tmp/cert.pem"

payload="$(base64 -w0 "$sender_cms")"
size=${#payload}
chunk=$(( (size + 3) / 4 ))
endpoint="repos/${GITHUB_REPOSITORY}/issues/82/comments"
for index in 1 2 3 4; do
  start=$(( (index - 1) * chunk ))
  part="${payload:start:chunk}"
  test -n "$part" || { echo 'Encrypted payload chunking failed.' >&2; exit 1; }
  gh api --method POST "$endpoint" \
    -f body="MARKET_CAP_MAP_CMS_V2:${GITHUB_RUN_ID}:${index}/4:${part}" >/dev/null
done

rm -f "$sender_json" "$sender_cms"
