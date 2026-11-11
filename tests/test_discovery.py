from unittest.mock import AsyncMock, patch

from custom_components.ezgeyser.api import Identity, NotAGeyser
from custom_components.ezgeyser.const import MAX_PROBES
from custom_components.ezgeyser.discovery import _candidates, async_scan

from homeassistant.core import HomeAssistant


def _identity(mac: str) -> Identity:
    return Identity(mac=mac, hostname=f"ezgeyser-{mac.replace(':', '').upper()}", model=None, sw_version=None,
                    hw_version=None)  # fmt: skip


async def test_candidates_put_ezgeyser_names_first_and_drop_public_and_duplicate_hosts(hass: HomeAssistant) -> None:
    dhcp = [("printer", "192.168.1.20"), ("ezgeyser-aabbccddeeff", "192.168.1.30")]
    mdns = [("Printer._http._tcp.local.", "192.168.1.20"), ("ezgeyser-1._http._tcp.local.", "192.168.1.31"),
            ("cloud._http._tcp.local.", "8.8.8.8")]  # fmt: skip
    with (
        patch("custom_components.ezgeyser.discovery._dhcp_candidates", return_value=dhcp),
        patch("custom_components.ezgeyser.discovery._mdns_candidates", AsyncMock(return_value=mdns)),
    ):
        assert await _candidates(hass) == ["192.168.1.30", "192.168.1.31", "192.168.1.20"]


async def test_scan_probes_one_at_a_time_skips_added_geysers_and_reports_each_once(hass: HomeAssistant) -> None:
    candidates = ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4", "10.0.0.5"]
    answers = {
        "10.0.0.2": _identity("aa:aa:aa:aa:aa:01"),
        "10.0.0.3": _identity("aa:aa:aa:aa:aa:02"),  # already added
        "10.0.0.4": _identity("aa:aa:aa:aa:aa:01"),  # the same geyser on a second address
        "10.0.0.5": _identity("aa:aa:aa:aa:aa:03"),
    }
    probed: list[str] = []

    async def probe(self: object) -> Identity:
        host = self.host  # type: ignore[attr-defined]
        probed.append(host)
        if host not in answers:
            raise NotAGeyser("HTTP 404")
        return answers[host]

    with (
        patch("custom_components.ezgeyser.discovery._candidates", AsyncMock(return_value=candidates)),
        patch("custom_components.ezgeyser.discovery.GeyserClient.probe", probe),
    ):
        found = await async_scan(hass, skip_hosts={"10.0.0.1"}, skip_macs={"aa:aa:aa:aa:aa:02"})

    assert probed == ["10.0.0.2", "10.0.0.3", "10.0.0.4", "10.0.0.5"]
    assert [(f.host, f.identity.mac) for f in found] == [
        ("10.0.0.2", "aa:aa:aa:aa:aa:01"),
        ("10.0.0.5", "aa:aa:aa:aa:aa:03"),
    ]


async def test_scan_stops_after_the_probe_budget(hass: HomeAssistant) -> None:
    candidates = [f"10.0.0.{n}" for n in range(1, 20)]
    probe = AsyncMock(side_effect=NotAGeyser("HTTP 404"))

    with (
        patch("custom_components.ezgeyser.discovery._candidates", AsyncMock(return_value=candidates)),
        patch("custom_components.ezgeyser.discovery.GeyserClient.probe", probe),
    ):
        assert await async_scan(hass, skip_hosts=set(), skip_macs=set()) == []

    assert probe.await_count == MAX_PROBES
