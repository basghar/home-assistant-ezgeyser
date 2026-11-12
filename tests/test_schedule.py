"""Schedule calculations use the device's timezone-free clock."""

from datetime import UTC, datetime, timedelta, timezone

from custom_components.ezgeyser.schedule import NextEvent, clock_off, next_event
import pytest


def test_device_wall_clock_and_sunday_first() -> None:
    zone = timezone(timedelta(hours=5))
    now = datetime(2026, 11, 11, 20, 0, tzinfo=zone)  # Wednesday
    encoded = int(datetime(2026, 11, 11, 20, 0, tzinfo=UTC).timestamp())
    schedule = {
        "isEnabled": True,
        "repetitionIsEnabled": True,
        "weekdays": [False, False, False, False, True, False, False],
        "start": "04:30",
    }
    event = next_event([schedule], encoded, now)
    assert event is not None
    assert event.at == datetime(2026, 11, 11, 23, 30, tzinfo=UTC)
    assert next_event([schedule], encoded, now + timedelta(minutes=3)) is None


def test_disabled_invalid_and_one_off() -> None:
    now = datetime(2026, 11, 11, 20, tzinfo=UTC)
    encoded = int(now.timestamp())
    assert next_event([{"isEnabled": False}], encoded, now) is None
    assert next_event([{"isEnabled": True}], encoded, now) is None
    assert next_event([{"isEnabled": True, "repetitionIsEnabled": False, "start": "21:00"}], encoded, now) == NextEvent(
        now + timedelta(hours=1), None
    )


def test_scheduled_target_and_tie() -> None:
    now = datetime(2026, 11, 11, 20, tzinfo=UTC)
    encoded = int(now.timestamp())

    def entry(start: str, value: object) -> dict[str, object]:
        variables = [
            {"targetVariableId": "source", "value": 1},
            {"targetVariableId": "temperatureTarget", "value": value},
        ]
        return {"isEnabled": True, "repetitionIsEnabled": False, "start": start, "targetVariables": variables}

    def target(*entries: dict[str, object]) -> tuple[datetime, float | None] | None:
        event = next_event(list(entries), encoded, now)
        return (event.at, event.target) if event else None

    in_an_hour = now + timedelta(hours=1)
    assert target(entry("22:00", 50), entry("21:00", 60), entry("21:00", 55)) == (in_an_hour, 60.0)
    assert target(entry("21:00", 0)) == (in_an_hour, 0.0)
    assert target(entry("21:00", True)) == (in_an_hour, None)


def test_next_event_reads_source_switch_over_and_days() -> None:
    now = datetime(2026, 11, 11, 20, tzinfo=UTC)
    days = [True, False, False, False, False, False, True]
    schedule = {
        "isEnabled": True,
        "repetitionIsEnabled": True,
        "weekdays": days,
        "start": "21:00",
        "targetVariables": [
            {"targetVariableId": "temperatureTarget", "value": 55},
            {"targetVariableId": "source", "value": 1},
            {"targetVariableId": "switchOver", "value": 1},
        ],
    }
    # 2026-11-11 is a Wednesday, so the next Sunday-first match is Saturday the 14th.
    assert next_event([schedule], int(now.timestamp()), now) == NextEvent(
        now + timedelta(days=3, hours=1), 55.0, 1, True, tuple(days)
    )
    schedule["targetVariables"] = [
        {"targetVariableId": "switchOver", "value": 2},
        {"targetVariableId": "source", "value": 1.5},
    ]
    event = next_event([schedule], int(now.timestamp()), now)
    assert event is not None
    assert (event.target, event.source_code, event.switch_over) == (None, None, None)


def test_clock_off_compares_the_wall_clocks_with_two_minutes_tolerance() -> None:
    now = datetime(2026, 11, 11, 20, 0, tzinfo=timezone(timedelta(hours=5)))
    encoded = int(datetime(2026, 11, 11, 20, 0, tzinfo=UTC).timestamp())
    assert clock_off(encoded, now) is False
    assert clock_off(encoded + 120, now) is False
    assert clock_off(encoded - 120, now) is False
    assert clock_off(encoded + 121, now) is True
    assert clock_off(encoded - 121, now) is True
    # Read as an instant, the same clock would be five hours off.
    assert clock_off(int(now.timestamp()), now) is True
    assert clock_off(0, now) is None


@pytest.mark.parametrize("skew_seconds", [-120, -60, -1, 0, 1, 30, 60, 120])
@pytest.mark.parametrize("start", ["04:30", "00:00"])
def test_next_event_preserves_scheduled_time_with_clock_skew(skew_seconds: int, start: str) -> None:
    zone = timezone(timedelta(hours=5))
    now = datetime(2026, 11, 11, 20, tzinfo=zone)
    encoded = int(now.replace(tzinfo=UTC).timestamp()) + skew_seconds
    schedule = {"isEnabled": True, "repetitionIsEnabled": False, "start": start}

    event = next_event([schedule], encoded, now)

    assert event is not None
    hour, minute = map(int, start.split(":"))
    expected = datetime(2026, 11, 12, hour, minute, tzinfo=zone)
    assert event.at == expected.astimezone(UTC)
    assert event.at.astimezone(zone).strftime("%H:%M:%S") == f"{start}:00"


def test_device_clock_still_selects_the_next_occurrence() -> None:
    zone = timezone(timedelta(hours=5))
    now = datetime(2026, 11, 12, 4, 29, 50, tzinfo=zone)
    encoded = int(now.replace(tzinfo=UTC).timestamp()) + 20
    schedule = {"isEnabled": True, "repetitionIsEnabled": False, "start": "04:30"}

    event = next_event([schedule], encoded, now)

    assert event is not None
    assert event.at == datetime(2026, 11, 13, 4, 30, tzinfo=zone).astimezone(UTC)
