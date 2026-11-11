"""Polls one geyser's `/quickStatus` every second, and checks now and then that the same geyser still answers."""

from datetime import datetime, timedelta
import logging
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
from .schedule import next_event, parse_schedules

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
        self.schedules: list[dict[str, Any]] | None = None
        self.next_event: datetime | None = None

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
            except GeyserError:
                self.schedules = None
        self.next_event = next_event(self.schedules, status.clock, local_now()) if self.schedules is not None else None
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
