# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""Disposable Studio Next smoke for Availability + exact replay authentication."""

from dataclasses import dataclass
import datetime as dt
import hashlib
import json
from urllib.parse import quote, unquote, urlsplit

import genlayer as gl
from genlayer.storage import allow as allow_storage


MAX_BYTES = 32_768
AVAILABILITY_ENDPOINT = "https://archive.org/wayback/available"


@allow_storage
@dataclass
class SmokeSnapshot:
    source_url: str
    archive_timestamp: str
    replay_url: str
    sha256: str
    byte_length: gl.u256
    normalized_content: str
    captured_state: str


def _parse_timestamp(value: str) -> dt.datetime | None:
    if not isinstance(value, str) or len(value) != 14 or not value.isdigit():
        return None
    try:
        return dt.datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def _replay_parts(value: str) -> tuple[str, str] | None:
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    if (parsed.hostname or "").lower() != "web.archive.org" or parsed.fragment:
        return None
    marker = "/web/"
    if marker not in value:
        return None
    tail = value.split(marker, 1)[1]
    if "/" not in tail:
        return None
    timestamp, target = tail.split("/", 1)
    if timestamp.endswith("id_"):
        timestamp = timestamp[:-3]
    if _parse_timestamp(timestamp) is None:
        return None
    return timestamp, unquote(target)


def _capture_url(source_url: str, timestamp: str) -> str:
    return "https://web.archive.org/web/" + timestamp + "id_/" + source_url


def _fetch_snapshot(source_url: str, requested_timestamp: str) -> dict:
    availability_url = AVAILABILITY_ENDPOINT + "?url=" + quote(source_url, safe="") + "&timestamp=" + requested_timestamp
    availability = gl.nondet.web.get(availability_url)
    if availability.status != 200 or not isinstance(availability.body, bytes):
        return {"ok": False, "reason": "availability_unavailable"}
    try:
        response = json.loads(availability.body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return {"ok": False, "reason": "availability_malformed"}
    if not isinstance(response, dict) or response.get("url") not in (None, source_url):
        return {"ok": False, "reason": "availability_url_mismatch"}
    snapshots = response.get("archived_snapshots")
    closest = snapshots.get("closest") if isinstance(snapshots, dict) else None
    if not isinstance(closest, dict) or closest.get("available") is not True:
        return {"ok": False, "reason": "no_capture"}
    if str(closest.get("status")) != "200":
        return {"ok": False, "reason": "capture_not_http_200"}
    timestamp = closest.get("timestamp")
    returned_url = closest.get("url")
    if _parse_timestamp(timestamp) is None or _parse_timestamp(timestamp) > dt.datetime.now(dt.timezone.utc):
        return {"ok": False, "reason": "invalid_capture_timestamp"}
    if _replay_parts(returned_url) != (timestamp, source_url):
        return {"ok": False, "reason": "invalid_capture_binding"}
    replay_url = _capture_url(source_url, timestamp)
    replay = gl.nondet.web.get(replay_url)
    if replay.status != 200 or not isinstance(replay.body, bytes):
        return {"ok": False, "reason": "replay_unavailable"}
    if len(replay.body) > MAX_BYTES:
        return {"ok": False, "reason": "replay_too_large"}
    try:
        document = replay.body.decode("utf-8")
    except UnicodeDecodeError:
        return {"ok": False, "reason": "replay_not_utf8"}
    normalized = " ".join(document.split())
    if not normalized:
        return {"ok": False, "reason": "empty_replay"}
    return {
        "ok": True,
        "source_url": source_url,
        "archive_timestamp": timestamp,
        "replay_url": replay_url,
        "sha256": hashlib.sha256(replay.body).hexdigest(),
        "byte_length": len(replay.body),
        "normalized_content": normalized,
        "captured_state": "AUTHENTICATED",
    }


class EvidenceSmoke(gl.contract.Contract):
    snapshot: SmokeSnapshot
    captured: bool

    def __init__(self):
        self.captured = False

    @gl.public.write
    def capture(self, source_url: str, requested_timestamp: str) -> str:
        self._require(not self.captured, "smoke capture already used")
        result = gl.eq_principle.strict_eq(
            lambda: json.dumps(
                _fetch_snapshot(source_url, requested_timestamp),
                sort_keys=True,
                separators=(",", ":"),
            )
        )
        decoded = json.loads(result)
        self._require(decoded.get("ok") is True, decoded.get("reason", "capture failed"))
        self.snapshot = SmokeSnapshot(
            source_url=decoded["source_url"],
            archive_timestamp=decoded["archive_timestamp"],
            replay_url=decoded["replay_url"],
            sha256=decoded["sha256"],
            byte_length=gl.u256(int(decoded["byte_length"])),
            normalized_content=decoded["normalized_content"],
            captured_state=decoded["captured_state"],
        )
        self.captured = True
        return "CAPTURED"

    def _require(self, condition: bool, message: str) -> None:
        if not condition:
            raise gl.vm.UserError(message)

    @gl.public.view
    def contract_info(self) -> str:
        return "UPHOLD_EVIDENCE_SMOKE"

    @gl.public.view
    def get_snapshot(self) -> dict:
        self._require(self.captured, "smoke snapshot not captured")
        return {
            "source_url": self.snapshot.source_url,
            "archive_timestamp": self.snapshot.archive_timestamp,
            "replay_url": self.snapshot.replay_url,
            "sha256": self.snapshot.sha256,
            "byte_length": int(self.snapshot.byte_length),
            "normalized_content": self.snapshot.normalized_content,
            "captured_state": self.snapshot.captured_state,
        }
