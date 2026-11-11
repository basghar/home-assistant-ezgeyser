# Changelog

## 0.5.4 (2026-11-11)

- Smooth the top and bottom tank temperatures: a median of the last 5 readings, a 10-second average and a 0.2 °C
  deadband. History drops from about 2,600 rows an hour per sensor to about 5 to 15 while cooling or idle; the card
  still updates every second and follows a heat-up within about 30 seconds. Other entities are unchanged.
- Add **Temperature top raw** and **Temperature bottom raw**, disabled by default, with every unsmoothed reading.
- Update the README screenshots to show the next scheduled event.

## 0.5.3 (2026-11-11)

- Open the corresponding entity details from individual card readings and each gas or electric sensor.

## 0.5.2 (2026-11-11)

- Show the next scheduled event on the overview card using a read-only timestamp sensor.
- Read schedules every minute; invalid schedules and an incorrect device clock show an unknown time. Weekday order follows the Android app’s unverified Sunday-first assumption.

## 0.5.1 (2026-11-11)

- Rename the burner entities to identify the left and right flame sensors on one burner.

## 0.5.0 (2026-11-11)

- Select the geyser by Home Assistant `device_id` using the standard device selector in the card editor.
- Resolve all readings through entity registry membership and stable integration unique IDs, without guessing
  entity IDs from a shared prefix. Refresh mappings on entity registry changes, including individual renames.
- Keep legacy entity and explicit mapping configurations working; migrate to `device_id` for rename resilience.
- Show registry loading/failure states and prevent opening more-info for nonexistent entities.

## 0.4.2 (2026-11-11)

- Automatically serve and register the bundled dashboard card, so installing the integration is sufficient for
  **ezGeyser overview** to appear in **Add card** after a restart and browser refresh. No file copying is needed.
- Add a visual geyser selector and settings for the name, main sensor, element count and theme. Resolve selected
  devices through the entity registry to support renamed entity IDs.
- Version the resource URL on upgrades and migrate earlier manual resource entries without changing dashboards.
- Update installation instructions for Home Assistant 2026.11 Marketplace.

## 0.4.1 (2026-11-11)

- Add local Home Assistant branding using the Android app’s original calendar-and-flame icon, with transparent
  256px and 512px PNGs. This replaces the missing-icon placeholder after updating and restarting Home Assistant.

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
