# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""Disposable Studio Next smoke for live authenticated evidence snapshots."""

from dataclasses import dataclass
import datetime as dt
import hashlib
import html
import json
import re

import genlayer as gl
from genlayer.storage import allow as allow_storage


MAX_SNAPSHOT_BYTES = 32_768
AUTHENTICATED = "AUTHENTICATED"


@allow_storage
@dataclass
class LiveSnapshot:
    snapshot_id: str
    sequence: gl.u256
    source_url: str
    capture_timestamp: str
    http_status: gl.u256
    sha256: str
    byte_length: gl.u256
    normalized_content: str
    captured_state: str


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _normalize(body: bytes) -> str | None:
    try:
        document = body.decode("utf-8")
    except UnicodeDecodeError:
        return None
    document = re.sub(r"(?is)<(script|style|noscript|template)\b[^>]*>.*?</\1>", " ", document)
    document = re.sub(r"(?s)<[^>]*>", " ", document)
    value = " ".join(html.unescape(document).split())
    if not value:
        return None
    bounded = value.encode("utf-8")[:MAX_SNAPSHOT_BYTES]
    return bounded.decode("utf-8", "ignore").rstrip() or None


def _fetch(source_url: str, capture_timestamp: str) -> dict:
    try:
        response = gl.nondet.web.get(source_url)
    except Exception:
        return {"ok": False, "reason": "SOURCE_UNAVAILABLE"}
    status = getattr(response, "status", None)
    body = getattr(response, "body", None)
    if status != 200 or not isinstance(body, bytes):
        return {"ok": False, "reason": "SOURCE_UNAVAILABLE"}
    normalized = _normalize(body)
    if normalized is None:
        return {"ok": False, "reason": "EVIDENCE_INVALID"}
    return {
        "ok": True,
        "source_url": source_url,
        "capture_timestamp": capture_timestamp,
        "http_status": status,
        "sha256": hashlib.sha256(body).hexdigest(),
        "byte_length": len(body),
        "normalized_content": normalized,
    }


class LiveEvidenceSmoke(gl.contract.Contract):
    snapshots: gl.storage.TreeMap[str, LiveSnapshot]
    capture_count: gl.u256

    def __init__(self):
        self.capture_count = gl.u256(0)

    @gl.public.write
    def capture(self, source_url: str) -> str:
        self._require(source_url.startswith("https://"), "source must be HTTPS")
        sequence = int(self.capture_count)
        capture_timestamp = _now_iso()

        def leader() -> str:
            return json.dumps(
                _fetch(source_url, capture_timestamp),
                sort_keys=True,
                separators=(",", ":"),
            )

        try:
            decoded = json.loads(gl.eq_principle.strict_eq(leader))
        except Exception:
            raise gl.vm.UserError("validator disagreement")
        self._require(isinstance(decoded, dict) and decoded.get("ok") is True, decoded.get("reason", "capture failed"))
        snapshot = LiveSnapshot(
            snapshot_id="snapshot:" + str(sequence),
            sequence=gl.u256(sequence),
            source_url=decoded["source_url"],
            capture_timestamp=decoded["capture_timestamp"],
            http_status=gl.u256(int(decoded["http_status"])),
            sha256=decoded["sha256"],
            byte_length=gl.u256(int(decoded["byte_length"])),
            normalized_content=decoded["normalized_content"],
            captured_state=AUTHENTICATED,
        )
        self.snapshots[snapshot.snapshot_id] = snapshot
        self.capture_count = gl.u256(sequence + 1)
        return snapshot.snapshot_id

    def _require(self, condition: bool, message: str) -> None:
        if not condition:
            raise gl.vm.UserError(message)

    @gl.public.view
    def contract_info(self) -> str:
        return "UPHOLD_LIVE_EVIDENCE_SMOKE"

    @gl.public.view
    def get_snapshots(self) -> list:
        result = []
        for sequence in range(int(self.capture_count)):
            snapshot = self.snapshots["snapshot:" + str(sequence)]
            result.append(
                {
                    "snapshot_id": snapshot.snapshot_id,
                    "sequence": int(snapshot.sequence),
                    "source_url": snapshot.source_url,
                    "capture_timestamp": snapshot.capture_timestamp,
                    "http_status": int(snapshot.http_status),
                    "sha256": snapshot.sha256,
                    "byte_length": int(snapshot.byte_length),
                    "normalized_content": snapshot.normalized_content,
                    "captured_state": snapshot.captured_state,
                }
            )
        return result
