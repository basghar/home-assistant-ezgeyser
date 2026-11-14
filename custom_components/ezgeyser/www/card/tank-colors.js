// The tank bar's colours, one place to retune them (the Android app's TankColors is the same scale). One sRGB colour per
// whole degree from SCALE_MIN to SCALE_MAX, index = °C − SCALE_MIN, made once by linear OKLCH interpolation between
// anchors (°C: L C H) 15: .46 .16 264 · 22: .58 .15 262 · 28: .69 .13 270 · 35: .76 .12 300 · 40: .70 .16 325 ·
// 45: .64 .19 345 · 50: .60 .20 5 · 55: .55 .20 20 · 60: .50 .19 27. The table is the truth; never recompute it here.
// Blue is cold tap water, lavender skin temperature, orchid a comfortable shower, rose scald risk; 60 is the hottest the
// geyser reaches (targets stop at 55).
const SCALE_MIN = 15;
const SCALE_MAX = 60;

// prettier-ignore
const TEMP_COLORS = [
  '#2850B0', '#2C55B5', '#305BB9', '#3460BE', '#3966C3', '#3D6CC8', '#4271CD', '#4777D2', // 15–22
  '#507CD6', '#5981DB', '#6286DF', '#6B8BE3', '#7491E8', '#7C96EC', '#8697EE', '#9098F0', // 23–30
  '#9A9AF1', '#A39BF2', '#AC9CF2', '#B49EF2', '#BD9FF2', '#C098EE', '#C490E9', '#C888E3', // 31–38
  '#CB80DC', '#CF78D5', '#D171CC', '#D369C4', '#D562BA', '#D65AB1', '#D852A6', '#D94D9C', // 39–46
  '#D94791', '#DA4287', '#DA3D7B', '#DA3870', '#D73466', '#D5305C', '#D22C52', '#CF2848', // 47–54
  '#CC243D', '#C82237', '#C42031', '#BF1E2A', '#BB1B24', '#B7191C',                       // 55–60
];

const roundHalfUp = (t) => Math.floor(t + 0.5);
const tempColor = (c) => TEMP_COLORS[Math.min(SCALE_MAX, Math.max(SCALE_MIN, c)) - SCALE_MIN];

// [top, bottom] colours in °C; null for a sensor that is not reporting (its half is hatched). Neighbouring degrees look
// alike, so unequal readings move 1 °C apart, then shift together back inside the scale. The card prints the real values.
export function tankColors(top, bottom) {
  if (top === null || bottom === null) return [top, bottom].map((t) => (t === null ? null : tempColor(roundHalfUp(t))));
  const rt = roundHalfUp(top);
  const rb = roundHalfUp(bottom);
  if (rt === rb) return [tempColor(rt), tempColor(rb)];

  const s = rt > rb ? 1 : -1;
  let et = rt + s;
  let eb = rb - s;
  const hi = Math.max(et, eb);
  if (hi > SCALE_MAX) {
    et -= hi - SCALE_MAX;
    eb -= hi - SCALE_MAX;
  }
  const lo = Math.min(et, eb);
  if (lo < SCALE_MIN) {
    et += SCALE_MIN - lo;
    eb += SCALE_MIN - lo;
  }
  return [tempColor(et), tempColor(eb)];
}
