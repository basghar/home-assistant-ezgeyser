"""Calculate reliable daily schedule times using the geyser's wall clock."""

from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
import json
from typing import Any

from .api import NotAGeyser

# The device clock may be this far from Home Assistant's before it counts as off, as in the Android app.
CLOCK_TOLERANCE = timedelta(minutes=2)


def parse_schedules(body: bytes) -> list[dict[str, Any]]:
    try:
        raw = json.loads(body)
    except ValueError:
        raise NotAGeyser("invalid schedules") from None
    if not isinstance(raw, list) or any(not isinstance(item, dict) for item in raw):
        raise NotAGeyser("invalid schedules")
    return raw


@dataclass(frozen=True, slots=True)
class NextEvent:
    """When the next schedule starts and what it sets. A field is None when the entry does not name it.

    `weekdays` is the entry's seven repeat flags, Sunday first (unverified, as in the Android app); None for a one-off.
    """

    at: datetime
    target: float | None
    source_code: int | None = None
    switch_over: bool | None = None
    weekdays: tuple[bool, ...] | None = None


def _variable(schedule: dict[str, Any], name: str) -> float | None:
    """A `targetVariables` value; None when it is missing or not a number."""
    variables = schedule.get("targetVariables")
    if not isinstance(variables, list):
        return None
    for variable in variables:
        if isinstance(variable, dict) and variable.get("targetVariableId") == name:
            value = variable.get("value")
            return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None
    return None


def scheduled_target(schedule: dict[str, Any]) -> float | None:
    """The entry's `temperatureTarget` in °C; 0 turns heating off."""
    return _variable(schedule, "temperatureTarget")


def _event(at: datetime, schedule: dict[str, Any]) -> NextEvent:
    source = _variable(schedule, "source")
    switch_over = _variable(schedule, "switchOver")
    days = schedule.get("weekdays")
    return NextEvent(
        at=at,
        target=scheduled_target(schedule),
        source_code=int(source) if source is not None and source.is_integer() else None,
        switch_over={0.0: False, 1.0: True}.get(switch_over) if switch_over is not None else None,
        weekdays=tuple(days) if schedule.get("repetitionIsEnabled") and isinstance(days, list) else None,
    )


def device_wall_clock(device_clock: int) -> datetime | None:
    """The geyser's `now`: its local wall time written as if it were UTC, so read without a zone. None if unsent (0)."""
    if device_clock <= 0:
        return None
    try:
        return datetime.fromtimestamp(device_clock, UTC).replace(tzinfo=None)
    except ValueError, OSError, OverflowError:
        return None


def clock_off(device_clock: int, now: datetime) -> bool | None:
    """Whether the device clock is over `CLOCK_TOLERANCE` from `now`, Home Assistant's local time; None if unsent."""
    device_now = device_wall_clock(device_clock)
    return None if device_now is None else abs(device_now - now.replace(tzinfo=None)) > CLOCK_TOLERANCE


def next_event(schedules: list[dict[str, Any]], device_clock: int, now: datetime) -> NextEvent | None:
    """Return an event only when all enabled schedules can be interpreted safely."""
    device_now = device_wall_clock(device_clock)
    if device_now is None or clock_off(device_clock, now):
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
                candidates.append((candidate, schedule))
                break
    if not candidates:
        return None
    # The first entry wins a tie, as listed by the firmware.
    first, schedule = min(candidates, key=lambda candidate: candidate[0])
    # Preserve the device-clock offset, so the instant represents when its clock reaches the event.
    return _event(now.astimezone(UTC).replace(microsecond=0) + (first - device_now), schedule)
