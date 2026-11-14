"""Serve the bundled card and register it with the dashboard resource loader."""

from pathlib import Path
from urllib.parse import urlsplit

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig  # type: ignore[attr-defined]
from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

# The card is ES modules: ezgeyser-card.js imports the rest from card/. The whole folder is served under the
# integration's version, so an upgrade changes every module's URL and no browser keeps an old one.
CARD_ROOT = "/ezgeyser"
CARD_FILE = "ezgeyser-card.js"
# Resource URLs of earlier releases: unversioned, or added by hand to /local.
LEGACY_CARD_PATHS = (f"{CARD_ROOT}/{CARD_FILE}", f"/local/{CARD_FILE}")


def card_url(version: str) -> str:
    """Return the dashboard resource URL of the card in this version."""
    return f"{CARD_ROOT}/{version}/{CARD_FILE}"


def _is_card_resource(url: str) -> bool:
    path = urlsplit(url).path
    return path in LEGACY_CARD_PATHS or (path.startswith(f"{CARD_ROOT}/") and path.endswith(f"/{CARD_FILE}"))


async def async_register_card(hass: HomeAssistant) -> None:
    """Register once per HA startup; keep user dashboards intact."""
    if "frontend" not in hass.config.components:
        return

    integration = await async_get_integration(hass, "ezgeyser")
    version = str(integration.version)
    url = card_url(version)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(f"{CARD_ROOT}/{version}", str(Path(__file__).parent / "www"), False)]
    )
    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None or not isinstance(lovelace.resources, ResourceStorageCollection):
        # YAML resource lists are user-owned. HA's frontend loader also supports
        # integration-provided modules without changing that configuration.
        add_extra_js_url(hass, url)
        return

    resources = lovelace.resources
    await resources.async_get_info()  # Public API ensures resources are loaded before inspecting them.
    existing = [item for item in resources.async_items() if _is_card_resource(item["url"])]
    if existing:
        await resources.async_update_item(existing[0]["id"], {"url": url, "res_type": "module"})
        for duplicate in existing[1:]:
            await resources.async_delete_item(duplicate["id"])
    else:
        await resources.async_create_item({"url": url, "res_type": "module"})
