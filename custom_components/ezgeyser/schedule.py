"""Calculate reliable daily schedule times using the geyser's wall clock."""

from datetime import UTC, datetime, time, timedelta
import json
from typing import Any

from .api import NotAGeyser


def parse_schedules(body: bytes) -> list[dict[str, Any]]:
    try:
        raw = json.loads(body)
    except ValueError:
        raise NotAGeyser("invalid schedules") from None
    if not isinstance(raw, list) or any(not isinstance(item, dict) for item in raw):
        raise NotAGeyser("invalid schedules")
    return raw


def next_event(schedules: list[dict[str, Any]], device_clock: int, now: datetime) -> datetime | None:
    """Return an instant only when all enabled schedules can be interpreted safely."""
    try:
        device_now = datetime.fromtimestamp(device_clock, UTC).replace(tzinfo=None)
    except ValueError, OSError, OverflowError:
        return None
    local_now = now.replace(tzinfo=None)
    if abs((device_now - local_now).total_seconds()) > 120:
        return None
    candidates = []
    for schedule in schedules:
        enabled = schedule.get("isEnabled")
        if type(enabled) is not bool:
            return None
        if not enabled:
            continue
        repeats = schedule.get("repetitionIsEnabled")
        days = schedule.get("weekdays")
        if type(repeats) is not bool:
            return None
        if repeats and (not isinstance(days, list) or len(days) != 7 or any(type(day) is not bool for day in days)):
            return None
        try:
            start = time.fromisoformat(schedule["start"])
            if start.tzinfo is not None:
                return None
        except KeyError, TypeError, ValueError:
            return None
        # Match Android: weekday 0 is assumed Sunday; one-off entries use the next daily occurrence.
        for offset in range(9):
            date = device_now.date() + timedelta(days=offset)
            if repeats and isinstance(days, list) and not days[(date.weekday() + 1) % 7]:
                continue
            candidate = datetime.combine(date, start)
            if candidate > device_now:
                candidates.append(candidate)
                break
    if not candidates:
        return None
    # Preserve the device-clock offset, so the instant represents when its clock reaches the event.
    return now.astimezone(UTC).replace(microsecond=0) + (min(candidates) - device_now)
