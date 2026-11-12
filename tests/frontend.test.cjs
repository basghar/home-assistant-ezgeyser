const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../custom_components/ezgeyser/www/ezgeyser-card.js'),'utf8');
const SENSORS = ['top','bottom','target','source','next_event','timer','wifi'];
function setup(config = {}) {
  class Element {
    attachShadow() {
      const dialog = this.dialog = {innerHTML:'',open:false,on:{},addEventListener(type,fn){this.on[type]=fn},showModal(){this.open=true},close(){this.open=false;this.on.close?.()}};
      this.shadowRoot = {innerHTML:'',addEventListener(){},querySelector:selector => selector === 'dialog' ? dialog : selector === '.sample' ? {} : this.card = {innerHTML:'',addEventListener(type,fn){this[type]=fn},querySelector(){}}};
    }
    toggleAttribute() {}
    dispatchEvent(event) { this.event = event; }
  }
  const navigation = {entries:[],events:[]};
  const window = {history:{pushState(...args){navigation.entries.push(args)}},dispatchEvent(event){navigation.events.push(event)}};
  const context = vm.createContext({HTMLElement:Element,window,encodeURIComponent,customElements:{get(){},define(){}},CustomEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}},Intl,Date});
  vm.runInContext(source + '\nthis.api = {EzGeyserCard,deviceEntities,FIELDS,tankColors,heatIcon,scheduleView,fitLayout,fitClasses,wifiIcon,devicePage,STYLE};', context);
  const card = new context.api.EzGeyserCard();
  card._registry = Object.entries(context.api.FIELDS).map(([key,suffix]) => ({
    entity_id:`${SENSORS.includes(key) ? 'sensor' : 'binary_sensor'}.kitchen_${suffix}`,
    platform:'ezgeyser',device_id:'kitchen-device',unique_id:`mac_${suffix}`,
  }));
  card.setConfig({entity:'sensor.kitchen_temperature_top',name:'Kitchen',...config});
  const values = {top:'51.8',bottom:'47.2',target:'65',source:'gas',top_ok:'on',bottom_ok:'on',burner_left:'off',burner_right:'off',element_1:'off',element_2:'off',boost:'off',vacation:'off',timer:'0',wifi:'good',cloud:'on',clock:'off'};
  const states = Object.fromEntries(Object.entries(card._ids).map(([key,id]) => [id,{state:values[key],attributes:{unit_of_measurement:'°C',...(key==='source' ? {source_code:1}: {})},last_updated:'2026-11-11T00:00:00Z'}]));
  let hass = {states,devices:{'kitchen-device':{configuration_url:'http://192.168.1.50/'}},locale:{language:'en',time_zone:'server',time_format:'12'},config:{time_zone:'UTC',unit_system:{temperature:'°C'}},themes:{darkMode:false}};
  card.hass = hass;
  return {card,api:context.api,navigation,
    update(changes,attributes){for(const [key,state] of Object.entries(changes)) states[card._ids[key]] = {...states[card._ids[key]],state,...(attributes ? {attributes} : {})};card.hass={...hass};return card.card.innerHTML;},
    html:()=>card.card.innerHTML};
}
test('idle, target, gas and electric bars, boost',() => {
  const t=setup(); assert.match(t.html(),/All OK/);assert.match(t.html(),/<\/div><span class="state-text"><span class="activity ">Idle<\/span><\/span><\/div><button class="mode /);
  const html=t.update({burner_left:'on',element_2:'on',boost:'on'});
  assert.match(html,/Burner left side on/);assert.match(html,/Element 1 off, element 2 on/);assert.match(html,/class="activity heating">Heating</);assert.match(html,/>Boost</);
});
const EVENT = {target_temperature:60,heating_off:false,source:'gas',source_code:1,switch_over:false,repeat_days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday']};
function tomorrowAtSix() { const now=new Date(); return new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1,6)).toISOString(); }
test('right column: the target, the next event with a +1 badge, then the modes moved from the footer',() => {
  const t=setup();
  const html=t.update({boost:'on',vacation:'on'}) && t.update({next_event:tomorrowAtSix()},EVENT);
  assert.match(html,/<span>Target<\/span><span class="value">65°C<\/span>/);
  assert.match(html,/6:00 AM<\/span><span class="day-badge" aria-hidden="true">\+1<\/span><span class="quiet" aria-hidden="true">→<\/span><span class="value" aria-hidden="true">60°/);
  assert.match(html,/aria-label="Next scheduled event tomorrow at 6:00 AM, target 60 degrees"/);
  assert.match(html,/title="Tomorrow 6:00 AM: 60 °C, Gas, switch-over off"/);
  assert.ok(html.indexOf('Target') < html.indexOf('6:00 AM'));
  const right=html.slice(html.indexOf('class="right"'),html.indexOf('class="footer"'));
  assert.match(right,/6:00 AM.*<div class="modes"><button class="chip entity-button" data-entity="boost" aria-label="Boost on. Open boost details" title="Boost on">.*M4 13a8 8.*<span>Boost<\/span><\/button><button class="chip entity-button" data-entity="vacation" aria-label="Vacation on. Open vacation details" title="Vacation on">.*<span>Vacation<\/span>/);
  assert.doesNotMatch(html.slice(html.indexOf('class="footer"')),/chip|Boost|Vacation/);
  assert.doesNotMatch(t.update({boost:'off',vacation:'off'}),/class="modes"/);
  assert.doesNotMatch(html,/Read-only|Sensor fault|Next Scheduled Event/);
});
test('an event that turns heating off says Off, and no event says No schedule',() => {
  const t=setup();
  const html=t.update({next_event:tomorrowAtSix()},{...EVENT,target_temperature:null,heating_off:true});
  assert.match(html,/→<\/span><span class="value" aria-hidden="true">Off</);assert.match(html,/6:00 AM, heating off"/);assert.doesNotMatch(html,/0°/);
  assert.match(t.update({next_event:'unknown'}),/No schedule/);
  assert.doesNotMatch(t.update({top:'unavailable'}),/No schedule|6:00 AM/);
  const n=setup();delete n.card._hass.states[n.card._ids.next_event];n.card._signature=null;n.card._render();
  assert.match(n.html(),/<span class="line quiet">.*No schedule/);
});
test('today has no badge; days further ahead count up, in the server or browser zone',() => {
  const {api}=setup();const now=new Date('2026-11-11T10:00:00Z');
  const hass={locale:{language:'en',time_zone:'server',time_format:'24'},config:{time_zone:'Asia/Karachi',unit_system:{temperature:'°C'}}};
  const view=(at,attributes=EVENT)=>api.scheduleView({state:at,attributes},hass,now);
  assert.equal(view('2026-11-11T16:30:00Z').days,0);assert.equal(view('2026-11-11T16:30:00Z').time,'21:30');
  assert.equal(view('2026-11-11T19:30:00Z').days,1); // 00:30 the next day in Karachi
  assert.equal(view('2026-11-14T01:00:00Z').days,3);
  assert.equal(view('2026-11-14T01:00:00Z',{...EVENT,repeat_days:['monday','tuesday','wednesday','thursday','friday']}).repeats,'Weekdays');
  assert.equal(view('2026-11-14T01:00:00Z',{...EVENT,repeat_days:['sunday','wednesday']}).repeats,'Wed, Sun');
  assert.equal(view('2026-11-14T01:00:00Z',{...EVENT,repeat_days:null}).repeats,'Once');
  assert.equal(view('unknown'),null);
});
test('the event line opens a details window with every setting, and History opens more-info',() => {
  const t=setup();t.update({next_event:tomorrowAtSix()},{...EVENT,switch_over:true,source:'unknown',source_code:3});
  t.card.card.click({target:{closest:selector=>selector==='[data-action="schedule"]' ? {} : null}});
  const dialog=t.card.dialog;assert.equal(dialog.open,true);
  assert.match(dialog.innerHTML,/Tomorrow · .* · 6:00 AM/);assert.match(dialog.innerHTML,/<dt>Target<\/dt><dd>60 °C<\/dd>/);
  assert.match(dialog.innerHTML,/<dd>Source 3 \(unverified\)<\/dd>/);assert.match(dialog.innerHTML,/<dt>Switch-over<\/dt><dd>On, gas to electric<\/dd>/);
  assert.match(dialog.innerHTML,/<dt>Repeats<\/dt><dd>Every day<\/dd>/);
  dialog.on.click({target:{closest:selector=>selector==='[data-entity]' ? {dataset:{entity:'next_event'}} : null}});
  assert.equal(dialog.open,false);assert.equal(t.card.event.detail.entityId,t.card._ids.next_event);
  t.card.card.click({target:{closest:selector=>selector==='[data-action="schedule"]' ? {} : null}});
  dialog.on.click({target:dialog});assert.equal(dialog.open,false);
  t.card.card.click({target:{closest:selector=>selector==='[data-action="schedule"]' ? {} : null}});
  assert.equal(dialog.open,true);t.update({top:'unavailable'});assert.equal(dialog.open,false);
});
test('the heat-source rows can be turned off for a single-source geyser',() => {
  const t=setup({show_heat_source:false});
  assert.match(t.update({next_event:tomorrowAtSix()},{...EVENT,heating_off:true,target_temperature:null}),/title="Tomorrow 6:00 AM: heating off"/);
  t.card._openDetails();
  assert.doesNotMatch(t.card.dialog.innerHTML,/Heat source|Switch-over/);assert.match(t.card.dialog.innerHTML,/<dd>Heating off<\/dd>/);
  assert.throws(()=>setup({show_heat_source:'no'}));
  assert.equal(setup().api.EzGeyserCard.getConfigForm().schema.at(-1).name,'show_heat_source');
});
test('sensor faults stay faults and mask invalid numerical readings',() => {
  const t=setup();const html=t.update({top_ok:'off',top:'unknown'});
  assert.match(html,/aria-label="Top sensor fault".*<span>Top sensor<\/span>/);assert.doesNotMatch(html,/Status unknown/);assert.match(html,/half entity-button fault/);assert.match(html,/fault-text">—/);
  assert.match(t.update({bottom_ok:'off',bottom:'unknown'}),/2 issues/);
});
test('offline uses session cache and a fresh page has no invented readings',() => {
  const t=setup();const html=t.update(Object.fromEntries(Object.keys(t.card._ids).map(k=>[k,'unavailable'])));
  assert.match(html,/Unreachable/);assert.match(html,/51.8/);assert.match(html,/Last known values/);assert.doesNotMatch(html,/class="heat /);
  assert.doesNotMatch(html,/Open details/);assert.match(html,/aria-label="Open main temperature details"/);
  const fresh=setup();fresh.card._last=null;fresh.card._signature=null;
  assert.doesNotMatch(fresh.update({top:'unavailable'}),/Last available /);
});
test('the activity is the live state only: Idle, Heating, or nothing while unknown',() => {
  const t=setup();let html=t.html();
  assert.match(html,/<span class="activity ">Idle<\/span>/);assert.doesNotMatch(html,/· Gas|Idle ·|class="activity entity-button/);
  assert.match(t.update({burner_right:'on'}),/<span class="activity heating">Heating<\/span>/);
  html=t.update({burner_right:'off',burner_left:'unknown'});
  assert.doesNotMatch(html,/class="activity|Heating status unknown|Idle/);assert.match(html,/Burner status unknown/);
  // The mode pill still shows the configured source.
  assert.match(html,/class="mode entity-button" data-entity="source" aria-label="Mode: gas only/);
});
test('the status chip: outlined while idle, tinted by what heats (gas when both), outlined icons only while unknown',() => {
  const t=setup();
  // The chip's whole element: from its opening tag to the </div> that balances it.
  const chip=html=>{
    const start=html.indexOf('<div class="heat-status');let depth=0;if (start<0) return undefined;
    for (const tag of html.slice(start).matchAll(/<\/?div\b/g)) if ((depth+=tag[0]==='<div' ? 1 : -1)===0) return html.slice(start,start+tag.index+6);
  };
  const rule=selector=>t.api.STYLE.match(new RegExp(`(?:^|\\})${selector.replace(/[.]/g,'\\.')}\\{([^}]*)\\}`))?.[1];
  // Idle: the outline, then the icons, a divider and Idle.
  let html=t.html();
  assert.match(chip(html),/^<div class="heat-status"><div class="sources">.*data-entity="element_2"[^]*<span class="state-text"><span class="activity ">Idle<\/span><\/span><\/div>$/);
  assert.match(rule('.heat-status'),/height:20px;.*border:1px solid var\(--line-strong\);border-radius:10px/);assert.doesNotMatch(rule('.heat-status'),/background/);
  assert.match(rule('.state-text'),/padding-left:6px;margin-left:6px;border-left:1px solid var\(--line-strong\)/);
  // Heating: a 16% tint of the source colour, a transparent border of the same width, a 50% divider, and the timer inside.
  for (const [changes,tint] of [[{burner_left:'on'},'gas'],[{burner_right:'on'},'gas'],[{element_1:'on'},'electric'],[{element_2:'on'},'electric'],
    [{burner_left:'on',element_1:'on'},'gas'],[{burner_right:'on',element_2:'on'},'gas']]) {
    const reset={burner_left:'off',burner_right:'off',element_1:'off',element_2:'off'};
    html=t.update({...reset,...changes,timer:'25'});
    assert.match(chip(html),new RegExp(`^<div class="heat-status tint-${tint}">[^]*<span class="state-text"><span class="activity heating">Heating</span><button class="timer [^]*<span>25 left</span></button></span></div>$`),JSON.stringify(changes));
  }
  for (const source of ['gas','electric']) {
    assert.equal(rule(`.tint-${source}`),`background:color-mix(in srgb,var(--${source}) 16%,transparent);border-color:transparent`);
    assert.equal(rule(`.tint-${source} .state-text`),`border-left-color:color-mix(in srgb,var(--${source}) 50%,transparent)`);
  }
  // The tint only recolours the border, so the chip keeps its size; thin borders shrink together on dense screens.
  assert.doesNotMatch(t.api.STYLE,/\.tint-[a-z]+[^{]*\{[^}]*(border(-left)?(-width)?:|border-style|padding|height)/);
  assert.match(t.api.STYLE,/@media\(min-resolution:2dppx\)\{[^{]*\.heat-status,\.state-text\{border-width:\.5px\}/);
  // Unknown: the outline and the two dimmed icons only, with no tint even while a heat source reports on, and no divider
  // or text. A running timer stays, after the chip.
  html=t.update({burner_left:'unknown',burner_right:'off',element_1:'on',element_2:'off',timer:'25'});
  assert.match(chip(html),/^<div class="heat-status"><div class="sources">[^]*<\/div><\/div><\/div><\/div>$/);
  assert.doesNotMatch(chip(html),/state-text|activity|tint-|class="heat (gas|electric) on"|segment lit/);
  assert.match(chip(html),/aria-label="Burner status unknown"[^]*aria-label="Elements status unknown"/);
  assert.match(html,/<\/div><\/div><\/div><\/div><button class="timer entity-button" data-entity="timer"[^]*<span>25 left<\/span><\/button><button class="mode /);
  // At the last footer step only the state text shortens: the chip may shrink, but its icons, divider and timer clock stay.
  assert.equal(rule('.truncate-state .heat-status'),'flex:0 1 auto');
  assert.match(rule('.truncate-state .state-text'),/^display:grid;grid-auto-flow:column;grid-template-columns:minmax\(0,max-content\)/);
  assert.equal(rule('.truncate-state .activity'),'min-width:0');
  // Every sensor button stays reachable in every state; an unreachable card has no chip.
  assert.match(chip(html),/data-action="flame-history"/);
  for (const key of ['element_1','element_2']) assert.match(chip(html),new RegExp(`data-entity="${key}"`));
  assert.doesNotMatch(t.update({top:'unavailable'}),/heat-status/);
});
test('the mode pill: the word, a divider, then flame and bolt, allowed or not, with the words in its labels',() => {
  const t=setup();const pill=html=>html.match(/<button class="mode [^]*?<\/button>/)?.[0];
  const icons=html=>[...pill(html).matchAll(/class="(mode-icon(?: allowed)?|mode-arrow) ?"/g)].map(m=>m[1]);
  let html=t.html();
  assert.match(pill(html),/^<button class="mode entity-button" data-entity="source" aria-label="Mode: gas only. Open heating source details" title="Mode: gas only"><span class="mode-word">Mode<\/span><span class="mode-icons">/);
  assert.deepEqual(icons(html),['mode-icon allowed','mode-icon']);
  assert.ok(pill(html).indexOf('M12 2.5C12') < pill(html).indexOf('M13.6 2 5'));
  assert.doesNotMatch(pill(html),/Gas only|Hybrid|Electric/);
  html=t.update({source:'hybrid'});
  assert.match(pill(html),/aria-label="Mode: gas, with electric fallback. Open heating source details" title="Mode: gas, with electric fallback"/);
  assert.deepEqual(icons(html),['mode-icon allowed','mode-arrow','mode-icon allowed']);assert.match(pill(html),/M5 12h14M13 18l6-6M13 6l6 6/);
  html=t.update({source:'electric'});
  assert.match(pill(html),/title="Mode: electric only"/);assert.deepEqual(icons(html),['mode-icon','mode-icon allowed']);
  // The pill follows the status chip, which holds the timer, inside the start group.
  html=t.update({source:'gas',timer:'25'});assert.match(html,/<span>25 left<\/span><\/button><\/span><\/div><button class="mode /);
  // Content-sized, in neutral colours: allowed in the text colour, not allowed dimmer than the idle heat icons.
  assert.match(t.api.STYLE,/\.mode\{display:inline-flex;[^}]*height:20px;[^}]*border-radius:10px/);
  assert.doesNotMatch(t.api.STYLE.match(/\.mode\{[^}]*\}/)[0],/width/);
  assert.match(t.api.STYLE,/\.mode-icon\.allowed\{stroke:var\(--text\)\}/);assert.doesNotMatch(t.api.STYLE,/\.mode[-\w.]*\{[^}]*var\(--(gas|electric)\)/);
  assert.match(t.api.STYLE,/--mode-off:#C4C2CC/);assert.match(t.api.STYLE,/--mode-off:#4A4950/);
  // A missing source entity hides it; an unreachable card shows the last available time instead.
  assert.doesNotMatch(t.update({top:'unavailable'}),/class="mode /);
  const n=setup();delete n.card._hass.states[n.card._ids.source];n.card._signature=null;n.card._render();assert.doesNotMatch(n.html(),/class="mode /);
});
test('an unknown mode reads Mode | Unknown in muted text, with no glyph and no issue',() => {
  const t=setup();const pill=html=>html.match(/<button class="mode [^]*?<\/button>/)?.[0];
  const badge=html=>html.match(/<div class="badge [^]*?<\/div>/)[0];
  const known=t.html();
  t.card._hass.states[t.card._ids.source].attributes.source_code=3;let html=t.update({source:'unknown'});
  assert.equal(pill(html),'<button class="mode entity-button" data-entity="source" aria-label="Mode unknown (source code 3). Open heating source details" title="Mode unknown (source code 3)"><span class="mode-word">Mode</span><span class="quiet">Unknown</span></button>');
  // Not an issue: the badge is unchanged and nothing turns amber.
  assert.equal(badge(html),badge(known));assert.doesNotMatch(html,/\bwarn\b|class="badge warning/);
  // No circled question mark, or any other glyph, anywhere on the card.
  assert.doesNotMatch(html,/mode-question|M8 8a3.5 3/);assert.doesNotMatch(t.api.STYLE,/mode-question/);
  // Without a numeric code, the labels say Mode unknown alone; any unrecognised state reads the same.
  t.card._hass.states[t.card._ids.source].attributes={unit_of_measurement:'°C'};html=t.update({source:'unknown'});
  assert.match(pill(html),/aria-label="Mode unknown. Open heating source details" title="Mode unknown"><span class="mode-word">Mode<\/span><span class="quiet">Unknown<\/span><\/button>$/);
  assert.match(pill(t.update({source:'solar'})),/title="Mode unknown"><span class="mode-word">Mode<\/span><span class="quiet">Unknown<\/span>/);
  // The muted colour at the pill's own 11px, with no width reserved for it.
  assert.match(t.api.STYLE,/\.quiet\{color:var\(--tertiary\)\}/);
  for (const rule of t.api.STYLE.match(/[^{}]*\.quiet[^{}]*\{[^}]*\}/g)) assert.doesNotMatch(rule,/width|font-size/);
  // Every footer step keeps Unknown in full: only the Mode word and its divider ever hide.
  t.card._fit={chipsIcons:true,stacked:true,footerStep:3};t.card._signature=null;t.card._render();
  assert.match(pill(t.html()),/<span class="quiet">Unknown<\/span><\/button>$/);
  const hidden=[...t.api.STYLE.matchAll(/([^{}]+)\{display:none\}/g)].flatMap(m=>m[1].trim().split(','));
  assert.ok(hidden.includes('.no-mode-word .mode-word'));assert.ok(hidden.every(rule=>!/\.mode(?!-word)|\.quiet/.test(rule)),hidden.join(' '));
  // Switching back leaves no reserved space: the known pill is unchanged.
  assert.equal(pill(t.update({source:'gas'})),pill(known));
});
test('the mode word\'s footer saving is the word and divider, measured the same for every mode',() => {
  // A fake card where the Mode word starts at 200 and the value after it at 236: a 36 px saving.
  const measure=(t,width)=>{
    const rects={'.header':{width},'.left':{width:113},'.right':{width:148},'.footer':{width:330},'.mode-word':{left:200},
      '.mode-word + span':{left:236},'.timer':{width:0},'.timer .icon':{width:0},'.activity':{width:24},'.badge':{height:0}};
    const card={classList:{contains:()=>false},style:{setProperty(){}},className:'',getBoundingClientRect:()=>({width}),
      querySelector:selector=>rects[selector] && {getBoundingClientRect:()=>({width:0,left:0,height:0,...rects[selector]})}};
    t.card._card={...t.card._card,querySelector:selector=>selector==='.card' ? card : null};
    t.card._sampleSize={sampleLeft:113,sampleRight:144};t.card._width=width;t.card._fitKey=null;t.card._fitLayout();
    return t.card._fit.footerStep;
  };
  for (const source of ['gas','hybrid','unknown']) {
    const t=setup();t.update({source});
    assert.equal(measure(t,294),1,source);assert.equal(measure(t,293),3,source);
  }
});
test('the target line is always thermometer, Target, then the value',() => {
  const t=setup();let html=t.html();
  assert.match(html,/aria-label="Target temperature 65 °C. Open target temperature details" title="Target temperature 65 °C"><svg[^>]*><path d="M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0-4 0v8.5M10 9h4"\/><\/svg><span>Target<\/span><span class="value">65°C<\/span><\/button>/);
  html=t.update({target:'0'});
  assert.match(html,/title="Target temperature not set">.*M10 13.5.*<span>Target<\/span><span class="quiet">not set<\/span><\/button>/);
  html=t.update({target:'unknown'});
  assert.match(html,/title="Target temperature unknown">.*M10 13.5.*<span>Target<\/span><span class="quiet">unknown<\/span><\/button>/);
  assert.doesNotMatch(html,/No target|Target unknown|M12 3v3/);
});
test('Fahrenheit zero target, bottom main, single element and HTML escaping',() => {
  const t=setup({main:'bottom',element_count:1,name:'<img src=x onerror=alert(1)>'});
  t.card._hass.states[t.card._ids.target].attributes.unit_of_measurement='°F';
  const html=t.update({target:'32',element_2:'on'});
  assert.match(html,/<span class="quiet">not set<\/span>/);assert.match(html,/Element on/);assert.match(html,/M3.5 21H20.5/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
  assert.match(html,/number ">47.2/);
});
test('tank has visible contrast at one degree, equal colours at equality, null for faults',() => {
  const {api}=setup();const [a,b]=api.tankColors(43,42);
  assert.notEqual(a,b); assert.match(a,/67.33/);assert.match(b,/42.66/);
  const equal=api.tankColors(43,43);assert.equal(equal[0],equal[1]);assert.equal(api.tankColors(null,43)[0],'var(--off)');
});
test('configuration rejects invalid values and more-info uses main entity',() => {
  assert.throws(()=>setup({element_count:3}));assert.throws(()=>setup({main:'middle'}));assert.throws(()=>setup({entities:{top:'<script>'}}));
  const {card}=setup({main:'bottom'});card._moreInfo();assert.equal(card.event.detail.entityId,card._ids.bottom);
});
test('missing entities are explicit and recovery clears stale state',() => {
  const t=setup();delete t.card._hass.states[t.card._ids.target];t.card._signature=null;t.card._render();assert.match(t.html(),/Check entities/);
  const r=setup();r.update({top:'unavailable'});assert.match(r.update({top:'52.0'}),/All OK/);assert.doesNotMatch(r.html(),/class="card stale/);
});


test('picker stores a device ID and the standard form uses an integration-filtered device selector',async()=>{
  const {api}=setup();
  const config=await api.EzGeyserCard.getStubConfig({callWS:async()=>[
    {entity_id:'sensor.random_name',platform:'ezgeyser',device_id:'device-a'},
  ]});
  assert.equal(config.device_id,'device-a');assert.equal(config.entity,undefined);
  const form=api.EzGeyserCard.getConfigForm();
  assert.equal(form.schema[0].name,'device_id');
  assert.equal(form.schema[0].selector.device.filter[0].integration,'ezgeyser');
});
test('device selection resolves arbitrarily renamed entities and isolates other devices/integrations',()=>{
  const t=setup({device_id:'kitchen-device'});
  t.card._registry=t.card._registry.map(e=>({...e,entity_id:e.entity_id.replace('kitchen','arbitrary')}));
  t.card._registry.push({platform:'other',device_id:'kitchen-device',unique_id:'x_temperature_top',entity_id:'sensor.wrong'});
  t.card._registry.push({platform:'ezgeyser',device_id:'other-device',unique_id:'x_temperature_top',entity_id:'sensor.other'});
  t.card._resolveDevice();assert.equal(t.card._ids.top,'sensor.arbitrary_temperature_top');
  assert.equal(t.card._ids.element_2,'binary_sensor.arbitrary_heating_element_2');
});
test('registry loads from HA and missing devices never fall back to guessed entity names',async()=>{
  const t=setup({device_id:'kitchen-device'});const entries=t.card._registry;
  t.card._registry=undefined;t.card.hass={...t.card._hass,callWS:async()=>entries};
  await new Promise(resolve=>setImmediate(resolve));assert.equal(t.card._ids.top,'sensor.kitchen_temperature_top');
  t.card.setConfig({device_id:'nonexistent'});assert.equal(t.card._ids.top,null);assert.match(t.html(),/Check entities/);
  t.card._moreInfo();assert.equal(t.card.event,undefined);
});
test('entity registry updates refresh IDs, and pending subscriptions are cleaned up on disconnect',async()=>{
  const t=setup({device_id:'kitchen-device'});let onEvent,resolveSubscribe,unsubscribed=0;
  const entries=t.card._registry.map(e=>({...e,entity_id:e.entity_id.replace('kitchen','renamed')}));
  t.card.isConnected=true;
  t.card.hass={...t.card._hass,callWS:async()=>entries,connection:{subscribeMessage(cb){onEvent=cb;return new Promise(resolve=>resolveSubscribe=resolve);}}};
  onEvent();await new Promise(resolve=>setImmediate(resolve));assert.equal(t.card._ids.top,'sensor.renamed_temperature_top');
  t.card.isConnected=false;t.card.disconnectedCallback();resolveSubscribe(()=>unsubscribed++);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(unsubscribed,1);
});
test('switching devices clears cached readings, and a registry failure is explicit',async()=>{
  const t=setup({device_id:'kitchen-device'});assert.ok(t.card._last);
  t.card.setConfig({device_id:'another'});assert.equal(t.card._last,null);
  t.card._registry=undefined;t.card.hass={...t.card._hass,callWS:async()=>{throw Error('disconnected')}};
  await new Promise(resolve=>setImmediate(resolve));assert.match(t.html(),/Registry unavailable/);
});

test('individual readings open their corresponding entity, including renamed entities',()=>{
  const t=setup({main:'bottom'});
  for (const key of ['top','bottom','target','boost','vacation','next_event','source','element_1','element_2','timer','wifi','cloud','clock']) {
    t.card._ids[key] = `${SENSORS.includes(key) ? 'sensor' : 'binary_sensor'}.renamed_${key}`;
    t.card._hass.states[t.card._ids[key]] = {state:'unknown',attributes:{}};
    t.card.card.click({target:{closest:selector=>selector==='[data-entity]' ? {dataset:{entity:key}} : null}});
    assert.equal(t.card.event.detail.entityId,t.card._ids[key]);
  }
  t.card.event=undefined;
  t.card.card.click({target:{closest:()=>null}});
  assert.equal(t.card.event,undefined);
});

test('the whole flame opens History with both registry-resolved sensors, including renamed entities',()=>{
  const t=setup();
  for (const side of ['burner_left','burner_right']) {
    t.card._ids[side]=`binary_sensor.renamed_${side}`;
    t.card._hass.states[t.card._ids[side]]={state:'unavailable',attributes:{}};
  }
  t.card.card.click({target:{closest:selector=>selector==='[data-action="flame-history"]' ? {} : null}});
  const url=new URL(t.navigation.entries.at(-1)[2],'http://homeassistant.local');
  assert.equal(url.pathname,'/history');
  assert.equal(url.searchParams.get('entity_id'),`${t.card._ids.burner_left},${t.card._ids.burner_right}`);
  assert.equal(t.navigation.events.at(-1).type,'location-changed');
  assert.equal(t.card.event,undefined);
  assert.equal(t.navigation.entries.length,1);
  assert.match(t.html(),/aria-label="Open left and right flame sensor history"/);
});

test('flame history opens the remaining sensor and does nothing when both are missing',()=>{
  const t=setup();
  delete t.card._hass.states[t.card._ids.burner_right];
  t.card._openFlameHistory();
  const url=new URL(t.navigation.entries[0][2],'http://homeassistant.local');
  assert.equal(url.searchParams.get('entity_id'),t.card._ids.burner_left);
  delete t.card._hass.states[t.card._ids.burner_left];
  t.card._openFlameHistory();
  assert.equal(t.navigation.entries.length,1);
});

test('the flame and its two bars share one button; electric indicators have individual buttons',()=>{
  const t=setup();
  assert.equal((t.html().match(/data-action="flame-history"/g)||[]).length,1);
  assert.match(t.html(),/<button class="entity-button heat-control" data-action="flame-history"[^]*?<svg class="heat gas [^]*?class="glyph"[^]*?class="segment [^]*?class="segment [^]*?<\/svg><\/button>/);
  assert.doesNotMatch(t.html(),/data-entity="burner_(left|right)"/);
  for (const key of ['element_1','element_2']) {
    assert.match(t.html(),new RegExp(`<button class="entity-button heat-button" data-entity="${key}"`));
  }
  const single=setup({element_count:1});
  assert.match(single.html(),/data-entity="element_1"/);
  assert.doesNotMatch(single.html(),/data-entity="element_2"/);
});


test('the badge covers sensors and connectivity: All OK, one problem named, several counted and all listed',()=>{
  const t=setup();
  assert.match(t.html(),/<div class="badge " role="img" aria-label="All OK" title="All OK">.*M5 12l5 5L20 7.*<span>All OK<\/span>/);
  assert.match(t.update({wifi:'weak'}),/class="badge warning" role="img" aria-label="Weak Wi-Fi".*<span>Weak Wi-Fi<\/span>/);
  assert.match(t.update({wifi:'good',clock:'on'}),/<span>Clock off<\/span>/);
  const html=t.update({top_ok:'off',top:'unknown',wifi:'weak',cloud:'off',clock:'off'});
  assert.match(html,/aria-label="3 issues: Top sensor fault, Weak Wi-Fi, Cloud offline".*<span>3 issues<\/span>/);
  assert.match(t.update({bottom_ok:'off',bottom:'unknown',clock:'on'}),/aria-label="5 issues: Top sensor fault, Bottom sensor fault, Weak Wi-Fi, Cloud offline, Clock off"/);
  // Unknown connectivity is no issue.
  assert.match(setup().update({wifi:'unknown',cloud:'unavailable',clock:'unknown'}),/<span>All OK<\/span>/);
});
test('the footer end: icon-only Wi-Fi, cloud and a clock warning, each its own button, labelled together as one group',()=>{
  const t=setup();let html=t.html();
  assert.match(html,/<div class="status" role="group" aria-label="Wi-Fi Good, cloud online"><button class="wifi entity-button " data-entity="wifi" aria-label="Wi-Fi Good. Open Wi-Fi signal details" title="Wi-Fi Good"><svg class="icon wifi-icon"[^]*?<\/svg><\/button><button class="cloud entity-button " data-entity="cloud" aria-label="Cloud online. Open cloud connection details"/);
  assert.doesNotMatch(html,/data-entity="clock"/);
  html=t.update({wifi:'weak',cloud:'off',clock:'on'});
  assert.match(html,/role="group" aria-label="Wi-Fi Weak, cloud offline, clock off"/);
  assert.match(html,/class="wifi entity-button warn"[^>]*><svg class="icon wifi-icon"[^]*?<\/svg><\/button>/);
  assert.doesNotMatch(html,/<span>(Excellent|Good|Fair|Weak)<\/span>/);
  assert.match(html,/class="cloud entity-button warn" data-entity="cloud" aria-label="Cloud offline. Open cloud connection details".*M9.58 5.548/);
  assert.match(html,/class="clock entity-button warn" data-entity="clock" aria-label="Clock off. Open device clock details".*M20.986 12.502/);
  assert.match(t.update({wifi:'unknown'}),/aria-label="Cloud offline, clock off"/);
});
test('the Wi-Fi icon always draws the dot and three arcs, lighting 3, 2, 1 or none of them',()=>{
  const {api}=setup();
  for (const [level,lit] of [['excellent',3],['good',2],['fair',1],['weak',0]]) {
    const svg=api.wifiIcon(level);
    assert.match(svg,/<circle cx="12" cy="16.5" r="1.6" fill="currentColor"\/>/);
    assert.equal((svg.match(/stroke="currentColor"/g)||[]).length,lit);assert.equal((svg.match(/stroke="var\(--wifi-off\)"/g)||[]).length,3-lit);
  }
  // Unlit arcs stay countable: about 2.5:1 against the surface in both themes, lit ones well above 4.5:1.
  assert.match(api.STYLE,/--wifi-off:#9896A0/);assert.match(api.STYLE,/--wifi-off:#66656E/);
  assert.match(api.STYLE,/--on-primary:#FFFFFF/);assert.match(api.STYLE,/--on-primary:#13285E/);
});
test('the timer shows its raw number while running, and Heating is in the primary text colour',()=>{
  const t=setup();assert.doesNotMatch(t.html(),/data-entity="timer"/);
  const html=t.update({timer:'25',burner_left:'on'});
  assert.match(html,/<span class="activity heating">Heating<\/span><button class="timer entity-button" data-entity="timer" aria-label="Timer running, 25 left. Open timer details" title="Timer running, 25 left">.*<span>25 left<\/span>/);
  assert.match(t.api.STYLE,/\.activity\.heating\{color:var\(--text\)\}/);
  assert.doesNotMatch(t.update({timer:'unknown'}),/left</);
});
test('optional entities missing: no footer items, no issues, and the card still renders',()=>{
  const t=setup();
  for (const key of ['timer','wifi','cloud','clock','vacation','next_event']) delete t.card._hass.states[t.card._ids[key]];
  t.card._signature=null;t.card._render();const html=t.html();
  assert.match(html,/<span>All OK<\/span>/);assert.doesNotMatch(html,/Check entities|class="status"|data-entity="(wifi|cloud|clock|timer)"/);
  assert.match(html,/>Idle<\/span><\/span><\/div><button class="mode /);
  const legacy=setup();legacy.card._registry=legacy.card._registry.filter(e=>!/network_|device_clock|timer_/.test(e.unique_id));
  legacy.card._resolveDevice();assert.equal(legacy.card._ids.wifi,null);legacy.card._render();assert.match(legacy.html(),/All OK/);
});
test('every row has the same fixed height, derived from a full three-line right column',()=>{
  const {api}=setup();
  assert.match(api.STYLE,/--row-h:calc\(2 \* var\(--line-h\) \+ var\(--chip-h\) \+ 2 \* 6px\)/);
  assert.match(api.STYLE,/\.temperatures\{[^}]*min-height:var\(--row-h\)/);
  assert.match(api.STYLE,/\.tank\{width:11px;[^}]*align-self:stretch/);
  assert.match(api.STYLE,/\.number\{font-size:36px;font-weight:500/);assert.match(api.STYLE,/\.secondary\{[^}]*font-size:14px/);
  // No width-based rules: the adaptive steps come from measured widths only.
  assert.doesNotMatch(api.STYLE,/@container/);
});
test('the row stacks by the fixed sample alone; the chips and footer follow the card\'s own widths in order',()=>{
  const {api}=setup();const fit=m=>api.fitLayout({sampleLeft:113,sampleRight:144,left:113,right:148,footer:356,modeWord:59,timerText:49,activity:40,...m});
  assert.deepEqual({...fit({width:358})},{chipsIcons:false,stacked:false,footerLines:1,footerStep:0});
  assert.deepEqual({...fit({width:306})},{chipsIcons:false,stacked:false,footerLines:1,footerStep:1});
  assert.deepEqual({...fit({width:268})},{chipsIcons:true,stacked:false,footerLines:1,footerStep:2});
  // The sample needs exactly 113 + 10 + 144 = 267. Stacked, the right column has the full width again, so the chips keep
  // their words when they fit.
  assert.equal(fit({width:267}).stacked,false);assert.deepEqual({...fit({width:266})},{chipsIcons:false,stacked:true,footerLines:1,footerStep:2});
  assert.deepEqual({...fit({width:140})},{chipsIcons:true,stacked:true,footerLines:1,footerStep:3});
  assert.deepEqual({...fit({width:208})},{chipsIcons:false,stacked:true,footerLines:1,footerStep:3});
  // The mode pill remains visible even at very narrow widths.
  assert.deepEqual({...fit({width:207})},{chipsIcons:false,stacked:true,footerLines:1,footerStep:3});
  // The card's own content never decides: little content still stacks, the most never does.
  assert.equal(fit({width:266,left:80,right:90}).stacked,true);
  assert.deepEqual({...fit({width:300,left:200,right:200})},{chipsIcons:true,stacked:false,footerLines:1,footerStep:1});
  assert.equal(fit({width:271}).chipsIcons,false); // exactly left + 10 + right
  assert.equal(fit({width:297}).footerStep,1);assert.equal(fit({width:296}).footerStep,2);
  // A step with nothing to hide still counts, so the later steps keep their order.
  assert.equal(fit({width:300,modeWord:0,timerText:60}).footerStep,2);
  assert.equal(api.fitClasses({chipsIcons:true,stacked:false,footerStep:3}),'chips-icons no-mode-word no-timer-text truncate-state');
  assert.equal(api.fitClasses({chipsIcons:false,stacked:true,footerStep:1}),'stacked no-mode-word');
  const t=setup();t.card._fit={chipsIcons:true,stacked:false,footerStep:2};t.card._signature=null;t.card._render();
  assert.match(t.html(),/^<div class="card chips-icons no-mode-word no-timer-text">/);
  assert.deepEqual({...setup().card._fit},{chipsIcons:false,stacked:false,footerLines:1,footerStep:0});assert.match(setup().html(),/^<div class="card">/);
});
test('a footer that cannot fit one line wraps by the fixed sample, so every card of one width shares a height',()=>{
  const {api}=setup();
  // A sample footer line of 228 px, 154 px of it before the end group; this card's end group and mode pill save 50 each.
  const fit=m=>api.fitLayout({sampleLeft:113,sampleRight:144,sampleFooter:228,sampleStart:154,left:113,right:148,footer:356,
    modeWord:59,timerText:49,activity:40,status:50,mode:50,...m});
  assert.equal(fit({width:228}).footerLines,1);assert.equal(fit({width:227}).footerLines,2);
  assert.equal(fit({width:154}).footerLines,2);assert.equal(fit({width:153}).footerLines,3);
  // The card's own content never decides: a footer that would fit still wraps beside one that would not.
  assert.equal(fit({width:227,footer:100,status:0,mode:0}).footerLines,2);
  // The steps fit the first line only: without the end group, 356 - 50 - 59 - 49 = 198 fits 200 at step 2, not 3.
  assert.deepEqual({...fit({width:200})},{chipsIcons:false,stacked:true,footerLines:2,footerStep:2});
  // On three lines the mode pill leaves too, and its word saves nothing: 356 - 50 - 50 = 256, then - 0, - 49, - 40.
  assert.equal(fit({width:256}).footerLines,1);assert.equal(fit({width:150}).footerStep,3);
  assert.deepEqual({...fit({width:150,footer:250})},{chipsIcons:false,stacked:true,footerLines:3,footerStep:0});
  // An unmeasured sample keeps one line.
  assert.equal(api.fitLayout({width:100,footer:356,modeWord:0,timerText:0,activity:0}).footerLines,1);
  assert.equal(api.fitClasses({chipsIcons:false,stacked:true,footerLines:2,footerStep:0}),'stacked wrap-status');
  // On its own line the mode pill always drops its word; Unknown itself is never hidden (see the unknown mode test).
  assert.equal(api.fitClasses({chipsIcons:false,stacked:true,footerLines:3,footerStep:0}),'stacked wrap-status wrap-mode no-mode-word');
  const t=setup();t.card._fit={chipsIcons:true,stacked:true,footerLines:3,footerStep:3};t.card._signature=null;t.card._render();
  assert.match(t.html(),/^<div class="card chips-icons stacked wrap-status wrap-mode no-mode-word no-timer-text truncate-state">/);
  assert.match(t.html(),/<span class="quiet">Unknown<\/span>|<span class="mode-icons">/);
  // The end group takes the second line; on three, a zero-height break puts the mode pill under the status chip. The
  // footer reserves its lines' height even with nothing to wrap, such as an unreachable card's.
  const rule=selector=>t.api.STYLE.match(new RegExp(`(?:^|[}\\n])${selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\{([^}]*)\\}`))?.[1];
  assert.equal(rule('.wrap-status .footer'),'flex-wrap:wrap;row-gap:4px;min-height:49px');
  assert.equal(rule('.wrap-status .start'),'flex-basis:100%');
  assert.equal(rule('.wrap-mode .footer'),'min-height:73px');
  assert.equal(rule('.wrap-mode .start::after'),'content:"";flex-basis:100%;order:1');
  assert.equal(rule('.wrap-mode .mode'),'order:2;margin-top:4px');
});
test('the footer wrap rule measures the sample and the card\'s own end group and mode pill, each with its gap',()=>{
  const t=setup();
  const rects={'.header':{width:200},'.left':{width:113},'.right':{width:148},'.footer':{width:330,right:330},'.start':{right:280},
    '.mode':{right:280},'.start > :nth-last-child(2)':{right:230},'.mode-word':{left:200},'.mode-word + span':{left:236},
    '.timer':{width:40},'.timer .icon':{width:13},'.activity':{width:24},'.badge':{height:0}};
  const card={classList:{contains:()=>false},style:{setProperty(){}},className:'',getBoundingClientRect:()=>({}),
    querySelector:selector=>rects[selector] && {getBoundingClientRect:()=>({width:0,left:0,right:0,height:0,...rects[selector]})}};
  t.card._card={...t.card._card,querySelector:selector=>selector==='.card' ? card : null};
  const sample={'.left':113,'.right':144,'.footer':228,'.footer .start':154};
  t.card._sample={querySelector:selector=>({getBoundingClientRect:()=>({width:sample[selector]})})};
  const run=width=>{rects['.header'].width=width;t.card._sampleSize=null;t.card._width=width;t.card._fitKey=null;t.card._fitLayout();return {...t.card._fit};};
  // 220 px: two lines; 330 - 50 (end group) - 36 (word) - 27 (timer text) = 217 fits at step 2. One line would need step 3.
  assert.deepEqual(run(220),{chipsIcons:false,stacked:true,footerLines:2,footerStep:2});
  assert.deepEqual({...t.card._sampleSize},{sampleLeft:113,sampleRight:144,sampleFooter:228,sampleStart:154});
  assert.match(card.className,/^card stacked wrap-status no-mode-word no-timer-text$/);
  // 150 px: three lines; 330 - 50 - 50 (whole mode pill) = 230, less 0, 27 and 24 = 179, so every step applies.
  assert.deepEqual(run(150),{chipsIcons:false,stacked:true,footerLines:3,footerStep:3});
  assert.deepEqual(run(240),{chipsIcons:false,stacked:true,footerLines:1,footerStep:3});
});
test('the hidden sample holds the worst case, with the card\'s own classes and icon-only chips',()=>{
  const {card,api}=setup();const sample=card.shadowRoot.innerHTML.match(/<div class="sample chips-icons" aria-hidden="true">([\s\S]*?)<dialog/)[1];
  assert.match(sample,/<span class="number">88.8<\/span><span class="unit">°C<\/span>.*<div class="secondary">Bottom 88.8°C<\/div>/);
  assert.match(sample,/<span class="line">.*<span>Target<\/span><span class="value">72.5°C<\/span><\/span>/);
  assert.match(sample,/<span>12:30 PM<\/span><span class="day-badge">\+7<\/span><span class="quiet">→<\/span><span class="value">72.5°<\/span>/);
  assert.equal((sample.match(/class="chip"/g)||[]).length,2);
  // The widest footer once every step applies: both heat icons, an empty state text with the timer icon, a wordless
  // Unknown pill, then Wi-Fi, cloud and clock.
  const footer=sample.match(/<div class="footer">.*<\/div>$/)[0];
  assert.equal((footer.match(/class="heat-control"/g)||[]).length,2);
  assert.match(footer,/<span class="state-text"><span class="activity"><\/span><span class="timer"><svg/);
  assert.match(footer,/<span class="mode"><span class="quiet">Unknown<\/span><\/span><\/div><div class="status"><span class="wifi">.*<span class="cloud">.*<span class="clock">/);
  assert.doesNotMatch(footer,/mode-word|Heating|left</);
  assert.match(api.STYLE,/\.chips-icons \.chip\{width:var\(--chip-h\);padding:0\}/);assert.match(api.STYLE,/ha-card,\.sample\{font-family:/);
  assert.match(api.STYLE,/\.name\{[^}]*font-size:16px/);
});


test('the rightmost action is the selected device root page, separate from Home Assistant details',()=>{
  const t=setup();
  const link=()=>t.html().match(/<a class="details-button device-page-button"[^>]*>/)[0];
  assert.match(link(),/aria-label="Open device page in browser" title="Open 192.168.1.50" href="http:\/\/192.168.1.50\/" target="_blank" rel="noopener noreferrer"/);
  assert.ok(t.html().indexOf('aria-label="Open main temperature details"') < t.html().indexOf('data-action="device-page"'));
  t.card.card.click({target:{closest:selector=>['[data-action="device-page"]','[data-entity]'].includes(selector) ? {dataset:{entity:'top'}} : null}});
  assert.equal(t.card.event,undefined);
  t.card.card.click({target:{closest:selector=>selector==='[data-entity]' ? {dataset:{entity:'top'}} : null}});
  assert.equal(t.card.event.detail.entityId,t.card._ids.top);
  t.card._hass.devices['kitchen-device'].configuration_url='http://192.168.1.77/';
  t.update({});
  assert.match(link(),/title="Open 192.168.1.77" href="http:\/\/192.168.1.77\/"/);
  t.update({top:'unavailable'});
  assert.match(link(),/title="Open 192.168.1.77" role="link" aria-disabled="true" tabindex="-1"/);
  assert.doesNotMatch(link(),/href=|target=/);
  assert.match(t.update({top:'51.8'}),/href="http:\/\/192.168.1.77\/"/);
  delete t.card._hass.devices['kitchen-device'].configuration_url;
  t.update({});
  assert.match(link(),/title="Device address unavailable" role="link" aria-disabled="true"/);
  assert.doesNotMatch(link(),/href=/);
});
test('device page addresses come only from a valid local HTTP root URL',()=>{
  const {devicePage}=setup().api;
  for (const configuration_url of ['http://10.0.0.1/','http://172.16.0.1/','http://192.168.1.50/','http://169.254.1.1/','http://ezgeyser-123.local/']) {
    assert.equal(devicePage({configuration_url}).url,configuration_url);
  }
  for (const configuration_url of [undefined,'javascript:alert(1)','https://192.168.1.50/','http://192.168.1.50/settings','http://192.168.1.50/?x=1','http://user@192.168.1.50/','http://192.168.1.50:8080/','http://256.1.1.1/','http://192.168.01.50/','http://example.com/']) {
    assert.equal(devicePage({configuration_url}),null);
  }
  const t=setup({device_id:'another-device'});
  assert.doesNotMatch(t.html(),/href=/);
});
