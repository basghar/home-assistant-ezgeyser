const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../custom_components/ezgeyser/www/ezgeyser-card.js'),'utf8');
function setup(config = {}) {
  class Element {
    attachShadow() {
      const dialog = this.dialog = {innerHTML:'',open:false,on:{},addEventListener(type,fn){this.on[type]=fn},showModal(){this.open=true},close(){this.open=false;this.on.close?.()}};
      this.shadowRoot = {innerHTML:'',addEventListener(){},querySelector:selector => selector === 'dialog' ? dialog : this.card = {innerHTML:'',addEventListener(type,fn){this[type]=fn},querySelector(){}}};
    }
    toggleAttribute() {}
    dispatchEvent(event) { this.event = event; }
  }
  const context = vm.createContext({HTMLElement:Element,window:{},customElements:{get(){},define(){}},CustomEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}},Intl,Date});
  vm.runInContext(source + '\nthis.api = {EzGeyserCard,deviceEntities,FIELDS,tankColors,heatIcon,scheduleView};', context);
  const card = new context.api.EzGeyserCard();
  card._registry = Object.entries(context.api.FIELDS).map(([key,suffix]) => ({
    entity_id:`${['top','bottom','target','source','next_event'].includes(key) ? 'sensor' : 'binary_sensor'}.kitchen_${suffix}`,
    platform:'ezgeyser',device_id:'kitchen-device',unique_id:`mac_${suffix}`,
  }));
  card.setConfig({entity:'sensor.kitchen_temperature_top',name:'Kitchen',...config});
  const values = {top:'51.8',bottom:'47.2',target:'65',source:'gas',top_ok:'on',bottom_ok:'on',burner_left:'off',burner_right:'off',element_1:'off',element_2:'off',boost:'off',vacation:'off'};
  const states = Object.fromEntries(Object.entries(card._ids).map(([key,id]) => [id,{state:values[key],attributes:{unit_of_measurement:'°C',...(key==='source' ? {source_code:1}: {})},last_updated:'2026-11-11T00:00:00Z'}]));
  let hass = {states,locale:{language:'en',time_zone:'server',time_format:'12'},config:{time_zone:'UTC',unit_system:{temperature:'°C'}},themes:{darkMode:false}};
  card.hass = hass;
  return {card,api:context.api,
    update(changes,attributes){for(const [key,state] of Object.entries(changes)) states[card._ids[key]] = {...states[card._ids[key]],state,...(attributes ? {attributes} : {})};card.hass={...hass};return card.card.innerHTML;},
    html:()=>card.card.innerHTML};
}
test('idle, target, gas and electric bars, boost',() => {
  const t=setup(); assert.match(t.html(),/Sensors OK/);assert.match(t.html(),/Idle · Gas/);
  const html=t.update({burner_left:'on',element_2:'on',boost:'on'});
  assert.match(html,/Burner left side on/);assert.match(html,/Element 1 off, element 2 on/);assert.match(html,/>Heating</);assert.match(html,/>Boost</);
});
const EVENT = {target_temperature:60,heating_off:false,source:'gas',source_code:1,switch_over:false,repeat_days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday']};
function tomorrowAtSix() { const now=new Date(); return new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1,6)).toISOString(); }
test('right column: the target, then the next event with a +1 badge; modes move to the footer',() => {
  const t=setup();
  const html=t.update({boost:'on',vacation:'on'}) && t.update({next_event:tomorrowAtSix()},EVENT);
  assert.match(html,/<span>Target<\/span><span class="value">65°C<\/span>/);
  assert.match(html,/6:00 AM<\/span><span class="day-badge" aria-hidden="true">\+1<\/span><span class="quiet" aria-hidden="true">→<\/span><span class="value" aria-hidden="true">60°/);
  assert.match(html,/aria-label="Next scheduled event tomorrow at 6:00 AM, target 60 degrees"/);
  assert.match(html,/title="Tomorrow 6:00 AM: 60 °C, Gas, switch-over off"/);
  assert.ok(html.indexOf('Target') < html.indexOf('6:00 AM'));
  const footer=html.slice(html.indexOf('class="footer"'));
  assert.match(footer,/<span class="modes">.*>Boost<.*>Vacation</);
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
  assert.match(html,/Top sensor/);assert.doesNotMatch(html,/Status unknown/);assert.match(html,/half entity-button fault/);assert.match(html,/fault-text">—/);
  assert.match(t.update({bottom_ok:'off',bottom:'unknown'}),/2 issues/);
});
test('offline uses session cache and a fresh page has no invented readings',() => {
  const t=setup();const html=t.update(Object.fromEntries(Object.keys(t.card._ids).map(k=>[k,'unavailable'])));
  assert.match(html,/Unreachable/);assert.match(html,/51.8/);assert.match(html,/Last known values/);assert.doesNotMatch(html,/class="heat /);
  const fresh=setup();fresh.card._last=null;fresh.card._signature=null;
  assert.doesNotMatch(fresh.update({top:'unavailable'}),/Last available /);
});
test('source unknown code is shown without guessing or hiding activity',() => {
  const t=setup();t.card._hass.states[t.card._ids.source].attributes.source_code=3;
  assert.match(t.update({source:'unknown'}),/Idle · Source 3\?/);
  assert.match(t.update({burner_left:'unknown'}),/Heating status unknown/);
});
test('Fahrenheit zero target, bottom main, single element and HTML escaping',() => {
  const t=setup({main:'bottom',element_count:1,name:'<img src=x onerror=alert(1)>'});
  t.card._hass.states[t.card._ids.target].attributes.unit_of_measurement='°F';
  const html=t.update({target:'32',element_2:'on'});
  assert.match(html,/No target/);assert.match(html,/Element on/);assert.match(html,/M3.5 21H20.5/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
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
  const r=setup();r.update({top:'unavailable'});assert.match(r.update({top:'52.0'}),/Sensors OK/);assert.doesNotMatch(r.html(),/class="card stale/);
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
  for (const key of ['top','bottom','target','boost','vacation','next_event','source','burner_left','burner_right','element_1','element_2']) {
    t.card._ids[key] = `${['boost','vacation','burner_left','burner_right','element_1','element_2'].includes(key) ? 'binary_sensor' : 'sensor'}.renamed_${key}`;
    t.card._hass.states[t.card._ids[key]] = {state:'unknown',attributes:{}};
    t.card.card.click({target:{closest:selector=>selector==='[data-entity]' ? {dataset:{entity:key}} : null}});
    assert.equal(t.card.event.detail.entityId,t.card._ids[key]);
  }
  t.card.event=undefined;
  t.card.card.click({target:{closest:()=>null}});
  assert.equal(t.card.event,undefined);
});

test('gas and electric indicators expose independent sensor buttons',()=>{
  const t=setup();
  for (const key of ['burner_left','burner_right','element_1','element_2']) {
    assert.match(t.html(),new RegExp(`<button class="entity-button heat-button" data-entity="${key}"`));
  }
  const single=setup({element_count:1});
  assert.match(single.html(),/data-entity="element_1"/);
  assert.doesNotMatch(single.html(),/data-entity="element_2"/);
});
