#!/bin/sh
# Regenerates the README screenshots from harness.html with headless Chrome (simulated readings, no device needed).
set -eu
cd "$(dirname "$0")"
# The scheduled event times in harness.html render in this time zone and language, whoever runs this.
export TZ=Asia/Karachi LANG=en_US.UTF-8
chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
url="file://$PWD/harness.html"
# The stress scenes check that the widest values still fit, the chip-states scenes every status chip state, and the
# footer-check scene every footer layout; they go to check/ (gitignored), not the README. The harness checks each scene's
# layout and titles it FAIL with the problems, which stops this script.
mkdir -p check
for scene in dashboard-light dashboard-dark idle gas-heating electric-heating sensor-fault unreachable narrow details stress stress-dark chip-states chip-states-dark footer-check; do
  case $scene in stress*|chip-states*|footer-check) out="check/$scene.png" ;; *) out="$scene.png" ;; esac
  # Checked at 1x and at the screenshots' 2x, where the thin borders are half as wide.
  for scale in 1 2; do
    title=$("$chrome" --headless=new --lang=en-US --force-device-scale-factor=$scale --virtual-time-budget=3000 \
      --dump-dom "$url?s=$scene" 2>/dev/null | sed -n 's:.*<title>\(.*\)</title>.*:\1:p')
    size=$(echo "$title" | sed -n 's:^\([0-9]*x[0-9]*\)$:\1:p')
    [ -n "$size" ] || { echo "$scene at ${scale}x: ${title:-no title}" >&2; exit 1; }
  done
  "$chrome" --headless=new --lang=en-US --hide-scrollbars --force-device-scale-factor=2 --virtual-time-budget=3000 \
    --window-size="$(echo "$size" | tr x ,)" --screenshot="$PWD/$out" "$url?s=$scene" 2>/dev/null
  echo "$out ($size)"
done
