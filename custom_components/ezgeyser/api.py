"""The geyser's read-only HTTP API: the client, its one-request-at-a-time limiter, and the parsed responses.

Only the fields this integration uses are parsed, strictly: a response that does not look like the documented one is
refused as a whole. The geyser's Wi-Fi settings are never requested (`/wifiData` is not on the guard's list).
"""

import asyncio
from dataclasses import dataclass
from http import HTTPStatus
import json
import math
import re
from typing import Any, Final

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.device_registry import format_mac
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN
from .guard import CLOUD_STATUS_PATH, DATA_PATH, QUICK_STATUS_PATH, url_for

TIMEOUT: Final = aiohttp.ClientTimeout(total=3)
MAX_BODY_BYTES: Final = 8192
_MAC = re.compile(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}")

# One request in flight across every geyser and every flow. See "How it polls" in the README.
_LIMITER: HassKey[asyncio.Lock] = HassKey(f"{DOMAIN}_limiter")


class GeyserError(Exception):
    """The geyser did not give a usable answer. The message never contains a response body."""


class NotAGeyser(GeyserError):  # noqa: N818 - a verdict, like the Android `ProbeResult.NotAGeyser`
    """Something answered, but not the way an ezGeyser does."""


@dataclass(frozen=True, slots=True)
class QuickStatus:
    """`GET /quickStatus`: temperatures and heating flags, as the firmware reports them."""

    top: float
    top_ok: bool
    bottom: float
    bottom_ok: bool
    target_temp: float
    burner1: bool
    burner2: bool
    element1: bool
    element2: bool
    source: int
    boost: bool


@dataclass(frozen=True, slots=True)
class Identity:
    """Who answers at an address, from `GET /data`."""

    mac: str
    hostname: str
    model: str | None
    sw_version: str | None
    hw_version: str | None


class GeyserClient:
    """Reads one geyser at `host`. Every request goes through the guard and the shared limiter."""

    def __init__(self, hass: HomeAssistant, host: str) -> None:
        self._session = async_get_clientsession(hass)
        self._lock = hass.data.setdefault(_LIMITER, asyncio.Lock())
        self.host = host

    async def quick_status(self) -> QuickStatus:
        return parse_quick_status(await self._get(QUICK_STATUS_PATH))

    async def identity(self) -> Identity:
        return parse_identity(await self._get(DATA_PATH))

    async def probe(self) -> Identity:
        """Identify a geyser the way the Android app does: `/cloudStatus` must parse, then `/data` must name a host.

        A stranger on the network gets one request, because `/data` is only asked for once `/cloudStatus` parsed.
        """
        parse_cloud_status(await self._get(CLOUD_STATUS_PATH))
        return await self.identity()

    async def _get(self, path: str) -> bytes:
        url = url_for(self.host, path)
        async with self._lock:
            try:
                async with self._session.get(
                    url,
                    allow_redirects=False,
                    timeout=TIMEOUT,
                    headers={"Accept": "application/json", "Connection": "close"},
                ) as response:
                    if response.status != HTTPStatus.OK:
                        raise NotAGeyser(f"HTTP {response.status}")
                    body = await response.content.read(MAX_BODY_BYTES + 1)
            except (aiohttp.ClientError, TimeoutError) as error:
                raise GeyserError(type(error).__name__) from None
        if len(body) > MAX_BODY_BYTES:
            raise NotAGeyser("response too large")
        return body


def _object(body: bytes) -> dict[str, Any]:
    try:
        raw = json.loads(body)
    except ValueError:
        raise NotAGeyser("the response is not valid JSON") from None
    if not isinstance(raw, dict):
        raise NotAGeyser("the response is not a JSON object")
    return raw


def _flag(raw: dict[str, Any], key: str) -> bool:
    value = raw.get(key)
    if type(value) is not int or value not in (0, 1):
        raise NotAGeyser(f"unexpected field: {key}")
    return value == 1


def _celsius(raw: dict[str, Any], key: str) -> float:
    value = raw.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise NotAGeyser(f"unexpected field: {key}")
    return float(value)


def _text(raw: dict[str, Any], key: str) -> str | None:
    value = raw.get(key)
    return (value.strip() or None) if isinstance(value, str) else None


def parse_quick_status(body: bytes) -> QuickStatus:
    raw = _object(body)
    source = raw.get("source")
    if type(source) is not int:
        raise NotAGeyser("unexpected field: source")
    return QuickStatus(
        top=_celsius(raw, "top"),
        top_ok=_flag(raw, "topOk"),
        bottom=_celsius(raw, "bottom"),
        bottom_ok=_flag(raw, "bottomOk"),
        target_temp=_celsius(raw, "targetTemp"),
        burner1=_flag(raw, "burner1Status"),
        burner2=_flag(raw, "burner2Status"),
        element1=_flag(raw, "heatingElement1"),
        element2=_flag(raw, "heatingElement2"),
        source=source,
        boost=_flag(raw, "boostMode"),
    )


def parse_identity(body: bytes) -> Identity:
    raw = _object(body)
    hostname = _text(raw, "host")
    mac = format_mac(_text(raw, "mac") or "")
    if hostname is None or not _MAC.fullmatch(mac):
        raise NotAGeyser("the response names no geyser")
    return Identity(
        mac=mac,
        hostname=hostname,
        model=_text(raw, "device"),
        sw_version=_text(raw, "ver"),
        hw_version=_text(raw, "hw"),
    )


def parse_cloud_status(body: bytes) -> None:
    if not isinstance(_object(body).get("state"), str):
        raise NotAGeyser("unexpected field: state")
