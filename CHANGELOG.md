# Changelog

## 0.4.0 (2026-11-11)

- Add the responsive ezGeyser overview dashboard card with light/dark palettes, temperature and target readings,
  Boost, health badges, and custom flame/bolt icons with individual burner-side and element indicators.
- Split the tank bar into physical top and bottom halves, with continuous temperature colours and added relative
  contrast for small differences. Faulty sensors show dashes and hatched halves.
- Show unknown, missing-entity and unreachable states, with session-local last-known readings when available.
- Support single-element displays, bottom-as-main, renamed entity mappings, keyboard access and HA more-info.
- Bundle the card JavaScript with the integration; copy it to HA `www` and register it as a dashboard resource as
  described in the README. No additional entity types or device controls are introduced.
- Add frontend regression tests and a CI validation job.

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
