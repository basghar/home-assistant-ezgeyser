#!/bin/sh
# Regenerates the README screenshots from harness.html with headless Chrome (simulated readings, no device needed).
set -eu
cd "$(dirname "$0")"
# The scheduled event times in harness.html render in this time zone and language, whoever runs this.
export TZ=Asia/Karachi LANG=en_US.UTF-8
chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
url="file://$PWD/harness.html"
for scene in dashboard-light dashboard-dark idle gas-heating electric-heating sensor-fault unreachable narrow details; do
  size=$("$chrome" --headless=new --lang=en-US --virtual-time-budget=3000 --dump-dom "$url?s=$scene" 2>/dev/null |
    sed -n 's:.*<title>\([0-9]*x[0-9]*\)</title>.*:\1:p')
  "$chrome" --headless=new --lang=en-US --hide-scrollbars --force-device-scale-factor=2 --virtual-time-budget=3000 \
    --window-size="$(echo "$size" | tr x ,)" --screenshot="$PWD/$scene.png" "$url?s=$scene" 2>/dev/null
  echo "$scene.png ($size)"
done
