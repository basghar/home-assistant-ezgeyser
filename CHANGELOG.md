# Changelog

## 0.3.0 (2026-11-11)

First release.

- One device per geyser, identified by its MAC address and named by you; the name is the prefix of its entity IDs.
- Discovery through DHCP (`ezgeyser-*`) and mDNS (`_http._tcp`, `ezgeyser*`), a scan when the address is left empty,
  adding by IP address, and reconfiguring the address of the same geyser.
- 11 entities from `/quickStatus`, read every second: five temperature entities and six heating entities.
