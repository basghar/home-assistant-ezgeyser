"""Schedule calculations use the device's timezone-free clock."""

from datetime import UTC, datetime, timedelta, timezone

from custom_components.ezgeyser.schedule import next_event


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
    assert next_event([schedule], encoded, now) == datetime(2026, 11, 11, 23, 30, tzinfo=UTC)
    assert next_event([schedule], encoded, now + timedelta(minutes=3)) is None


def test_disabled_invalid_and_one_off() -> None:
    now = datetime(2026, 11, 11, 20, tzinfo=UTC)
    encoded = int(now.timestamp())
    assert next_event([{"isEnabled": False}], encoded, now) is None
    assert next_event([{"isEnabled": True}], encoded, now) is None
    assert next_event(
        [{"isEnabled": True, "repetitionIsEnabled": False, "start": "21:00"}], encoded, now
    ) == now + timedelta(hours=1)
