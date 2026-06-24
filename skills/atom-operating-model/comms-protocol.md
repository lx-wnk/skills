# ATOM Communication Protocol

Rules governing how agents talk to each other and to the PM.

## Peer-to-Peer Communication

Peer→peer `SendMessage` is allowed and encouraged (info requests, handoffs, interface alignment, mutual clarification). Workers do not need to route every exchange through the PM — direct coordination is the fast path for routine questions between streams.

## PM Authority

The PM owns all decisions (scope, merge, conflicts, abort); workers report task outcomes to the PM. Workers resolve what they can peer-to-peer, but any decision that changes scope, introduces a conflict, or requires aborting a stream belongs to the PM.

## Contracts-First

For file-disjoint decomposition the PM fixes shared contracts (types/API signatures) BEFORE workers start. Contracts are settled up front so mid-run coordination is the exception, not the norm. A worker that discovers a missing contract must surface it to the PM immediately rather than inventing a local definition.

## Anti-Loop Guards

Peer comms are bounded by four interlocking rules:

1. **Peer-comms budget** — each pair of workers has a max N round-trips; once the budget is exhausted, both workers escalate to the PM instead of continuing.
2. **PM freeze** — the PM can freeze comms between specific peers (or all peers) at any time; frozen workers may not exchange messages until the PM lifts the freeze.
3. **Progress before talk** — a worker may not communicate without delivering; every message must be accompanied by, or follow, concrete progress on the assigned task. Talking without delivering is a budget violation.
4. **Escalate on stall** — if a peer exchange has not unblocked a worker after N round-trips, the worker stops the exchange and reports the blocker to the PM.
