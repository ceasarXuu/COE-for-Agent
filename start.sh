#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/dev.pid"
LOG_FILE="$RUN_DIR/dev.log"
WEB_URL="${COE_WEB_URL:-http://127.0.0.1:4173}"
DEV_CMD="${COE_DEV_CMD:-pnpm dev:console}"

mkdir -p "$RUN_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

open_browser() {
  if command -v open >/dev/null 2>&1; then
    open "$1" >/dev/null 2>&1 || true
    return
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 || true
  fi
}

wait_for_url() {
  local url="$1"
  local attempts="${2:-90}"
  local i

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

stop_pid_tree() {
  local pid="$1"
  local child_pid

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  while IFS= read -r child_pid; do
    if [ -n "$child_pid" ]; then
      stop_pid_tree "$child_pid"
    fi
  done < <(pgrep -P "$pid" || true)

  kill "$pid" >/dev/null 2>&1 || true
}

require_cmd pnpm
require_cmd curl

if [ ! -f ".env" ]; then
  cp ".env.example" ".env"
fi

if [ -f "$PID_FILE" ]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${EXISTING_PID:-}" ] && kill -0 "$EXISTING_PID" >/dev/null 2>&1; then
    if wait_for_url "$WEB_URL" 3; then
      echo "Development stack already running with PID $EXISTING_PID"
    else
      echo "Tracked dev PID $EXISTING_PID is alive but $WEB_URL is not responding; restarting stack..."
      stop_pid_tree "$EXISTING_PID"
      rm -f "$PID_FILE"
    fi
  else
    rm -f "$PID_FILE"
  fi
fi

if [ ! -f "$PID_FILE" ]; then
  echo "Starting application services..."
  nohup ${DEV_CMD} >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
fi

echo "Waiting for Console web at $WEB_URL ..."
if ! wait_for_url "$WEB_URL"; then
  echo "Timed out waiting for $WEB_URL" >&2
  echo "Check logs: $LOG_FILE" >&2
  exit 1
fi

open_browser "$WEB_URL"

echo
echo "COE Console is available at: $WEB_URL"
echo "PID: $(cat "$PID_FILE")"
echo "Logs: $LOG_FILE"
