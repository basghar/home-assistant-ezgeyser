from custom_components.ezgeyser.smoothing import STALE_AFTER, TemperatureFilter


def _feed(readings: list[float | None], start: float = 1000.0) -> list[float | None]:
    smoothed = TemperatureFilter()
    return [smoothed.update(reading, start + second) for second, reading in enumerate(readings)]


def test_the_first_reading_shows_as_it_is() -> None:
    assert _feed([43.1]) == [43.1]


def test_scatter_around_the_real_temperature_never_changes_the_value() -> None:
    scatter = [43.1, 43.3, 42.9, 43.2, 43.0, 43.4, 42.8, 43.1, 43.2, 43.0] * 6

    assert set(_feed(scatter)) == {43.1}


def test_a_one_off_jump_is_dropped() -> None:
    assert set(_feed([43.1] * 10 + [44.4] + [43.1] * 10)) == {43.1}


def test_a_real_change_shows_within_half_a_minute_and_settles() -> None:
    values = _feed([40.0] * 30 + [45.0] * 90)

    assert values[29] == 40.0
    assert values[30 + 25] >= 44.5
    assert values[30 + 30] >= 44.7
    assert abs(values[-1] - 45.0) < 0.2


def test_a_sensor_fault_is_unknown_at_once_and_the_next_reading_shows_as_it_is() -> None:
    assert _feed([43.1, 43.1, None, 47.5]) == [43.1, 43.1, None, 47.5]


def test_after_a_long_gap_the_next_reading_shows_as_it_is() -> None:
    smoothed = TemperatureFilter()
    smoothed.update(43.1, 1000.0)

    assert smoothed.update(47.5, 1000.0 + STALE_AFTER + 1) == 47.5
