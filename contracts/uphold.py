# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""Uphold commitment bonds.

The contract authenticates bounded live-source snapshots before making any
semantic or economic decision. Wayback/CDX is deliberately not part of the
authoritative protocol path. The archive-named public fields are retained as
compatibility aliases for the existing frontend and now contain live capture
timestamps.
"""

from dataclasses import dataclass
import datetime as dt
import html
import hashlib
import json
import re
from urllib.parse import urlsplit

import genlayer as gl
from genlayer.storage import allow as allow_storage


MAX_ID_LENGTH = 64
MAX_TITLE_LENGTH = 120
MAX_CATEGORY_LENGTH = 48
MAX_URL_LENGTH = 512
MAX_COMMITMENT_LENGTH = 2_000
MAX_ARCHIVE_BYTES = 32_768
MAX_EXCERPT_LENGTH = 320
MAX_REASON_LENGTH = 480
MAX_HISTORY_ENTRIES = 64
MAX_COMMITMENTS = 1_000
MAX_CHECKS = 128
MAX_LISTING = 100
MAX_COMMITMENT_SECONDS = 365 * 24 * 60 * 60
MIN_CONTEST_WINDOW_SECONDS = 60 * 60
MAX_CONTEST_WINDOW_SECONDS = 30 * 24 * 60 * 60
AUTHENTICATED_SNAPSHOT = "AUTHENTICATED"
UNASSESSED_SNAPSHOT = "UNASSESSED"
SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
SOURCE_INACCESSIBLE = "SOURCE_INACCESSIBLE"
EVIDENCE_INVALID = "EVIDENCE_INVALID"

ACTIVE = "ACTIVE"
BREACH_CLAIMED = "BREACH_CLAIMED"
CONTESTED = "CONTESTED"
BREACH_CONFIRMED = "BREACH_CONFIRMED"
SETTLED = "SETTLED"
COMPLETED = "COMPLETED"
PAYOUT_PENDING = "PAYOUT_PENDING"
REFUND_PENDING = "REFUND_PENDING"

HOLDS = "HOLDS"
WEAKENED = "WEAKENED"
ABSENT = "ABSENT"
INDETERMINATE = "INDETERMINATE"

QUALIFIED_NEGATIVES = (WEAKENED, ABSENT)


@gl.evm.contract_interface
class _Recipient:
    """Native-value external-message interface for an EOA recipient."""

    class View:
        pass

    class Write:
        pass


@allow_storage
@dataclass
class EvidenceSnapshot:
    snapshot_id: str
    commitment_id: str
    sequence: gl.u256
    source_url: str
    capture_timestamp: str
    http_status: gl.u256
    sha256: str
    byte_length: gl.u256
    normalized_content: str
    captured_state: str
    classification: str


@allow_storage
@dataclass
class Commitment:
    commitment_id: str
    title: str
    category: str
    promisor: gl.Address
    beneficiary: gl.Address
    source_url: str
    commitment_text: str
    baseline_archive_timestamp: str
    baseline_digest: str
    baseline_body_digest: str
    baseline_excerpt: str
    baseline_snapshot_id: str
    baseline_byte_length: gl.u256
    created_at: str
    expires_at: str
    contest_window_seconds: gl.u256
    original_stake: gl.u256
    current_stake: gl.u256
    total_stake_added: gl.u256
    status: str
    last_checked_at: str
    last_observed_archive_timestamp: str
    last_snapshot_id: str
    last_qualified_archive_timestamp: str
    last_qualified_digest: str
    checks_run: gl.u256
    consecutive_negative_count: gl.u256
    breach_claimed_at: str
    contest_deadline: str
    breach_capture_1: str
    breach_capture_2: str
    breach_digest_1: str
    breach_digest_2: str
    contest_evidence_url: str
    contest_evidence_timestamp: str
    contest_evidence_digest: str
    contest_evidence_snapshot_id: str
    contest_result: str
    final_settlement_at: str
    final_settlement_amount: gl.u256
    pending_transfer_recipient: gl.Address
    pending_transfer_amount: gl.u256
    pending_transfer_kind: str
    pending_transfer_requested_at: str
    extensions_count: gl.u256
    stake_additions_count: gl.u256


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _now_iso() -> str:
    return _now().isoformat().replace("+00:00", "Z")


def _canonical_iso(value: str) -> str:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat().replace(
        "+00:00", "Z"
    )


def _parse_iso(value: str) -> dt.datetime | None:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(dt.timezone.utc)


def _valid_url(value: str) -> bool:
    if not isinstance(value, str) or not value or len(value) > MAX_URL_LENGTH:
        return False
    if any(char.isspace() for char in value):
        return False
    try:
        parts = urlsplit(value)
    except ValueError:
        return False
    return (
        parts.scheme in ("http", "https")
        and bool(parts.netloc)
        and parts.username is None
        and parts.password is None
        and not parts.fragment
    )


def _anchor_tokens(commitment_text: str) -> list[str]:
    tokens: list[str] = []
    for raw in commitment_text.lower().replace("\n", " ").split(" "):
        token = raw.strip(".,:;!?()[]{}\"'")
        if len(token) >= 4 and token not in tokens:
            tokens.append(token)
        if len(tokens) == 4:
            break
    return tokens


def _baseline_supports_commitment(commitment_text: str, normalized_content: str) -> bool:
    tokens = _anchor_tokens(commitment_text)
    if len(tokens) < 2:
        return bool(normalized_content)
    lower_content = normalized_content.lower()
    return sum(token in lower_content for token in tokens) >= 2


def _bounded_normalized_text(document_bytes: bytes, status: int) -> str | None:
    """Extract bounded stable text while hashing and sizing the full response."""
    if status in (404, 410):
        return "HTTP " + str(status)
    try:
        document = document_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return None
    document = re.sub(
        r"(?is)<(script|style|noscript|template)\b[^>]*>.*?</\1>",
        " ",
        document,
    )
    document = re.sub(r"(?s)<[^>]*>", " ", document)
    normalized = " ".join(html.unescape(document).split())
    if not normalized:
        return None
    encoded = normalized.encode("utf-8")
    if len(encoded) > MAX_ARCHIVE_BYTES:
        normalized = encoded[:MAX_ARCHIVE_BYTES].decode("utf-8", "ignore").rstrip()
    return normalized or None


def _fetch_live_capture(source_url: str, capture_timestamp: str, allow_not_found: bool) -> dict:
    """Fetch only the registered URL; no redirect target or headers are assumed visible."""
    try:
        response = gl.nondet.web.get(source_url)
    except Exception:
        return {"ok": False, "domain": "SOURCE", "reason": SOURCE_UNAVAILABLE}

    status = getattr(response, "status", None)
    if not isinstance(status, int):
        return {"ok": False, "domain": "SOURCE", "reason": SOURCE_UNAVAILABLE}
    if status >= 500 or status in (408, 429):
        return {"ok": False, "domain": "SOURCE", "reason": SOURCE_UNAVAILABLE}
    if status in (401, 403):
        return {"ok": False, "domain": "SOURCE", "reason": SOURCE_INACCESSIBLE}
    if status in (404, 410):
        if not allow_not_found:
            return {"ok": False, "domain": "SOURCE", "reason": SOURCE_INACCESSIBLE}
    elif status != 200:
        return {"ok": False, "domain": "SOURCE", "reason": SOURCE_INACCESSIBLE}

    response_bytes = getattr(response, "body", None)
    if not isinstance(response_bytes, bytes):
        return {"ok": False, "domain": "EVIDENCE", "reason": EVIDENCE_INVALID}
    normalized_content = _bounded_normalized_text(response_bytes, status)
    if normalized_content is None:
        return {"ok": False, "domain": "EVIDENCE", "reason": EVIDENCE_INVALID}
    digest = hashlib.sha256(response_bytes).hexdigest()
    return {
        "ok": True,
        "source_url": source_url,
        "capture_timestamp": capture_timestamp,
        "http_status": status,
        "sha256": digest,
        "byte_length": len(response_bytes),
        "normalized_content": normalized_content,
        "excerpt": normalized_content[:MAX_EXCERPT_LENGTH],
    }


def _snapshot_from_capture(
    commitment_id: str, sequence: int, capture: dict, classification: str
) -> EvidenceSnapshot:
    return EvidenceSnapshot(
        snapshot_id=commitment_id + ":" + str(sequence),
        commitment_id=commitment_id,
        sequence=gl.u256(sequence),
        source_url=capture["source_url"],
        capture_timestamp=capture["capture_timestamp"],
        http_status=gl.u256(int(capture["http_status"])),
        sha256=capture["sha256"],
        byte_length=gl.u256(int(capture["byte_length"])),
        normalized_content=capture["normalized_content"],
        captured_state=AUTHENTICATED_SNAPSHOT,
        classification=classification,
    )


def _authenticated_live_capture(
    source_url: str, capture_timestamp: str, allow_not_found: bool
) -> dict:
    """Require validators to agree on the bounded live response snapshot."""
    def capture_leader() -> str:
        return json.dumps(
            _fetch_live_capture(source_url, capture_timestamp, allow_not_found),
            sort_keys=True,
            separators=(",", ":"),
        )

    try:
        result = gl.eq_principle.strict_eq(capture_leader)
        decoded = json.loads(result)
        if not isinstance(decoded, dict):
            return {"ok": False, "domain": "TRANSIENT", "reason": "validator_disagreement"}
        return decoded
    except Exception:
        return {"ok": False, "domain": "TRANSIENT", "reason": "validator_disagreement"}


def _decode_semantic_output(raw) -> dict | None:
    """Return only bounded semantic fields from an LLM response."""
    parsed = raw
    for _ in range(2):
        if not isinstance(parsed, str):
            break
        try:
            parsed = json.loads(parsed)
        except (TypeError, ValueError):
            return None
    if not isinstance(parsed, dict):
        return None
    classification = parsed.get("classification")
    excerpt = parsed.get("excerpt", "")
    short_reason = parsed.get("short_reason", "")
    if not isinstance(classification, str):
        return None
    if not isinstance(excerpt, str) or not isinstance(short_reason, str):
        return None
    if len(excerpt) > MAX_EXCERPT_LENGTH or len(short_reason) > MAX_REASON_LENGTH:
        return None
    return {
        "classification": classification,
        "excerpt": excerpt,
        "short_reason": short_reason,
    }


def _semantic_leader(
    commitment_text: str,
    baseline_snapshot: EvidenceSnapshot,
    current_snapshot: EvidenceSnapshot,
) -> dict:
    prompt = f"""
