"""Constants for the ezGeyser Direct integration."""

from datetime import timedelta
from typing import Final

DOMAIN: Final = "ezgeyser"
MANUFACTURER: Final = "KytherTek"
DEFAULT_NAME: Final = "ezGeyser"

CONF_HOSTNAME: Final = "hostname"
CONF_MODEL: Final = "model"

# Never faster than the geyser's own web UI polls it. See "How it polls" in the README.
POLL_INTERVAL: Final = timedelta(seconds=1)
# Seconds before the next try after 1, 2, 3... failures in a row. See "How it polls" in the README.
BACKOFF_SECONDS: Final = (2, 2, 4, 8, 15, 30)
# A geyser stays available through this many failed reads in a row; the next one makes it unavailable.
TOLERATED_FAILURES: Final = 2
# `/quickStatus` carries no identity, so the MAC address in `/data` is checked again this often.
IDENTITY_CHECK_INTERVAL: Final = timedelta(minutes=5)

# The same limits as the scan in the companion Android app.
SCAN_TIMEOUT_SECONDS: Final = 8
SCAN_BROWSE_SECONDS: Final = 3
MAX_PROBES: Final = 8
