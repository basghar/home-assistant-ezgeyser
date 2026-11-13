# Changelog

## 0.6.8 (2026-11-13)

- Card: each tank half is coloured by its own sensor's reading, from blue for cold water (15 °C and below) through
  lavender, orchid, magenta and rose to red at 60 °C. Unequal readings are pushed one degree further apart, so even a
  1 °C difference shows. The halves are equal and separated by a small gap; a sensor that is not reporting is grey
  hatching. The bar's label reads, for example, "Top 52.4 °C, bottom 49.0 °C".

## 0.6.7 (2026-11-13)

- Card: require both flame sensors for gas **Heating**; either electric element still counts as heating. A lone
  flame input with both elements off shows **Flame detected** in an outlined chip. Individual sensor bars remain visible,
  and an active element with only one flame input uses the electric tint.

## 0.6.6 (2026-11-12)

- Card: the electrical icon and its bars form one history button, selecting one or both elements according to
  the card's **Electric elements** preference. Both flame and electrical history open the last six hours ending now.

## 0.6.5 (2026-11-12)

- Card: the flame icon and both sensor bars form one button that opens Home Assistant's History page with both
  flame sensors selected. Renamed entities are supported.

## 0.6.4 (2026-11-12)

- Keep the next scheduled event at its configured wall time. Small device clock differences could previously make
  a 04:30 schedule display as 04:29.

- Card: the target sits beside a thermometer icon. A target of 0 shows **Target not set**; a missing target still
  shows **Target unknown**.
- Card: the footer text is just **Heating** or **Idle**, and empty while the heating status is unknown. The selected
  heat source moves to a footer mode pill with flame and bolt icons; an unrecognised source reads **Unknown**.
- Card: the heat icons, **Heating** or **Idle** and the timer share one footer status chip. It is outlined while idle,
  tinted in the gas or electric colour while heating (gas when both heat), and outlined with only the dimmed icons while
  the heating status is unknown.
- Card: the Wi-Fi status is icon-only at every width; its tooltip, its label and the details it opens give the level.
  Unlit arcs stay visible, muted.
- Card: in a narrow card the mode pill loses its word first, then the timer's text is left out, then the state text is
  shortened. Cards narrower than about 260 px move the Wi-Fi and cloud icons to a second footer line, and narrower than
  about 185 px the mode pill too, so the footer no longer overlaps and **Unknown** always shows in full.
- Update the README screenshots and their descriptions.

## 0.6.3 (2026-11-12)

- Round the optional **Network Wi-Fi RSSI** sensor to 5 dBm steps, with a 1 dBm buffer around rounding boundaries
  to keep small fluctuations out of history. It remains disabled by default. The card's **Network Wi-Fi signal**
  still stores only a level, with no numerical RSSI attribute.

## 0.6.2 (2026-11-11)

- Card: add a top-right action that opens the geyser's embedded configuration page at `http://<device address>/`
  in a new browser tab. It uses the current device-registry address, shows that address in its tooltip, and is
  dimmed and disabled while unreachable. The custom gear-and-arrow and info icons use 95% of the status pill's visible
  height, with proportional widths, 10 px gaps and expanded 48 px touch targets.
- Card: the Wi-Fi icon sits 2 units higher in its 24-unit box, so its dot rests on the level word's baseline, level
  with the cloud; it sat low. The same in the Android app.

## 0.6.1 (2026-11-11)

- Card: the Wi-Fi icon lights 3 arcs for Excellent, 2 for Good, 1 for Fair and only the dot, in amber, for Weak; all
  three arcs are always drawn.
- Card: whether the readings stack no longer depends on what a card shows. Every card stacks below one width (about
  295 px with the default font), measured from a fixed widest-case sample with the card's own styles, the same rule as
  the Android app.
- Card: the name is 16 px.

## 0.6.0 (2026-11-11)

- Add five read-only entities from fields `/quickStatus` already sends, with no new requests: **Network Wi-Fi
  signal** (Excellent, Good, Fair or Weak, at the Android app's -50/-60/-70 dBm bands), **Network Wi-Fi RSSI** in dBm
  (disabled by default), **Network cloud connection**, **Device clock** (a problem while the geyser's clock is more
  than 2 minutes from Home Assistant's) and **Timer remaining** (the raw number; its unit is unverified). All but the
  timer are diagnostic. A firmware that leaves one of these fields out still works; only that entity is unknown.
- Keep the last schedules read when an `/api/schedules` read fails or is unreadable, as the Android app does, instead of
  showing "No schedule" until the next read a minute later.
- Card: a bigger reading (36 px) and tank bar; a right column of the
  target, the next event and, while on, the Boost (now a rocket) and Vacation chips; Wi-Fi level, cloud link and a
  clock warning at the end of the footer; the timer's time left while it runs. Every card keeps the same height, with
  the right column always centred.
- The badge now covers connectivity too: **All OK**, one problem by name (**Top sensor**, **Bottom sensor**, **Weak
  Wi-Fi**, **Cloud offline**, **Clock off**), or **N issues**.
- The card adapts from measured widths instead of its column width: in a narrow card the chips lose their words, then
  the Wi-Fi word and the timer's text are left out, then the state text is shortened. Text no longer shrinks. Cards
  narrower than about 270 px always stack their readings, so cards side by side keep the same height.

## 0.5.5 (2026-11-11)

- Redesign the card's right column: always two end-aligned lines, the current target and the next scheduled event as
  "6:00 AM +1 → 60°". The "+1" badge marks tomorrow (+2 and so on further ahead); an event that turns heating off
  shows "→ Off", and no event shows "No schedule". Screen readers hear the whole line as one sentence.
- Select the event line for a details window: date and time, target, heat source, switch-over from gas to electric,
  and repeat days. A new card option, **Show heat source and switch-over in schedule details**, hides those two rows
  for single-source geysers. On by default.
- Add the next event's settings as attributes of **Next scheduled event**: `target_temperature` (in your temperature
  unit), `heating_off`, `source`, `source_code`, `switch_over` and `repeat_days`.
- Add **Heating vacation mode**, a read-only binary sensor from `/quickStatus`.
- Move the Boost and new Vacation tags to the footer, and remove "Read-only" and "Sensor fault" from it. Every card is
  now the same height.
- The tank bar now spans exactly the main reading and the line under it.
- Fix the card failing to show its last update time when an optional entity, such as the new vacation sensor, is
  missing or disabled.

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