You are the Uphold semantic adjudicator. Answer only the bounded question below.
Compare the original commitment with the authenticated baseline snapshot and the
authenticated current snapshot. Decide whether the current snapshot still
substantially carries the original commitment, materially weakens it, or removes it.

Original commitment:
{commitment_text}

Authenticated baseline snapshot:
source URL: {baseline_snapshot.source_url}
capture timestamp: {baseline_snapshot.capture_timestamp}
HTTP status: {int(baseline_snapshot.http_status)}
SHA-256: {baseline_snapshot.sha256}
byte length: {int(baseline_snapshot.byte_length)}
normalized content: {baseline_snapshot.normalized_content}

Authenticated current snapshot:
source URL: {current_snapshot.source_url}
capture timestamp: {current_snapshot.capture_timestamp}
HTTP status: {int(current_snapshot.http_status)}
SHA-256: {current_snapshot.sha256}
byte length: {int(current_snapshot.byte_length)}
normalized content: {current_snapshot.normalized_content}

Return exactly one JSON object with this schema:
{{"classification":"HOLDS|WEAKENED|ABSENT|INDETERMINATE","excerpt":"short quote","short_reason":"short reason"}}
Only classification may affect protocol state. The HTTP status is evidence, not an
automatic protocol classification. Do not discuss payment, dates, authorization,
admissibility, or settlement.
"""
    try:
        raw = gl.nondet.exec_prompt(prompt, response_format="json")
    except Exception:
        return {"classification": "__MODEL_ERROR__", "excerpt": "", "short_reason": ""}
    parsed = _decode_semantic_output(raw)
    return parsed or {"classification": "__MALFORMED__", "excerpt": "", "short_reason": ""}


def _semantic_judgment(
    commitment_text: str,
    baseline_snapshot: EvidenceSnapshot,
    current_snapshot: EvidenceSnapshot | None = None,
) -> dict:
    if current_snapshot is None:
        current_snapshot = baseline_snapshot
    if not isinstance(baseline_snapshot, EvidenceSnapshot) or not isinstance(
        current_snapshot, EvidenceSnapshot
    ):
        return {"ok": False, "domain": "EVIDENCE", "reason": "invalid_evidence_snapshot"}
    if (
        baseline_snapshot.captured_state != AUTHENTICATED_SNAPSHOT
        or current_snapshot.captured_state != AUTHENTICATED_SNAPSHOT
    ):
        return {"ok": False, "domain": "EVIDENCE", "reason": "snapshot_not_authenticated"}
    if baseline_snapshot.source_url != current_snapshot.source_url:
        return {"ok": False, "domain": "EVIDENCE", "reason": "snapshot_source_mismatch"}

    def semantic_leader() -> dict:
        return _semantic_leader(commitment_text, baseline_snapshot, current_snapshot)

    def semantic_validator(result) -> bool:
        if not isinstance(result, gl.vm.Return):
            return False
        leader = _decode_semantic_output(result.calldata)
        if leader is None or leader.get("classification") not in (
            HOLDS,
            WEAKENED,
            ABSENT,
            INDETERMINATE,
        ):
            return False
        validator = _decode_semantic_output(
            _semantic_leader(commitment_text, baseline_snapshot, current_snapshot)
        )
        if validator is None or validator.get("classification") not in (
            HOLDS,
            WEAKENED,
            ABSENT,
            INDETERMINATE,
        ):
            return False
        return validator["classification"] == leader["classification"]

    try:
        parsed = gl.vm.run_nondet(semantic_leader, semantic_validator)
    except Exception:
        return {"ok": False, "domain": "TRANSIENT", "reason": "validator_disagreement"}
    parsed = _decode_semantic_output(parsed)
    if parsed is None:
        return {"ok": False, "domain": "LLM", "reason": "malformed_model_output"}
    classification = parsed["classification"]
    excerpt = parsed["excerpt"]
    short_reason = parsed["short_reason"]
    if classification not in (HOLDS, WEAKENED, ABSENT, INDETERMINATE):
        return {"ok": False, "domain": "LLM", "reason": "unknown_classification"}
    return {
        "ok": True,
        "classification": classification,
        "excerpt": excerpt,
        "short_reason": short_reason,
    }


class Uphold(gl.contract.Contract):
    """A commitment bond registry with authenticated live-source evidence."""

    commitments: gl.storage.TreeMap[str, Commitment]
    evidence_snapshots: gl.storage.TreeMap[str, EvidenceSnapshot]
    history: gl.storage.TreeMap[str, str]
    address_records: gl.storage.TreeMap[str, str]
    commitment_ids_json: str
    total_escrowed: gl.u256
    total_deposited: gl.u256
    total_paid_to_beneficiaries: gl.u256
    total_returned_to_promisors: gl.u256
    total_pending_outflows: gl.u256
    total_pending_payouts: gl.u256
    total_pending_refunds: gl.u256
    commitments_created: gl.u256
    checks_run: gl.u256
    breach_claims: gl.u256
    contests_filed: gl.u256
    contests_upheld: gl.u256
    contests_rejected: gl.u256
    commitments_completed: gl.u256
    pending_commitments: gl.u256

    def __init__(self):
        self.commitment_ids_json = "[]"
        self.total_escrowed = gl.u256(0)
        self.total_deposited = gl.u256(0)
        self.total_paid_to_beneficiaries = gl.u256(0)
        self.total_returned_to_promisors = gl.u256(0)
        self.total_pending_outflows = gl.u256(0)
        self.total_pending_payouts = gl.u256(0)
        self.total_pending_refunds = gl.u256(0)
        self.commitments_created = gl.u256(0)
        self.checks_run = gl.u256(0)
        self.breach_claims = gl.u256(0)
        self.contests_filed = gl.u256(0)
        self.contests_upheld = gl.u256(0)
        self.contests_rejected = gl.u256(0)
        self.commitments_completed = gl.u256(0)
        self.pending_commitments = gl.u256(0)

    def _require(self, condition: bool, message: str) -> None:
        if not condition:
            raise gl.vm.UserError(message)

    def _get(self, commitment_id: str) -> Commitment:
        self._require(commitment_id in self.commitments, "commitment not found")
        return self.commitments[commitment_id]

    def _store_snapshot(self, snapshot: EvidenceSnapshot) -> None:
        # EvidenceSnapshot is protocol-immutable: a bound id may be inserted once,
        # and every later attempt must reproduce the exact authenticated value.
        self._require(
            snapshot.captured_state == AUTHENTICATED_SNAPSHOT,
            "evidence snapshot is not authenticated",
        )
        if snapshot.snapshot_id in self.evidence_snapshots:
            existing = self.evidence_snapshots[snapshot.snapshot_id]
            self._require(
                existing.commitment_id == snapshot.commitment_id
                and int(existing.sequence) == int(snapshot.sequence)
                and existing.source_url == snapshot.source_url
                and existing.capture_timestamp == snapshot.capture_timestamp
                and int(existing.http_status) == int(snapshot.http_status)
                and existing.sha256 == snapshot.sha256
                and int(existing.byte_length) == int(snapshot.byte_length)
                and existing.normalized_content == snapshot.normalized_content
                and existing.captured_state == snapshot.captured_state
                and existing.classification == snapshot.classification,
                "evidence snapshot binding conflict",
            )
            return
        self.evidence_snapshots[snapshot.snapshot_id] = snapshot

    def _get_snapshot(self, snapshot_id: str) -> EvidenceSnapshot:
        self._require(snapshot_id in self.evidence_snapshots, "evidence snapshot not found")
        return self.evidence_snapshots[snapshot_id]

    def _find_snapshot_by_capture_timestamp(
        self, commitment: Commitment, capture_timestamp: str
    ) -> EvidenceSnapshot | None:
        # The sequence is bounded by MAX_CHECKS and makes lookup deterministic
        # without exposing a mutable iterator over storage.
        for sequence in range(int(commitment.checks_run) + 1):
            snapshot_id = commitment.commitment_id + ":" + str(sequence)
            if snapshot_id not in self.evidence_snapshots:
                continue
            snapshot = self.evidence_snapshots[snapshot_id]
            if snapshot.capture_timestamp == capture_timestamp:
                return snapshot
        return None

    def _require_active(self, commitment: Commitment) -> None:
        self._require(commitment.status == ACTIVE, "commitment is not active")

    def _record_history(self, commitment_id: str, event: dict) -> None:
        try:
            entries = json.loads(self.history.get(commitment_id) or "[]")
        except (TypeError, ValueError):
            entries = []
        if not isinstance(entries, list):
            entries = []
        entries.append(event)
        if len(entries) > MAX_HISTORY_ENTRIES:
            entries = entries[-MAX_HISTORY_ENTRIES:]
        self.history[commitment_id] = json.dumps(entries, sort_keys=True, separators=(",", ":"))

    def _address_record(self, address: gl.Address) -> dict:
        key = address.as_hex
        try:
            record = json.loads(self.address_records.get(key) or "{}")
        except (TypeError, ValueError):
            record = {}
        return record if isinstance(record, dict) else {}

    def _save_address_record(self, address: gl.Address, record: dict) -> None:
        self.address_records[address.as_hex] = json.dumps(
            record, sort_keys=True, separators=(",", ":")
        )

    def _increment_address(self, address: gl.Address, field: str, amount: int = 1) -> None:
        record = self._address_record(address)
        record[field] = int(record.get(field, 0)) + amount
        self._save_address_record(address, record)

    def _add_address_amount(self, address: gl.Address, field: str, amount: int) -> None:
        record = self._address_record(address)
        record[field] = int(record.get(field, 0)) + amount
        self._save_address_record(address, record)

    def _validate_creation_inputs(
        self,
        commitment_id: str,
        title: str,
        category: str,
        source_url: str,
        commitment_text: str,
        beneficiary: str,
        baseline_archive_timestamp: str,
        expires_at: str,
        contest_window_seconds: gl.u256,
    ) -> gl.Address:
        sender = gl.message.sender_address
        self._require(
            isinstance(commitment_id, str)
            and 0 < len(commitment_id) <= MAX_ID_LENGTH
            and commitment_id.strip() == commitment_id,
            "invalid commitment id",
        )
        self._require(0 < len(title) <= MAX_TITLE_LENGTH and title.strip(), "invalid title")
        self._require(0 < len(category) <= MAX_CATEGORY_LENGTH, "invalid category")
        self._require(
            12 <= len(commitment_text) <= MAX_COMMITMENT_LENGTH
            and commitment_text.strip(),
            "invalid commitment text",
        )
        self._require(_valid_url(source_url), "invalid source url")
        expiry_dt = _parse_iso(expires_at)
        self._require(expiry_dt is not None, "invalid expiry")
        now = _now()
        self._require(expiry_dt > now, "expiry must be in the future")
        self._require(
            expiry_dt <= now + dt.timedelta(seconds=MAX_COMMITMENT_SECONDS),
            "expiry exceeds protocol limit",
        )
        window = int(contest_window_seconds)
        self._require(
            MIN_CONTEST_WINDOW_SECONDS <= window <= MAX_CONTEST_WINDOW_SECONDS,
            "invalid contest window",
        )
        self._require(int(gl.message.value) > 0, "stake must be positive")
        try:
            beneficiary_address = gl.Address(beneficiary)
        except Exception:
            raise gl.vm.UserError("invalid beneficiary")
        self._require(beneficiary_address != gl.Address.ZERO, "invalid beneficiary")
        self._require(beneficiary_address != sender, "beneficiary must differ from promisor")
        return beneficiary_address

    @gl.public.write.payable
    def create_commitment(
        self,
        commitment_id: str,
        title: str,
        category: str,
        source_url: str,
        commitment_text: str,
        beneficiary: str,
        baseline_archive_timestamp: str,
        expires_at: str,
        contest_window_seconds: gl.u256,
    ) -> str:
        self._require(commitment_id not in self.commitments, "commitment already exists")
        self._require(len(json.loads(self.commitment_ids_json)) < MAX_COMMITMENTS, "commitment limit reached")
        now = _now_iso()
        beneficiary_address = self._validate_creation_inputs(
            commitment_id,
            title,
            category,
            source_url,
            commitment_text,
            beneficiary,
            baseline_archive_timestamp,
            expires_at,
            contest_window_seconds,
        )
        baseline = _authenticated_live_capture(source_url, now, False)
        if baseline.get("ok") is not True:
            domain = baseline.get("domain", "SOURCE")
            reason = baseline.get("reason", "baseline capture failed")
            self._require(False, "[" + domain + "] " + reason)
        baseline_snapshot = _snapshot_from_capture(
            commitment_id, 0, baseline, UNASSESSED_SNAPSHOT
        )
        self._require(
            _baseline_supports_commitment(
                commitment_text, baseline_snapshot.normalized_content
            ),
            "baseline evidence was not admitted",
        )
        baseline_semantic = _semantic_judgment(
            commitment_text, baseline_snapshot, baseline_snapshot
        )
        self._require(baseline_semantic.get("ok") is True, "baseline semantic judgment failed")
        self._require(
            baseline_semantic.get("classification") == HOLDS,
            "baseline does not support commitment",
        )
        baseline_snapshot.classification = baseline_semantic["classification"]
        self._store_snapshot(baseline_snapshot)
        baseline_snapshot = self._get_snapshot(baseline_snapshot.snapshot_id)
        stake = int(gl.message.value)
        commitment = Commitment(
            commitment_id=commitment_id,
            title=title,
            category=category,
            promisor=gl.message.sender_address,
            beneficiary=beneficiary_address,
            source_url=source_url,
            commitment_text=commitment_text,
            baseline_archive_timestamp=baseline["capture_timestamp"],
            baseline_digest=baseline_snapshot.sha256,
            baseline_body_digest=baseline_snapshot.sha256,
            baseline_excerpt=baseline["excerpt"],
            baseline_snapshot_id=baseline_snapshot.snapshot_id,
            baseline_byte_length=baseline_snapshot.byte_length,
            created_at=now,
            expires_at=_canonical_iso(expires_at),
            contest_window_seconds=gl.u256(int(contest_window_seconds)),
            original_stake=gl.u256(stake),
            current_stake=gl.u256(stake),
            total_stake_added=gl.u256(0),
            status=ACTIVE,
            last_checked_at=now,
            last_observed_archive_timestamp=baseline["capture_timestamp"],
            last_snapshot_id=baseline_snapshot.snapshot_id,
            last_qualified_archive_timestamp="",
            last_qualified_digest="",
            checks_run=gl.u256(0),
            consecutive_negative_count=gl.u256(0),
            breach_claimed_at="",
            contest_deadline="",
            breach_capture_1="",
            breach_capture_2="",
            breach_digest_1="",
            breach_digest_2="",
            contest_evidence_url="",
            contest_evidence_timestamp="",
            contest_evidence_digest="",
            contest_evidence_snapshot_id="",
            contest_result="",
            final_settlement_at="",
            final_settlement_amount=gl.u256(0),
            pending_transfer_recipient=gl.Address.ZERO,
            pending_transfer_amount=gl.u256(0),
            pending_transfer_kind="",
            pending_transfer_requested_at="",
            extensions_count=gl.u256(0),
            stake_additions_count=gl.u256(0),
        )
        self.commitments[commitment_id] = commitment
        ids = json.loads(self.commitment_ids_json)
        ids.append(commitment_id)
        self.commitment_ids_json = json.dumps(ids, separators=(",", ":"))
        self.history[commitment_id] = json.dumps(
            [
                {
                    "event": "CREATED",
                    "at": now,
                    "archive_timestamp": baseline["capture_timestamp"],
                    "capture_timestamp": baseline["capture_timestamp"],
                    "archive_digest": baseline_snapshot.sha256,
                    "body_digest": baseline_snapshot.sha256,
                    "sha256": baseline_snapshot.sha256,
                    "byte_length": int(baseline_snapshot.byte_length),
                    "http_status": int(baseline_snapshot.http_status),
                    "snapshot_id": baseline_snapshot.snapshot_id,
                    "excerpt": baseline["excerpt"],
                    "stake": stake,
                }
            ],
            sort_keys=True,
            separators=(",", ":"),
        )
        self.total_escrowed = gl.u256(int(self.total_escrowed) + stake)
        self.total_deposited = gl.u256(int(self.total_deposited) + stake)
        self.commitments_created = gl.u256(int(self.commitments_created) + 1)
        self._add_address_amount(gl.message.sender_address, "total_gen_bonded", stake)
        self._increment_address(gl.message.sender_address, "commitments_created")
        return commitment_id

    @gl.public.write
    def check_commitment(self, commitment_id: str) -> str:
        commitment = self._get(commitment_id)
        self._require_active(commitment)
        expiry = _parse_iso(commitment.expires_at)
        self._require(expiry is not None and _now() < expiry, "commitment has expired")
        self._require(int(commitment.checks_run) < MAX_CHECKS, "check limit reached")
        now = _now_iso()

        capture = _authenticated_live_capture(commitment.source_url, now, True)
        if capture.get("ok") is not True:
            domain = capture.get("domain", "SOURCE")
            reason = capture.get("reason", "check_failed")
            if not (domain == "TRANSIENT" and reason == "validator_disagreement"):
                self._record_history(
                    commitment_id,
                    {"event": "CHECK_FAILURE", "at": now, "domain": domain, "reason": reason},
                )
            return "[" + domain + "] " + reason

        baseline_snapshot = self._get_snapshot(commitment.baseline_snapshot_id)
        sequence = int(commitment.checks_run) + 1
        snapshot = _snapshot_from_capture(
            commitment_id, sequence, capture, UNASSESSED_SNAPSHOT
        )
        semantic = _semantic_judgment(
            commitment.commitment_text, baseline_snapshot, snapshot
        )
        # No storage or commitment mutation occurs until semantic consensus succeeds.
        if semantic.get("ok") is not True:
            return "[" + semantic.get("domain", "LLM") + "] " + semantic.get("reason", "semantic_failure")

        classification = semantic["classification"]
        snapshot.classification = classification
        self._store_snapshot(snapshot)
        snapshot = self._get_snapshot(snapshot.snapshot_id)
        commitment.checks_run = gl.u256(int(commitment.checks_run) + 1)
        self.checks_run = gl.u256(int(self.checks_run) + 1)
        commitment.last_checked_at = now
        timestamp = capture["capture_timestamp"]
        commitment.last_observed_archive_timestamp = timestamp
        commitment.last_snapshot_id = snapshot.snapshot_id
        if classification == HOLDS:
            commitment.consecutive_negative_count = gl.u256(0)
        elif classification in QUALIFIED_NEGATIVES:
            commitment.consecutive_negative_count = gl.u256(
                int(commitment.consecutive_negative_count) + 1
            )
            commitment.last_qualified_archive_timestamp = timestamp
            commitment.last_qualified_digest = snapshot.sha256
            if not commitment.breach_capture_1:
                commitment.breach_capture_1 = timestamp
                commitment.breach_digest_1 = snapshot.sha256
            elif timestamp != commitment.breach_capture_1:
                commitment.breach_capture_2 = timestamp
                commitment.breach_digest_2 = snapshot.sha256

        self._record_history(
            commitment_id,
            {
                "event": "CHECK",
                "at": now,
                "archive_timestamp": timestamp,
                "capture_timestamp": timestamp,
                "archive_digest": snapshot.sha256,
                "body_digest": snapshot.sha256,
                "sha256": snapshot.sha256,
                "byte_length": int(snapshot.byte_length),
                "http_status": int(snapshot.http_status),
                "snapshot_id": snapshot.snapshot_id,
                "classification": classification,
                "excerpt": semantic["excerpt"][:MAX_EXCERPT_LENGTH],
                "short_reason": semantic["short_reason"][:MAX_REASON_LENGTH],
            },
        )
        if int(commitment.consecutive_negative_count) >= 2:
            commitment.status = BREACH_CLAIMED
            commitment.breach_claimed_at = now
            claimed_dt = _now() + dt.timedelta(seconds=int(commitment.contest_window_seconds))
            commitment.contest_deadline = claimed_dt.isoformat().replace("+00:00", "Z")
            self.breach_claims = gl.u256(int(self.breach_claims) + 1)
            self._record_history(
                commitment_id,
                {
                    "event": "BREACH_CLAIMED",
                    "at": now,
                    "capture_1": commitment.breach_capture_1,
                    "capture_2": commitment.breach_capture_2,
                    "contest_deadline": commitment.contest_deadline,
                },
            )
            return BREACH_CLAIMED
        return classification

    @gl.public.write.payable
    def increase_stake(self, commitment_id: str) -> str:
        commitment = self._get(commitment_id)
        self._require(commitment.promisor == gl.message.sender_address, "only promisor may increase stake")
        self._require_active(commitment)
        amount = int(gl.message.value)
        self._require(amount > 0, "stake increase must be positive")
        commitment.current_stake = gl.u256(int(commitment.current_stake) + amount)
        commitment.total_stake_added = gl.u256(int(commitment.total_stake_added) + amount)
        commitment.stake_additions_count = gl.u256(int(commitment.stake_additions_count) + 1)
        self.total_escrowed = gl.u256(int(self.total_escrowed) + amount)
        self.total_deposited = gl.u256(int(self.total_deposited) + amount)
        self._add_address_amount(gl.message.sender_address, "total_gen_bonded", amount)
        self._record_history(
            commitment_id,
            {"event": "STAKE_INCREASED", "at": _now_iso(), "amount": amount},
        )
        return "STAKE_INCREASED"

    @gl.public.write
    def extend_commitment(self, commitment_id: str, new_expiry: str) -> str:
        commitment = self._get(commitment_id)
        self._require(commitment.promisor == gl.message.sender_address, "only promisor may extend")
        self._require_active(commitment)
        old_expiry = _parse_iso(commitment.expires_at)
        parsed = _parse_iso(new_expiry)
        self._require(parsed is not None, "invalid expiry")
        self._require(old_expiry is not None and parsed > old_expiry, "expiry must move forward")
        self._require(parsed <= _now() + dt.timedelta(seconds=MAX_COMMITMENT_SECONDS), "expiry exceeds protocol limit")
        commitment.expires_at = _canonical_iso(new_expiry)
        commitment.extensions_count = gl.u256(int(commitment.extensions_count) + 1)
        self._record_history(
            commitment_id,
            {"event": "EXTENDED", "at": _now_iso(), "new_expiry": commitment.expires_at},
        )
        return "EXTENDED"

    @gl.public.write
    def contest_breach(
        self, commitment_id: str, evidence_url: str, evidence_timestamp: str
    ) -> str:
        commitment = self._get(commitment_id)
        self._require(commitment.status == BREACH_CLAIMED, "commitment is not contestable")
        self._require(commitment.promisor == gl.message.sender_address, "only promisor may contest")
        deadline = _parse_iso(commitment.contest_deadline)
        self._require(deadline is not None and _now() < deadline, "contest window expired")
        self._require(evidence_url == commitment.source_url, "contest must use original source")
        timestamp_dt = _parse_iso(evidence_timestamp)
        self._require(timestamp_dt is not None and timestamp_dt <= _now(), "invalid contest timestamp")
        self._require(
            evidence_timestamp not in (commitment.breach_capture_1, commitment.breach_capture_2),
            "contest capture already used",
        )
        evidence = self._find_snapshot_by_capture_timestamp(commitment, evidence_timestamp)
        if evidence is None:
            return "[EVIDENCE] contest snapshot not found"
        commitment.status = CONTESTED
        commitment.contest_evidence_url = evidence_url
        commitment.contest_evidence_timestamp = evidence.capture_timestamp
        snapshot = evidence
        commitment.contest_evidence_digest = snapshot.sha256
        commitment.contest_evidence_snapshot_id = snapshot.snapshot_id
        self.contests_filed = gl.u256(int(self.contests_filed) + 1)
        self._record_history(
            commitment_id,
            {
                "event": "CONTEST_FILED",
                "at": _now_iso(),
                "evidence_timestamp": evidence.capture_timestamp,
                "capture_timestamp": evidence.capture_timestamp,
                "evidence_digest": snapshot.sha256,
                "snapshot_id": snapshot.snapshot_id,
                "http_status": int(snapshot.http_status),
                "byte_length": int(snapshot.byte_length),
                "excerpt": snapshot.normalized_content[:MAX_EXCERPT_LENGTH],
            },
        )
        return CONTESTED

    @gl.public.write
    def adjudicate_contest(self, commitment_id: str) -> str:
        commitment = self._get(commitment_id)
        self._require(commitment.status == CONTESTED, "no active contest")
        try:
            evidence = self._get_snapshot(commitment.contest_evidence_snapshot_id)
        except Exception:
            return "[EVIDENCE] contest evidence snapshot missing"
        baseline = self._get_snapshot(commitment.baseline_snapshot_id)
        semantic = _semantic_judgment(commitment.commitment_text, baseline, evidence)
        if semantic.get("ok") is not True:
            return "[" + semantic.get("domain", "LLM") + "] " + semantic.get("reason", "contest judgment failed")
        classification = semantic["classification"]
        if classification == HOLDS:
            commitment.status = ACTIVE
            commitment.consecutive_negative_count = gl.u256(0)
            commitment.last_observed_archive_timestamp = commitment.contest_evidence_timestamp
            commitment.contest_result = "UPHELD"
            self.contests_upheld = gl.u256(int(self.contests_upheld) + 1)
            self._increment_address(commitment.promisor, "contests_won")
            self._record_history(
                commitment_id,
                {"event": "CONTEST_UPHELD", "at": _now_iso(), "classification": classification},
            )
            return "CONTEST_UPHELD"
        if classification not in QUALIFIED_NEGATIVES:
            return "[LLM] contest judgment indeterminate"
        commitment.status = BREACH_CONFIRMED
        commitment.contest_result = "REJECTED"
        self.contests_rejected = gl.u256(int(self.contests_rejected) + 1)
        self._increment_address(commitment.promisor, "breached")
        self._increment_address(commitment.promisor, "contests_lost")
        self._record_history(
            commitment_id,
            {"event": "CONTEST_REJECTED", "at": _now_iso(), "classification": classification},
        )
        return BREACH_CONFIRMED

    def _confirm_breach_if_due(self, commitment: Commitment) -> None:
        if commitment.status == BREACH_CLAIMED:
            deadline = _parse_iso(commitment.contest_deadline)
            self._require(deadline is not None and _now() >= deadline, "contest window is still open")
            commitment.status = BREACH_CONFIRMED
            self._increment_address(commitment.promisor, "breached")
            self._record_history(
                commitment.commitment_id,
                {"event": "BREACH_CONFIRMED", "at": _now_iso(), "reason": "contest_window_elapsed"},
            )
        self._require(commitment.status == BREACH_CONFIRMED, "breach is not settleable")

    def _pay(self, recipient: gl.Address, amount: gl.u256) -> None:
        """Request one finalized native-value transfer to an EOA."""
        self._require(recipient != gl.Address.ZERO, "invalid transfer recipient")
        self._require(int(amount) > 0, "transfer amount must be positive")
        _Recipient(recipient).emit_transfer(value=gl.u256(int(amount)))

    def _request_transfer(
        self,
        commitment: Commitment,
        recipient: gl.Address,
        amount: int,
        kind: str,
        status: str,
    ) -> str:
        self._require(commitment.pending_transfer_amount == gl.u256(0), "transfer already pending")
        self._require(amount > 0, "transfer amount must be positive")
        now = _now_iso()
        commitment.current_stake = gl.u256(0)
        commitment.pending_transfer_recipient = recipient
        commitment.pending_transfer_amount = gl.u256(amount)
        commitment.pending_transfer_kind = kind
        commitment.pending_transfer_requested_at = now
        commitment.status = status
        self.pending_commitments = gl.u256(int(self.pending_commitments) + 1)
        self.total_escrowed = gl.u256(int(self.total_escrowed) - amount)
        self.total_pending_outflows = gl.u256(int(self.total_pending_outflows) + amount)
        if kind == "PAYOUT":
            self.total_pending_payouts = gl.u256(int(self.total_pending_payouts) + amount)
            event = "PAYOUT_REQUESTED"
        else:
            self.total_pending_refunds = gl.u256(int(self.total_pending_refunds) + amount)
            event = "REFUND_REQUESTED"
        self._record_history(
            commitment.commitment_id,
            {
                "event": event,
                "at": now,
                "amount": amount,
                "recipient": recipient.as_hex,
                "status": status,
            },
        )
        self._pay(recipient, gl.u256(amount))
        return status

    @gl.public.write
    def settle_breach(self, commitment_id: str) -> str:
        commitment = self._get(commitment_id)
        self._confirm_breach_if_due(commitment)
        amount = int(commitment.current_stake)
        self._require(amount > 0, "nothing to settle")
        return self._request_transfer(
            commitment,
            commitment.beneficiary,
            amount,
            "PAYOUT",
            PAYOUT_PENDING,
        )

    @gl.public.write
    def expire_commitment(self, commitment_id: str) -> str:
        commitment = self._get(commitment_id)
        self._require(commitment.status == ACTIVE, "commitment is not cleanly active")
        expiry = _parse_iso(commitment.expires_at)
        self._require(expiry is not None and _now() >= expiry, "commitment has not expired")
        amount = int(commitment.current_stake)
        self._require(amount > 0, "commitment already completed")
        return self._request_transfer(
            commitment,
            commitment.promisor,
            amount,
            "REFUND",
            REFUND_PENDING,
        )

    def _commitment_view(self, commitment: Commitment) -> dict:
        return {
            "commitment_id": commitment.commitment_id,
            "title": commitment.title,
            "category": commitment.category,
            "promisor": commitment.promisor.as_hex,
            "beneficiary": commitment.beneficiary.as_hex,
            "source_url": commitment.source_url,
            "commitment_text": commitment.commitment_text,
            "baseline_archive_timestamp": commitment.baseline_archive_timestamp,
            "baseline_digest": commitment.baseline_digest,
            "baseline_body_digest": commitment.baseline_body_digest,
            "baseline_excerpt": commitment.baseline_excerpt,
            "baseline_snapshot_id": commitment.baseline_snapshot_id,
            "baseline_byte_length": int(commitment.baseline_byte_length),
            "created_at": commitment.created_at,
            "expires_at": commitment.expires_at,
            "contest_window_seconds": int(commitment.contest_window_seconds),
            "original_stake": int(commitment.original_stake),
            "current_stake": int(commitment.current_stake),
            "total_stake_added": int(commitment.total_stake_added),
            "status": commitment.status,
            "last_checked_at": commitment.last_checked_at,
            "last_observed_archive_timestamp": commitment.last_observed_archive_timestamp,
            "last_snapshot_id": commitment.last_snapshot_id,
            "last_qualified_archive_timestamp": commitment.last_qualified_archive_timestamp,
            "last_qualified_digest": commitment.last_qualified_digest,
            "checks_run": int(commitment.checks_run),
            "consecutive_negative_count": int(commitment.consecutive_negative_count),
            "breach_claimed_at": commitment.breach_claimed_at,
            "contest_deadline": commitment.contest_deadline,
            "breach_capture_1": commitment.breach_capture_1,
            "breach_capture_2": commitment.breach_capture_2,
            "contest_evidence_url": commitment.contest_evidence_url,
            "contest_evidence_timestamp": commitment.contest_evidence_timestamp,
            "contest_evidence_digest": commitment.contest_evidence_digest,
            "contest_evidence_snapshot_id": commitment.contest_evidence_snapshot_id,
            "contest_result": commitment.contest_result,
            "final_settlement_at": commitment.final_settlement_at,
            "final_settlement_amount": int(commitment.final_settlement_amount),
            "pending_transfer_recipient": commitment.pending_transfer_recipient.as_hex,
            "pending_transfer_amount": int(commitment.pending_transfer_amount),
            "pending_transfer_kind": commitment.pending_transfer_kind,
            "pending_transfer_requested_at": commitment.pending_transfer_requested_at,
            "extensions_count": int(commitment.extensions_count),
            "stake_additions_count": int(commitment.stake_additions_count),
        }

    @gl.public.view
    def get_commitment(self, commitment_id: str) -> dict:
        return self._commitment_view(self._get(commitment_id))

    @gl.public.view
    def get_commitment_ids(self, limit: int) -> list:
        self._require(0 <= limit <= MAX_LISTING, "invalid listing limit")
        return json.loads(self.commitment_ids_json)[:limit]

    @gl.public.view
    def commitment_history(self, commitment_id: str) -> list:
        self._get(commitment_id)
        return json.loads(self.history.get(commitment_id) or "[]")

    @gl.public.view
    def get_ledger(self) -> dict:
        return {
            "total_escrowed": int(self.total_escrowed),
            "total_deposited": int(self.total_deposited),
            "total_paid_to_beneficiaries": int(self.total_paid_to_beneficiaries),
            "total_returned_to_promisors": int(self.total_returned_to_promisors),
            "total_pending_outflows": int(self.total_pending_outflows),
            "total_pending_payouts": int(self.total_pending_payouts),
            "total_pending_refunds": int(self.total_pending_refunds),
            "commitments_created": int(self.commitments_created),
            "checks_run": int(self.checks_run),
            "breach_claims": int(self.breach_claims),
            "contests_filed": int(self.contests_filed),
            "contests_upheld": int(self.contests_upheld),
            "contests_rejected": int(self.contests_rejected),
            "commitments_completed": int(self.commitments_completed),
            "pending_commitments": int(self.pending_commitments),
        }

    @gl.public.view
    def get_limits(self) -> dict:
        return {
            "max_id_length": MAX_ID_LENGTH,
            "max_title_length": MAX_TITLE_LENGTH,
            "max_category_length": MAX_CATEGORY_LENGTH,
            "max_url_length": MAX_URL_LENGTH,
            "max_commitment_length": MAX_COMMITMENT_LENGTH,
            "max_snapshot_bytes": MAX_ARCHIVE_BYTES,
            "max_archive_bytes": MAX_ARCHIVE_BYTES,
            "max_history_entries": MAX_HISTORY_ENTRIES,
            "max_commitments": MAX_COMMITMENTS,
            "max_checks": MAX_CHECKS,
            "min_contest_window_seconds": MIN_CONTEST_WINDOW_SECONDS,
            "max_contest_window_seconds": MAX_CONTEST_WINDOW_SECONDS,
        }

    @gl.public.view
    def contract_info(self) -> dict:
        return {
            "name": "Uphold",
            "version": "live-snapshot-v1.0",
            "semantic_classifications": [HOLDS, WEAKENED, ABSENT, INDETERMINATE],
            "evidence_provider": "Live public source via gl.nondet.web.get",
            "evidence_discovery": "Wayback/CDX/Availability are optional off-chain research and recovery only",
            "breach_rule": "two distinct consecutive qualified negative captures",
            "semantic_verification": "independent validators classify the same authenticated baseline and live snapshot; only classification is consensus-critical",
            "redirect_behavior": "gl.nondet.web exposes status and body here; final URL and headers are not assumed visible",
            "transfer_mechanism": "finalized EOA external message",
            "settlement_confirmation": "external Studio/client observation; no contract-level receipt is available",
        }

    @gl.public.view
    def get_address_record(self, address: str) -> dict:
        try:
            parsed = gl.Address(address)
        except Exception:
            raise gl.vm.UserError("invalid address")
        record = self._address_record(parsed)
        defaults = {
            "commitments_created": 0,
            "completed_intact": 0,
            "breached": 0,
            "contests_won": 0,
            "contests_lost": 0,
            "total_gen_bonded": 0,
            "gen_returned": 0,
            "gen_received": 0,
        }
        defaults.update(record)
        return defaults
