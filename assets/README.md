# Integration icon

`brand-icon.svg` reuses the original calendar-and-flame artwork from the sibling Android project:
`direct/android/icons/app-icon/playstore-color.svg`. The artwork is original to ezGeyser Direct.
Only the solid launcher background and outer padding were removed; paths and gradient colours are unchanged.

Render the SVG on a transparent square canvas at 256 × 256 and 512 × 512 pixels to produce
`custom_components/ezgeyser/brand/icon.png` and `icon@2x.png`. The same icon works in both themes;
Home Assistant falls back to it for logos and dark variants. No manifest branding key is required.
