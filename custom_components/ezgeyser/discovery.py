"""The scan behind "leave the address empty": the Android app's strategy, on Home Assistant's own discovery.

Like the scan in the companion Android app: browse mDNS for `_http._tcp`, then probe the candidates **one at a
time** (`/cloudStatus`, then `/data`), at most `MAX_PROBES` of them and for at most `SCAN_TIMEOUT_SECONDS` in all,
skipping addresses and geysers already added and reporting each geyser once. Two additions: hosts that Home Assistant's
DHCP watcher saw named `ezgeyser-*` are candidates too, and candidates whose name starts with `ezgeyser` are probed
first, so a stranger's device is probed only when there is probe budget left.

Nothing here sweeps a subnet: a device gets a request only if it advertised itself.
"""

import asyncio
from dataclasses import dataclass
import logging

from homeassistant.core import HomeAssistant

from .api import GeyserClient, GeyserError, Identity
from .const import MAX_PROBES, SCAN_BROWSE_SECONDS, SCAN_TIMEOUT_SECONDS
from .guard import lan_host

_LOGGER = logging.getLogger(__name__)

HTTP_SERVICE = "_http._tcp.local."
NAME_PREFIX = "ezgeyser"
_RESOLVE_TIMEOUT_MS = 1000


@dataclass(frozen=True, slots=True)
class FoundGeyser:
    host: str
    identity: Identity


async def async_scan(hass: HomeAssistant, skip_hosts: set[str], skip_macs: set[str]) -> list[FoundGeyser]:
    """The geysers that answer and are not added yet, in the order they were found."""
    found: list[FoundGeyser] = []
    try:
        async with asyncio.timeout(SCAN_TIMEOUT_SECONDS):
            await _probe_candidates(hass, skip_hosts, set(skip_macs), found)
    except TimeoutError:
        _LOGGER.debug("Scan stopped after %s s with %s geysers found", SCAN_TIMEOUT_SECONDS, len(found))
    return found


async def _probe_candidates(
    hass: HomeAssistant, skip_hosts: set[str], seen: set[str], found: list[FoundGeyser]
) -> None:
    probes = 0
    for host in await _candidates(hass):
        if host in skip_hosts:
            continue
        if probes >= MAX_PROBES:
            return
        probes += 1
        try:
            identity = await GeyserClient(hass, host).probe()
        except GeyserError:
            continue
        if identity.mac not in seen:
            seen.add(identity.mac)
            found.append(FoundGeyser(host, identity))


async def _candidates(hass: HomeAssistant) -> list[str]:
    """Local-network IPv4 hosts, `ezgeyser`-named ones first, each once, otherwise in the order they were seen."""
    named_by_host: dict[str, bool] = {}
    for name, address in [*_dhcp_candidates(hass), *await _mdns_candidates(hass)]:
        if (host := lan_host(address)) is not None:
            named_by_host[host] = named_by_host.get(host, False) or name.lower().startswith(NAME_PREFIX)
    return sorted(named_by_host, key=lambda host: not named_by_host[host])


def _dhcp_candidates(hass: HomeAssistant) -> list[tuple[str, str]]:
    if "dhcp" not in hass.config.components:
        return []
    from homeassistant.components import dhcp

    return [(info.hostname, info.ip) for info in dhcp.async_discovered_service_info(hass)]


async def _mdns_candidates(hass: HomeAssistant) -> list[tuple[str, str]]:
    if "zeroconf" not in hass.config.components:
        return []
    from zeroconf import IPVersion, ServiceStateChange, Zeroconf
    from zeroconf.asyncio import AsyncServiceBrowser, AsyncServiceInfo

    from homeassistant.components import zeroconf as ha_zeroconf

    aiozc = await ha_zeroconf.async_get_async_instance(hass)
    names: set[str] = set()

    def on_change(zeroconf: Zeroconf, service_type: str, name: str, state_change: ServiceStateChange) -> None:
        if state_change is not ServiceStateChange.Removed:
            names.add(name)

    browser = AsyncServiceBrowser(aiozc.zeroconf, HTTP_SERVICE, handlers=[on_change])
    try:
        await asyncio.sleep(SCAN_BROWSE_SECONDS)
    finally:
        await browser.async_cancel()

    candidates: list[tuple[str, str]] = []
    for name in sorted(names, key=lambda n: not n.lower().startswith(NAME_PREFIX)):
        info = AsyncServiceInfo(HTTP_SERVICE, name)
        if not info.load_from_cache(aiozc.zeroconf):
            await info.async_request(aiozc.zeroconf, _RESOLVE_TIMEOUT_MS)
        candidates.extend((name, address) for address in info.parsed_addresses(IPVersion.V4Only))
    return candidates
