"""The only requests this integration may send to a geyser, and the check that enforces them.

The firmware has no authentication, so this integration must never send it anything but the reads it needs. A request
is allowed only if it is a plain-HTTP `GET` to a local-network host on port 80, with no query, userinfo or fragment,
for one of the read-only paths below. Everything else is refused before it leaves the process. Adding a path means
changing this module on purpose, together with its tests.
"""

import re
from typing import Final
from urllib.parse import urlsplit

HTTP_PORT: Final = 80
MAX_HOST_LENGTH: Final = 253

QUICK_STATUS_PATH: Final = "/quickStatus"
DATA_PATH: Final = "/data"
CLOUD_STATUS_PATH: Final = "/cloudStatus"
SCHEDULES_PATH: Final = "/api/schedules"
ALLOWED_PATHS: Final = frozenset({QUICK_STATUS_PATH, DATA_PATH, CLOUD_STATUS_PATH, SCHEDULES_PATH})

_MDNS_NAME = re.compile(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+local")


class RequestRefused(Exception):  # noqa: N818 - named after the Android `RequestRefusedException`, it is a verdict
    """Raised by `check_request` when a request is not on the read-only list."""


def lan_host(text: str) -> str | None:
    """`text` as a local-network host (trimmed, lowercased), or `None` if it is not one.

    Accepted: RFC 1918 private, link-local and loopback IPv4 in dotted-quad form without leading zeros, and mDNS
    `.local` names. Any non-ASCII character is refused, so no lookalike can turn a foreign string into an accepted one.
    """
    host = text.strip()
    if not host or len(host) > MAX_HOST_LENGTH or not host.isascii():
        return None
    host = host.lower()
    octets = _ipv4_octets(host)
    if octets is not None:
        return host if _is_local_ipv4(octets) else None
    return host if _MDNS_NAME.fullmatch(host) else None


def url_for(host: str, path: str) -> str:
    """The URL of `path` on the geyser at `host`, after `check_request` has allowed it."""
    url = f"http://{host}{path}"
    check_request("GET", url)
    return url


def check_request(method: str, url: str) -> None:
    """Return normally only for an allowed request; raise `RequestRefused` with the reason otherwise."""
    reason = _refusal(method, url)
    if reason is not None:
        raise RequestRefused(reason)


def _refusal(method: str, url: str) -> str | None:
    if method != "GET":
        return "only GET requests are allowed"
    if "?" in url or "#" in url:
        return "query parameters and fragments are not allowed"
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        return "not a valid URL"
    if parts.scheme != "http":
        return "only plain HTTP to the local network is allowed"
    if parts.username is not None or parts.password is not None or "@" in parts.netloc:
        return "credentials in the URL are not allowed"
    if parts.hostname is None or lan_host(parts.hostname) != parts.hostname:
        return "host is not a local-network address"
    if port not in (None, HTTP_PORT):
        return "only port 80 is allowed"
    if parts.path not in ALLOWED_PATHS:
        return "path is not on the read-only list"
    return None


def _ipv4_octets(host: str) -> tuple[int, ...] | None:
    parts = host.split(".")
    if len(parts) != 4:
        return None
    octets: list[int] = []
    for part in parts:
        if not part.isdigit() or (len(part) > 1 and part[0] == "0") or int(part) > 255:
            return None
        octets.append(int(part))
    return tuple(octets)


def _is_local_ipv4(octets: tuple[int, ...]) -> bool:
    first, second = octets[0], octets[1]
    return (
        first in (10, 127)
        or (first == 172 and 16 <= second <= 31)
        or (first == 192 and second == 168)
        or (first == 169 and second == 254)
    )
