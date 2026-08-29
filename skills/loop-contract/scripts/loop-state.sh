#!/usr/bin/env bash
# Deterministic controller for the loop-contract skill.
#
# Owns every continue/stop decision: counters, budgets, progress comparison and
# scope checks. The model spawns workers and runs verify commands; it never
# decides whether the loop continues.
#
# Each subcommand's terminal output is exactly one directive line, EXCEPT
# `next` in plan mode, which may print zero or more informational ITEM lines
# (items auto-blocked by a spent per-item budget) before its terminal SPAWN
# or STOP line. ITEM lines never require caller action beyond continuing to
# read; keep consuming output until a SPAWN, STOP, or CONTINUE line appears.
#
# Directives: SPAWN … | AUDIT … | CONTINUE … | STOP reason=… | SCOPE … | ITEM …
#
# `record` without --metric degrades stuck-detection to a whole-output hash
# comparison. That fallback is NOT equivalent to metric-based detection: any
# verify output containing timings, PIDs, or absolute paths hashes
# differently on every run, so the fallback detects "output changed at all",
# not "made progress", and a stuck run can burn its full budget undetected.
# Pass --metric whenever a real progress number exists (failing test count,
# lint error count, ...); the fallback logs a warning to stderr when used.
#
# Usage:
#   loop-state.sh init   --state F --mode goal --max-iterations N --no-progress N [--force]
#   loop-state.sh init   --state F --mode plan --per-item N --global N --items 1,2,3 [--force]
#   loop-state.sh next   --state F
#   loop-state.sh record --state F --exit N --output FILE [--metric N] --item ID   # plan mode
#   loop-state.sh record --state F --exit N --output FILE [--metric N]             # goal mode
#   loop-state.sh audit  --state F --verdict clean|gamed --item ID                 # plan mode, per item
#   loop-state.sh audit  --state F --verdict clean|gamed --global-audit            # plan mode, final run-level audit (works after STOP)
#   loop-state.sh audit  --state F --verdict clean|gamed                           # goal mode
#   loop-state.sh mark   --state F --item ID --state-value manual|blocked
#   loop-state.sh scope-check --state F --allow "src/**,tests/**" [--deny "src/vendor/**"] [--item ID]
#     --item is required in plan mode only when the check finds an escape, to
#     record which item gets blocked; the run continues past a blocked item.
#     In goal mode an escape stops the whole run (reason=scope-escape).
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
DENY=""
MAX_ITERATIONS=8
NO_PROGRESS=2
PER_ITEM=3
GLOBAL_MAX=40
ITEMS=""
GLOBAL_AUDIT=0
FORCE=0

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
  grep -q "^item:$id:" "$STATE" || die "unknown item id: $id"
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

# stop reason [exit_code]
# Writes the terminal state and prints the STOP directive. exit_code
# defaults to 0 (normal termination); callers that need to signal an
# abnormal halt (e.g. a scope escape) pass a non-zero code explicitly.
stop() {
  local reason="$1" code="${2:-0}"
  set_kv status stopped
  set_kv stop_reason "$reason"
  echo "STOP reason=$reason"
  exit "$code"
}

require_state() {
  [ -n "$STATE" ] || die "--state is required"
  [ -f "$STATE" ] || die "state file not found: $STATE"
}

cmd_init() {
  [ -n "$STATE" ] || die "--state is required"
  [ -n "$MODE" ] || die "--mode is required"
  if [ -f "$STATE" ] && [ "$FORCE" != "1" ] && [ "$(get status)" = "running" ]; then
    die "state file '$STATE' is already running; resume it with 'loop-state.sh next --state $STATE' instead of re-initializing, or pass --force to discard it and start over"
  fi
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
      echo "best_metric="
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
    # Without noglob, an item id containing a glob character would be
    # pathname-expanded against the cwd instead of used verbatim.
    set -f
    for id in ${ITEMS//,/ }; do
      echo "item:$id:pending:0:0" >>"$STATE"
    done
    set +f
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
  local better=0 best_metric new_hash

  if [ -n "$METRIC" ]; then
    best_metric="$(get best_metric)"
    if [ -z "$best_metric" ] || [ "$METRIC" -lt "$best_metric" ]; then
      better=1
      set_kv best_metric "$METRIC"
    fi
    set_kv last_metric "$METRIC"
  else
    echo "loop-state: warning: no --metric given, stuck detection degraded to output-hash comparison (unreliable — most verify output embeds timings/PIDs/paths that change every run)" >&2
    new_hash="$(hash_of "$OUTPUT")"
    if [ "$new_hash" != "$(get last_hash)" ]; then
      better=1
    fi
    set_kv last_hash "$new_hash"
  fi

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
  [ "$(get status)" = "running" ] || stop "$(get stop_reason)"
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
  if [ "$GLOBAL_AUDIT" != "1" ]; then
    [ "$(get status)" = "running" ] || stop "$(get stop_reason)"
  fi
  [ -n "$VERDICT" ] || die "--verdict is required"

  if [ "$GLOBAL_AUDIT" = "1" ]; then
    [ "$(get mode)" = "plan" ] || die "--global-audit only applies to plan mode"
    set_kv final_verdict "$VERDICT"
    echo "STOP reason=$(get stop_reason) verdict=$VERDICT"
    [ "$VERDICT" = "clean" ] || exit 1
    return
  fi

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
  case "$STATE_VALUE" in
  manual | blocked) ;;
  *) die "--state-value must be one of: manual, blocked" ;;
  esac
  set_item "$ITEM" "$STATE_VALUE" "$(item_field "$ITEM" 4)" "$(item_field "$ITEM" 5)"
  echo "ITEM item=$ITEM state=$STATE_VALUE"
}

