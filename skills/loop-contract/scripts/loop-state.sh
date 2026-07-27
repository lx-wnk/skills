#!/usr/bin/env bash
# Deterministic controller for the loop-contract skill.
#
# Owns every continue/stop decision: counters, budgets, progress comparison and
# scope checks. The model spawns workers and runs verify commands; it never
# decides whether the loop continues. Each subcommand prints one directive line
# that the caller executes verbatim.
#
# Directives: SPAWN … | AUDIT … | CONTINUE … | STOP reason=… | SCOPE …
#
# Usage:
#   loop-state.sh init   --state F --mode goal --max-iterations N --no-progress N
#   loop-state.sh init   --state F --mode plan --per-item N --global N --items 1,2,3
#   loop-state.sh next   --state F
#   loop-state.sh record --state F --exit N --output FILE [--metric N] [--item ID]
#   loop-state.sh audit  --state F --verdict clean|gamed [--item ID]
#   loop-state.sh mark   --state F --item ID --state-value manual|blocked
#   loop-state.sh scope-check --allow "src/**,tests/**"
#   loop-state.sh report --state F

set -euo pipefail

STATE=""
MODE=""
EXIT_CODE=""
OUTPUT=""
METRIC=""
ITEM=""
VERDICT=""
STATE_VALUE=""
ALLOW=""
MAX_ITERATIONS=8
NO_PROGRESS=2
PER_ITEM=3
GLOBAL_MAX=40
ITEMS=""

die() {
  echo "loop-state: $*" >&2
  exit 2
}

get() {
  grep -m1 "^$1=" "$STATE" | cut -d= -f2- || true
}

set_kv() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp)"
  awk -F= -v k="$key" -v v="$val" '
    /^item:/ { print; next }
    $1 == k  { print k "=" v; done = 1; next }
             { print }
    END      { if (!done) print k "=" v }
  ' "$STATE" >"$tmp"
  mv "$tmp" "$STATE"
}

item_field() {
  grep -m1 "^item:$1:" "$STATE" | cut -d: -f"$2" || true
}

set_item() {
  local id="$1" st="$2" att="$3" gam="$4" tmp
  tmp="$(mktemp)"
  awk -F: -v id="$id" -v st="$st" -v att="$att" -v gam="$gam" '
    /^item:/ && $2 == id { print "item:" id ":" st ":" att ":" gam; next }
                         { print }
  ' "$STATE" >"$tmp"
  mv "$tmp" "$STATE"
}

hash_of() {
  [ -f "$1" ] || {
    echo "no-output"
    return
  }
  if command -v shasum >/dev/null 2>&1; then
    shasum "$1" | cut -d' ' -f1
  else
    cksum <"$1" | cut -d' ' -f1
  fi
}

stop() {
  set_kv status stopped
  set_kv stop_reason "$1"
  echo "STOP reason=$1"
  exit 0
}

require_state() {
  [ -n "$STATE" ] || die "--state is required"
  [ -f "$STATE" ] || die "state file not found: $STATE"
}

