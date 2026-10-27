#!/usr/bin/env bash
# Trigger a Coolify deployment for Sygos (staging or production).
# Requires COOLIFY_URL, COOLIFY_TOKEN, and a resource UUID (flag or env).
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/coolify-deploy.sh --dry-run [--staging | --production | --uuid <uuid>] [--force]
  scripts/coolify-deploy.sh --execute [--staging | --production | --uuid <uuid>] [--force]

Environment:
  COOLIFY_URL                 Base URL (no trailing slash), e.g. https://coolify.example.com
  COOLIFY_TOKEN               Bearer API token (deploy permission)
  COOLIFY_APP_UUID            Default application UUID if no target flag is given
  COOLIFY_APP_UUID_STAGING    Used with --staging
  COOLIFY_APP_UUID_PRODUCTION Used with --production

Agents must run --dry-run first and get explicit user approval before --execute.
EOF
}

mode=""
target=""
force="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) mode="dry-run"; shift ;;
    --execute) mode="execute"; shift ;;
    --staging) target="${COOLIFY_APP_UUID_STAGING:-}"; shift ;;
    --production) target="${COOLIFY_APP_UUID_PRODUCTION:-}"; shift ;;
    --uuid)
      target="${2:-}"
      shift 2
      ;;
    --force) force="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$mode" ]]; then
  echo "Indica --dry-run o --execute" >&2
  usage >&2
  exit 2
fi

if [[ -z "${COOLIFY_URL:-}" || -z "${COOLIFY_TOKEN:-}" ]]; then
  echo "COOLIFY_URL y COOLIFY_TOKEN son obligatorios (secrets del Cloud Agent)." >&2
  exit 2
fi

if [[ -z "$target" ]]; then
  target="${COOLIFY_APP_UUID:-}"
fi

if [[ -z "$target" ]]; then
  echo "Indica --staging, --production, --uuid, o define COOLIFY_APP_UUID." >&2
  exit 2
fi

base="${COOLIFY_URL%/}"

echo "==> Verificando API (GET /api/v1/teams/current)"
team_json="$(curl --fail-with-body -sS \
  --header "Authorization: Bearer ${COOLIFY_TOKEN}" \
  --header "Accept: application/json" \
  "${base}/api/v1/teams/current")"
if command -v jq >/dev/null 2>&1; then
  echo "$team_json" | jq '{ id: .id, name: .name }'
else
  echo "$team_json"
fi

payload="$(jq -n --arg uuid "$target" --argjson force "$force" '{uuid: $uuid, force: $force}')"

if [[ "$mode" == "dry-run" ]]; then
  echo "==> dry-run: no se envió deploy"
  jq -n \
    --arg url "${base}/api/v1/deploy" \
    --argjson body "$payload" \
    '{method: "POST", url: $url, body: $body}'
  exit 0
fi

echo "==> Desplegando (POST /api/v1/deploy)"
curl --fail-with-body -sS \
  --request POST \
  --header "Authorization: Bearer ${COOLIFY_TOKEN}" \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --data "$payload" \
  "${base}/api/v1/deploy" | jq .
