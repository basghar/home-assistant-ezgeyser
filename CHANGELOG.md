# Changelog

## 0.3.1 (2026-11-11)

- Binary sensors show descriptive states: sensor OK shows **OK / Fault**, burners **Flame / No flame**, elements
  **Heating / Off**, boost mode **Active / Inactive**. The stored states are still `on` and `off`, so automations and
  history are unchanged.
- Heating source is now a list sensor with the options Gas, Electric, Hybrid and Unknown. Only code 1 (Gas) is
  confirmed; any other code shows as Unknown, with the raw value in the `source_code` attribute. **The state changes
  from `Gas` to `gas`**: update any automation that compares it.

## 0.3.0 (2026-11-11)

First release.

- One device per geyser, identified by its MAC address and named by you; the name is the prefix of its entity IDs.
- Discovery through DHCP (`ezgeyser-*`) and mDNS (`_http._tcp`, `ezgeyser*`), a scan when the address is left empty,
  adding by IP address, and reconfiguring the address of the same geyser.
- 11 entities from `/quickStatus`, read every second: five temperature entities and six heating entities.