cmd_init() {
  [ -n "$STATE" ] || die "--state is required"
  [ -n "$MODE" ] || die "--mode is required"
  mkdir -p "$(dirname "$STATE")"
  {
    echo "mode=$MODE"
    echo "status=running"
    echo "stop_reason="
    echo "gamed=0"
    if [ "$MODE" = "goal" ]; then
      echo "max_iterations=$MAX_ITERATIONS"
      echo "no_progress_max=$NO_PROGRESS"
      echo "iteration=0"
      echo "nprog=0"
      echo "last_hash="
      echo "last_metric="
    else
      echo "per_item=$PER_ITEM"
      echo "global_max=$GLOBAL_MAX"
      echo "global_count=0"
      echo "last_hash="
    fi
  } >"$STATE"

  if [ "$MODE" = "plan" ]; then
    [ -n "$ITEMS" ] || die "--items is required in plan mode"
    local id
    for id in ${ITEMS//,/ }; do
      echo "item:$id:pending:0:0" >>"$STATE"
    done
  fi
  echo "INIT mode=$MODE state=$STATE"
}

next_goal() {
  local iteration max
  iteration="$(get iteration)"
  max="$(get max_iterations)"
  if [ "$iteration" -ge "$max" ]; then
    stop budget
  fi
  iteration=$((iteration + 1))
  set_kv iteration "$iteration"
  echo "SPAWN iteration=$iteration of=$max"
}

next_plan() {
  local count max per id st att
  count="$(get global_count)"
  max="$(get global_max)"
  per="$(get per_item)"

  while :; do
    id=""
    while IFS=: read -r _ cand cstate _ _; do
      if [ "$cstate" = "pending" ]; then
        id="$cand"
        break
      fi
    done < <(grep "^item:" "$STATE")

    [ -n "$id" ] || stop all-items-resolved

    att="$(item_field "$id" 4)"
    st="$(item_field "$id" 3)"
    if [ "$att" -ge "$per" ]; then
      set_item "$id" blocked "$att" "$(item_field "$id" 5)"
      echo "ITEM item=$id state=blocked reason=per-item-budget"
      continue
    fi

    if [ "$count" -ge "$max" ]; then
      stop budget
    fi

    att=$((att + 1))
    count=$((count + 1))
    set_item "$id" pending "$att" "$(item_field "$id" 5)"
    set_kv global_count "$count"
    echo "SPAWN item=$id attempt=$att of=$per global=$count of_global=$max"
    return
  done
}

cmd_next() {
  require_state
  [ "$(get status)" = "running" ] || stop "$(get stop_reason)"
  if [ "$(get mode)" = "goal" ]; then next_goal; else next_plan; fi
}

record_progress() {
  local new_hash better=0 last_metric
  new_hash="$(hash_of "$OUTPUT")"
  last_metric="$(get last_metric)"

  if [ -n "$METRIC" ]; then
    if [ -z "$last_metric" ] || [ "$METRIC" -lt "$last_metric" ]; then
      better=1
    fi
    set_kv last_metric "$METRIC"
  elif [ "$new_hash" != "$(get last_hash)" ]; then
    better=1
  fi
  set_kv last_hash "$new_hash"

  local nprog
  nprog="$(get nprog)"
  if [ "$better" = "1" ]; then
    nprog=0
  else
    nprog=$((nprog + 1))
  fi
  set_kv nprog "$nprog"

  if [ "$nprog" -ge "$(get no_progress_max)" ]; then
    stop stuck
  fi
  echo "CONTINUE nprog=$nprog"
}

cmd_record() {
  require_state
  [ -n "$EXIT_CODE" ] || die "--exit is required"

  if [ "$(get mode)" = "goal" ]; then
    if [ "$EXIT_CODE" = "0" ]; then
      echo "AUDIT iteration=$(get iteration)"
    else
      record_progress
    fi
    return
  fi

  [ -n "$ITEM" ] || die "--item is required in plan mode"
  if [ "$EXIT_CODE" = "0" ]; then
    echo "AUDIT item=$ITEM"
  else
    echo "CONTINUE item=$ITEM attempt=$(item_field "$ITEM" 4) of=$(get per_item)"
  fi
}

cmd_audit() {
  require_state
  [ -n "$VERDICT" ] || die "--verdict is required"

  if [ "$VERDICT" = "clean" ]; then
    if [ "$(get mode)" = "goal" ]; then
      stop goal-met
    fi
    [ -n "$ITEM" ] || die "--item is required in plan mode"
    set_item "$ITEM" "done" "$(item_field "$ITEM" 4)" "$(item_field "$ITEM" 5)"
    echo "ITEM item=$ITEM state=done"
    return
  fi

  local gamed
  if [ "$(get mode)" = "goal" ]; then
    gamed=$(($(get gamed) + 1))
    set_kv gamed "$gamed"
    [ "$gamed" -lt 2 ] || stop audit-blocked
    echo "CONTINUE gamed=$gamed of=2"
  else
    [ -n "$ITEM" ] || die "--item is required in plan mode"
    gamed=$(($(item_field "$ITEM" 5) + 1))
    set_item "$ITEM" pending "$(item_field "$ITEM" 4)" "$gamed"
    if [ "$gamed" -ge 2 ]; then
      set_item "$ITEM" blocked "$(item_field "$ITEM" 4)" "$gamed"
      echo "ITEM item=$ITEM state=blocked reason=audit-blocked"
    else
      echo "CONTINUE item=$ITEM gamed=$gamed of=2"
    fi
  fi
}

cmd_mark() {
  require_state
  [ -n "$ITEM" ] || die "--item is required"
  [ -n "$STATE_VALUE" ] || die "--state-value is required"
  set_item "$ITEM" "$STATE_VALUE" "$(item_field "$ITEM" 4)" "$(item_field "$ITEM" 5)"
  echo "ITEM item=$ITEM state=$STATE_VALUE"
}

cmd_scope_check() {
  [ -n "$ALLOW" ] || die "--allow is required"
  local changed f pat matched escaped=0
  # Without noglob the unquoted pattern list below is pathname-expanded against
  # the working tree, turning "src/**" into whatever happens to exist.
  set -f
  changed="$(git status --porcelain | awk '{print $NF}')"
  [ -n "$changed" ] || {
    set +f
    echo "SCOPE ok changed=0"
    return
  }

  while IFS= read -r f; do
    [ -n "$f" ] || continue
    matched=0
    for pat in ${ALLOW//,/ }; do
      # shellcheck disable=SC2254 # pattern is intentionally unquoted
      case "$f" in
      $pat)
        matched=1
        break
        ;;
      esac
    done
    if [ "$matched" = "0" ]; then
      echo "SCOPE escape file=$f"
      escaped=1
    fi
  done <<<"$changed"

  set +f
  [ "$escaped" = "0" ] && echo "SCOPE ok"
  return 0
}

cmd_report() {
  require_state
  echo "mode=$(get mode) status=$(get status) stop_reason=$(get stop_reason)"
  if [ "$(get mode)" = "goal" ]; then
    echo "iterations=$(get iteration)/$(get max_iterations) no_progress=$(get nprog) gamed=$(get gamed)"
    return
  fi
  echo "global=$(get global_count)/$(get global_max)"
  local id st att gam
  while IFS=: read -r _ id st att gam; do
    echo "item=$id state=$st attempts=$att gamed=$gam"
  done < <(grep "^item:" "$STATE")
}

[ $# -gt 0 ] || die "no subcommand given"
SUBCOMMAND="$1"
shift

while [ $# -gt 0 ]; do
  case "$1" in
  --state) STATE="$2" ;;
  --mode) MODE="$2" ;;
  --max-iterations) MAX_ITERATIONS="$2" ;;
  --no-progress) NO_PROGRESS="$2" ;;
  --per-item) PER_ITEM="$2" ;;
  --global) GLOBAL_MAX="$2" ;;
  --items) ITEMS="$2" ;;
  --exit) EXIT_CODE="$2" ;;
  --output) OUTPUT="$2" ;;
  --metric) METRIC="$2" ;;
  --item) ITEM="$2" ;;
  --verdict) VERDICT="$2" ;;
  --state-value) STATE_VALUE="$2" ;;
  --allow) ALLOW="$2" ;;
  *) die "unknown flag: $1" ;;
  esac
  shift 2
done

case "$SUBCOMMAND" in
init) cmd_init ;;
next) cmd_next ;;
record) cmd_record ;;
audit) cmd_audit ;;
mark) cmd_mark ;;
scope-check) cmd_scope_check ;;
report) cmd_report ;;
*) die "unknown subcommand: $SUBCOMMAND" ;;
esac
