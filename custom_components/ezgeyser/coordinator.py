"""Polls one geyser's `/quickStatus` every second, and checks now and then that the same geyser still answers."""

from datetime import timedelta
import logging
import time
from typing import Any, override

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_MAC
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util.dt import now as local_now, utcnow

from .api import GeyserClient, GeyserError, Identity, QuickStatus
from .const import (
    BACKOFF_SECONDS,
    DOMAIN,
    IDENTITY_CHECK_INTERVAL,
    POLL_INTERVAL,
    TOLERATED_FAILURES,
)
from .schedule import NextEvent, clock_off, next_event, parse_schedules
from .smoothing import TemperatureFilter

_LOGGER = logging.getLogger(__name__)

type EzGeyserConfigEntry = ConfigEntry[EzGeyserCoordinator]


class EzGeyserCoordinator(DataUpdateCoordinator[QuickStatus]):
    """One per geyser. The shared limiter in `GeyserClient` keeps all of them to one request at a time."""

    config_entry: EzGeyserConfigEntry
    identity: Identity

    def __init__(self, hass: HomeAssistant, entry: EzGeyserConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=f"{DOMAIN} {entry.data[CONF_HOST]}",
            update_interval=POLL_INTERVAL,
            always_update=False,
        )
        self.client = GeyserClient(hass, entry.data[CONF_HOST])
        self._failures = 0
        self._identity_due = utcnow()
        self._schedules_due = utcnow()
        # The last schedules read; a failed or unreadable read keeps them, as in the Android app.
        self.schedules: list[dict[str, Any]] | None = None
        self.next_event: NextEvent | None = None
        # Whether the device clock was off when the last answer arrived; None when the geyser sent no clock.
        self.clock_off: bool | None = None
        # The smoothed tank temperatures the temperature sensors show, by sensor key; `data` keeps the raw readings.
        self._filters = {"temperature_top": TemperatureFilter(), "temperature_bottom": TemperatureFilter()}
        self.temperatures: dict[str, float | None] = dict.fromkeys(self._filters)

    @override
    async def _async_setup(self) -> None:
        try:
            await self._check_identity()
        except GeyserError as error:
            raise _cannot_connect(error) from error

    @override
    async def _async_update_data(self) -> QuickStatus:
        try:
            if utcnow() >= self._identity_due:
                await self._check_identity()
            status = await self.client.quick_status()
        except GeyserError as error:
            self._failures += 1
            backoff = BACKOFF_SECONDS[min(self._failures, len(BACKOFF_SECONDS)) - 1]
            self.update_interval = max(POLL_INTERVAL, timedelta(seconds=backoff))
            if self._failures <= TOLERATED_FAILURES and self.data is not None:
                return self.data
            raise _cannot_connect(error) from error
        if utcnow() >= self._schedules_due:
            self._schedules_due = utcnow() + timedelta(minutes=1)
            try:
                self.schedules = parse_schedules(await self.client.schedules())
            except GeyserError as error:
                # A timeout or a garbled body is a struggling geyser, not an empty schedule (that reads as `[]`). The
                # identity check, not this read, catches another device at the address.
                _LOGGER.debug("Keeping the last schedules read: %s", error)
        now = local_now()
        self.clock_off = clock_off(status.clock, now)
        self.next_event = next_event(self.schedules, status.clock, now) if self.schedules is not None else None
        at = time.monotonic()
        for key, reading in (
            ("temperature_top", status.top if status.top_ok else None),
            ("temperature_bottom", status.bottom if status.bottom_ok else None),
        ):
            self.temperatures[key] = self._filters[key].update(reading, at)
        self._failures = 0
        self.update_interval = POLL_INTERVAL
        return status

    async def _check_identity(self) -> None:
        """Make sure the geyser that was added is the one answering at its address."""
        identity = await self.client.identity()
        if identity.mac != self.config_entry.data[CONF_MAC]:
            # Not tolerated like a missed read: these readings would belong to another device.
            raise UpdateFailed(translation_domain=DOMAIN, translation_key="wrong_device")
        self.identity = identity
        self._identity_due = utcnow() + IDENTITY_CHECK_INTERVAL


def _cannot_connect(error: GeyserError) -> UpdateFailed:
    return UpdateFailed(
        translation_domain=DOMAIN,
        translation_key="cannot_connect",
        translation_placeholders={"reason": str(error)},
    )