cmd_scope_check() {
  require_state
  [ -n "$ALLOW" ] || die "--allow is required"
  local f status path pat matched denied escaped=0 count=0 mode rename_pending=0
  local root state_abs state_dir_abs own_prefix=""

  mode="$(get mode)"

  # The controller's own artifacts (state file, contract, captured verify
  # output) live beside each other and are not the worker's doing. Without
  # this, a target repo that does not gitignore the contract directory sees
  # its own state file as an out-of-scope change and stops the run before
  # any work happens.
  root="$(git rev-parse --show-toplevel 2>/dev/null)" || root=""
  if [ -n "$root" ] && [ -d "$(dirname "$STATE")" ]; then
    state_abs="$(cd "$(dirname "$STATE")" && pwd)/$(basename "$STATE")"
    state_dir_abs="$(dirname "$state_abs")"
    case "$state_dir_abs/" in
    "$root"/*) own_prefix="${state_dir_abs#"$root"/}/" ;;
    esac
  fi

  # Without noglob the unquoted pattern lists below are pathname-expanded
  # against the working tree, turning "src/**" into whatever happens to
  # exist. `git status --porcelain -z` NUL-delimits records and never
  # quotes paths, so paths containing spaces survive intact; a rename/copy
  # record is split into two NUL-terminated fields (new path, then old
  # path) which we handle explicitly below.
  set -f
  while IFS= read -r -d '' f; do
    if [ "$rename_pending" = "1" ]; then
      rename_pending=0
      continue
    fi
    status="${f:0:2}"
    path="${f:3}"
    case "$status" in
    R* | C*) rename_pending=1 ;;
    esac

    if [ -n "$own_prefix" ]; then
      case "$path" in
      "$own_prefix"*) continue ;;
      esac
    fi

    count=$((count + 1))
    matched=0
    for pat in ${ALLOW//,/ }; do
      # shellcheck disable=SC2254 # pattern is intentionally unquoted
      case "$path" in
      $pat)
        matched=1
        break
        ;;
      esac
    done

    if [ "$matched" = "0" ]; then
      echo "SCOPE escape file=$path reason=not-allowed"
      escaped=1
      continue
    fi

    if [ -n "$DENY" ]; then
      denied=0
      for pat in ${DENY//,/ }; do
        # shellcheck disable=SC2254 # pattern is intentionally unquoted
        case "$path" in
        $pat)
          denied=1
          break
          ;;
        esac
      done
      if [ "$denied" = "1" ]; then
        echo "SCOPE escape file=$path reason=denied"
        escaped=1
      fi
    fi
  done < <(git status --porcelain -z -uall)
  set +f

  if [ "$escaped" = "1" ]; then
    if [ "$mode" = "goal" ]; then
      # The one hard safety guard: a goal-mode escape stops the whole run.
      stop scope-escape 1
    fi
    [ -n "$ITEM" ] || die "--item is required to record a plan-mode scope escape"
    set_item "$ITEM" blocked "$(item_field "$ITEM" 4)" "$(item_field "$ITEM" 5)"
    echo "ITEM item=$ITEM state=blocked reason=scope-escape"
    exit 1
  fi

  echo "SCOPE ok changed=$count"
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
  --state) STATE="$2"; shift 2 ;;
  --mode) MODE="$2"; shift 2 ;;
  --max-iterations) MAX_ITERATIONS="$2"; shift 2 ;;
  --no-progress) NO_PROGRESS="$2"; shift 2 ;;
  --per-item) PER_ITEM="$2"; shift 2 ;;
  --global) GLOBAL_MAX="$2"; shift 2 ;;
  --items) ITEMS="$2"; shift 2 ;;
  --exit) EXIT_CODE="$2"; shift 2 ;;
  --output) OUTPUT="$2"; shift 2 ;;
  --metric) METRIC="$2"; shift 2 ;;
  --item) ITEM="$2"; shift 2 ;;
  --verdict) VERDICT="$2"; shift 2 ;;
  --state-value) STATE_VALUE="$2"; shift 2 ;;
  --allow) ALLOW="$2"; shift 2 ;;
  --deny) DENY="$2"; shift 2 ;;
  --global-audit) GLOBAL_AUDIT=1; shift ;;
  --force) FORCE=1; shift ;;
  *) die "unknown flag: $1" ;;
  esac
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
