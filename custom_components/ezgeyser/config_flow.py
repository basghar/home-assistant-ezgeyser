"""Adding a geyser: discovered (DHCP or mDNS), found by a scan, or typed in by address. You name it in every case.

The unique ID is the geyser's MAC address from `/data`. The address is stored to reach it; when discovery sees the same
geyser at a new address, the stored address is updated instead of a second device being offered.
"""

import logging
import re
from typing import Any, override

import probatio

from homeassistant.config_entries import SOURCE_RECONFIGURE, ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_HOST, CONF_MAC, CONF_NAME
from homeassistant.helpers.device_registry import format_mac
from homeassistant.helpers.service_info.dhcp import DhcpServiceInfo
from homeassistant.helpers.service_info.zeroconf import ZeroconfServiceInfo

from .api import GeyserClient, GeyserError, Identity, NotAGeyser
from .const import CONF_HOSTNAME, CONF_MODEL, DEFAULT_NAME, DOMAIN
from .discovery import FoundGeyser, async_scan
from .guard import lan_host

_LOGGER = logging.getLogger(__name__)

CONF_DEVICE = "device"
# `ezgeyser-70041D123456`: the firmware puts its MAC address in its hostname and mDNS name.
_MAC_IN_NAME = re.compile(r"ezgeyser-([0-9a-f]{12})(?:\.|$)", re.IGNORECASE)


class EzGeyserConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._host = ""
        self._identity: Identity | None = None
        self._found: dict[str, FoundGeyser] = {}

    @override
    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Type an address, or leave it empty to scan."""
        errors: dict[str, str] = {}
        if user_input is not None:
            text = user_input.get(CONF_HOST, "").strip()
            if not text:
                return await self.async_step_pick_device()
            if (host := lan_host(text)) is None:
                errors[CONF_HOST] = "invalid_host"
            elif (error := await self._async_probe(host)) is not None:
                errors["base"] = error
            else:
                await self._async_set_identity(raise_on_progress=False)
                return await self.async_step_name()
        return self._async_show_user_form(errors)

    async def async_step_pick_device(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Pick one of the geysers a scan found."""
        if user_input is not None:
            found = self._found[user_input[CONF_DEVICE]]
            self._host, self._identity = found.host, found.identity
            await self._async_set_identity(raise_on_progress=False)
            return await self.async_step_name()
        entries = self._async_current_entries(include_ignore=False)
        self._found = {
            found.identity.mac: found
            for found in await async_scan(
                self.hass,
                skip_hosts={entry.data[CONF_HOST] for entry in entries},
                skip_macs={entry.unique_id for entry in entries if entry.unique_id},
            )
        }
        if not self._found:
            return self._async_show_user_form({"base": "no_devices_found"})
        choices = {mac: f"{found.identity.hostname} ({found.host})" for mac, found in self._found.items()}
        return self.async_show_form(
            step_id="pick_device",
            data_schema=probatio.Schema({probatio.Required(CONF_DEVICE): probatio.In(choices)}),
        )

    async def async_step_name(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Name the geyser. The name is the prefix of its entity IDs."""
        if user_input is not None:
            return self._async_create(user_input[CONF_NAME])
        return self.async_show_form(
            step_id="name",
            data_schema=self._name_schema(),
            description_placeholders=self._placeholders(),
        )

    @override
    async def async_step_dhcp(self, discovery_info: DhcpServiceInfo) -> ConfigFlowResult:
        """The router handed an address to a device named `ezgeyser-*`."""
        await self.async_set_unique_id(format_mac(discovery_info.macaddress))
        self._abort_if_unique_id_configured(updates={CONF_HOST: discovery_info.ip})
        return await self._async_discovered(discovery_info.ip)

    @override
    async def async_step_zeroconf(self, discovery_info: ZeroconfServiceInfo) -> ConfigFlowResult:
        """A device named `ezgeyser*` advertised `_http._tcp` over mDNS."""
        host = str(discovery_info.ip_address)
        if (mac := _mac_in_name(discovery_info.name)) is not None:
            # Known geysers are recognised by name, without sending them a request.
            await self.async_set_unique_id(mac)
            self._abort_if_unique_id_configured(updates={CONF_HOST: host})
        return await self._async_discovered(host)

    async def async_step_discovery_confirm(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Add a discovered geyser, under the name you give it."""
        if user_input is not None:
            return self._async_create(user_input[CONF_NAME])
        return self.async_show_form(
            step_id="discovery_confirm",
            data_schema=self._name_schema(),
            description_placeholders=self._placeholders(),
        )

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Change the address of a geyser that was added. It must still be the same geyser."""
        entry = self._get_reconfigure_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            if (host := lan_host(user_input[CONF_HOST])) is None:
                errors[CONF_HOST] = "invalid_host"
            elif (error := await self._async_probe(host)) is not None:
                errors["base"] = error
            else:
                await self._async_set_identity(raise_on_progress=False)
                self._abort_if_unique_id_mismatch(reason="wrong_device")
                return self.async_update_reload_and_abort(entry, data_updates={CONF_HOST: host})
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self.add_suggested_values_to_schema(
                probatio.Schema({probatio.Required(CONF_HOST): str}), user_input or entry.data
            ),
            errors=errors,
        )

    async def _async_discovered(self, host: str) -> ConfigFlowResult:
        if lan_host(host) != host:
            return self.async_abort(reason="not_ezgeyser")
        if (error := await self._async_probe(host)) is not None:
            return self.async_abort(reason=error)
        await self._async_set_identity()
        self.context["title_placeholders"] = {"name": self._identity.hostname if self._identity else host}
        return await self.async_step_discovery_confirm()

    async def _async_probe(self, host: str) -> str | None:
        """Identify the geyser at `host`; return an error key if it is not one."""
        try:
            self._identity = await GeyserClient(self.hass, host).probe()
        except NotAGeyser as error:
            _LOGGER.debug("%s is not an ezGeyser: %s", host, error)
            return "not_ezgeyser"
        except GeyserError as error:
            _LOGGER.debug("%s does not answer: %s", host, error)
            return "cannot_connect"
        self._host = host
        return None

    @property
    def _probed(self) -> Identity:
        if self._identity is None:
            raise RuntimeError("no geyser has been identified in this flow")
        return self._identity

    async def _async_set_identity(self, *, raise_on_progress: bool = True) -> None:
        await self.async_set_unique_id(self._probed.mac, raise_on_progress=raise_on_progress)
        if self.source != SOURCE_RECONFIGURE:
            self._abort_if_unique_id_configured(updates={CONF_HOST: self._host})

    def _async_create(self, name: str) -> ConfigFlowResult:
        identity = self._probed
        return self.async_create_entry(
            title=name.strip() or self._suggested_name(),
            data={
                CONF_HOST: self._host,
                CONF_MAC: identity.mac,
                CONF_HOSTNAME: identity.hostname,
                CONF_MODEL: identity.model,
            },
        )

    def _async_show_user_form(self, errors: dict[str, str]) -> ConfigFlowResult:
        return self.async_show_form(
            step_id="user",
            data_schema=probatio.Schema({probatio.Optional(CONF_HOST, default=""): str}),
            errors=errors,
        )

    def _name_schema(self) -> probatio.Schema:
        return probatio.Schema({probatio.Required(CONF_NAME, default=self._suggested_name()): str})

    def _suggested_name(self) -> str:
        mac = self._identity.mac if self._identity else ""
        return f"{DEFAULT_NAME} {mac.replace(':', '')[-4:].upper()}".strip()

    def _placeholders(self) -> dict[str, str]:
        hostname = self._identity.hostname if self._identity else ""
        return {"host": self._host, "hostname": hostname}


def _mac_in_name(name: str) -> str | None:
    found = _MAC_IN_NAME.match(name)
    return format_mac(found[1]) if found else None
