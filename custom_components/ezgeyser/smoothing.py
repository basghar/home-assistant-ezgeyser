"""Steadies the 1-second tank temperatures, so they change, and Recorder stores a row, only as the water heats or cools.

A geyser's readings scatter about 0.2 °C around the real temperature, with single-second jumps of over 1 °C. Each
reading goes through a median that drops one-off jumps, then an average weighted by the time between readings, and the
published value moves only once that average is `DEADBAND` away from it. See "Smoothed temperatures" in the README.
"""

from collections import deque
import math
import statistics
from typing import Final

# Readings in the median that drops one-off jumps.
SPIKE_WINDOW: Final = 5
# Seconds; the average follows a change about this slowly.
TIME_CONSTANT: Final = 10.0
# °C the average must move away from the published value before it changes.
DEADBAND: Final = 0.2
# Seconds without a reading after which the filter starts over, instead of mixing in old readings.
STALE_AFTER: Final = 30.0


class TemperatureFilter:
    """One tank sensor's smoothed temperature. `value` is what the sensor entity shows."""

    def __init__(self) -> None:
        self._recent: deque[float] = deque(maxlen=SPIKE_WINDOW)
        self._average: float | None = None
        self._at = 0.0
        self.value: float | None = None

    def update(self, reading: float | None, at: float) -> float | None:
        """Add the reading taken at `at` (seconds, monotonic). `None` means the sensor is not OK: unknown at once."""
        if reading is None or at - self._at > STALE_AFTER:
            self.reset()
        if reading is None:
            return None
        self._recent.append(reading)
        median = statistics.median(self._recent)
        if self._average is None:
            self._average = median
        else:
            self._average += (1 - math.exp(-max(at - self._at, 0.0) / TIME_CONSTANT)) * (median - self._average)
        self._at = at
        if self.value is None or abs(self._average - self.value) >= DEADBAND:
            self.value = round(self._average, 1)
        return self.value

    def reset(self) -> None:
        self._recent.clear()
        self._average = self.value = None
