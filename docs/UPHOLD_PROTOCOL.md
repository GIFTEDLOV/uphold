# Uphold protocol

Uphold is a commitment-bond registry. A promisor publishes a bounded statement,
escrows GEN behind it, and names a beneficiary. The protocol records the source
evidence and only changes economic state after deterministic authorization and
bounded validator agreement.

## Live-snapshot evidence

Protocol evidence is captured from the exact HTTPS/HTTP source URL registered in
the commitment:

1. Each validator calls `gl.nondet.web.get(source_url)`.
2. The response status, full-response SHA-256, exact byte length, capture
   timestamp, and bounded normalized text are compared under strict equality.
3. The authenticated snapshot is stored only after that consensus succeeds.
4. The baseline is semantically checked and must classify `HOLDS` before the
   commitment is created.
5. A later check fetches the same registered URL, stores a new immutable
   snapshot, and compares it with the stored baseline.

The runtime exposes the response status and body used here. It does not expose a
trusted final redirect URL or response headers to this contract, so Uphold does
not invent redirect guarantees. The registered URL is the binding identity and
the returned status/body are the authenticated evidence.

The full response is hashed and sized before normalization. Stable text is
extracted from the response and bounded to 32 KiB for storage and semantic
comparison; the cap is not raised for large homepages.

Snapshots are write-once records bound to the commitment, sequence, source URL,
capture timestamp, HTTP status, digest, byte length, normalized content, and
classification. Baselines and historical checks cannot be replaced. Semantic
assessment reads only stored authenticated snapshots and performs no additional
web fetch.

## Failure separation

Infrastructure and access failures do not become negative evidence:

- timeout, connection failure, HTTP 5xx, 408, or 429: `SOURCE_UNAVAILABLE`;
- HTTP 401, 403, or another inaccessible non-success response:
  `SOURCE_INACCESSIBLE`;
- a consensual 404/410 snapshot may be assessed as `ABSENT`, but one observation
  never claims breach;
- validator disagreement or malformed capture data fails closed without a
  snapshot or weakening-streak mutation.

The permitted semantic classifications remain `HOLDS`, `WEAKENED`, `ABSENT`,
and `INDETERMINATE`. Only the classification is consensus-critical; excerpts and
short reasons are bounded audit metadata.

Two distinct consecutive qualified negative snapshots are still required before
`BREACH_CLAIMED`. `HOLDS` resets the streak and `INDETERMINATE` does not advance
it. Contest, settlement, refund, accounting, and external EOA transfer rules
remain unchanged. A contest refers to an already authenticated snapshot rather
than accepting arbitrary caller-supplied web content.

## Public interface

The existing eight writes and seven views remain available. The legacy
`baseline_archive_timestamp` argument and archive-named response fields are
retained for ABI/frontend compatibility, but creation ignores the caller value
and fills those aliases with the live capture timestamp. Wayback, CDX, and the
Availability API are optional off-chain research or recovery tools only; they are
not required by `create_commitment`, `check_commitment`, contest, or adjudication.

The protocol advertises version `live-snapshot-v1.0`. The previous empty live
deployment and earlier archive-based experiments remain historical provenance;
they are not silently rewritten.
