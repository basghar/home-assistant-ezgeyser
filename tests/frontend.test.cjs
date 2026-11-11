const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../custom_components/ezgeyser/www/ezgeyser-card.js'),'utf8');
function setup(config = {}) {
  class Element {
    attachShadow() { this.shadowRoot = {innerHTML:'',addEventListener(){},querySelector:() => this.card = {innerHTML:'',addEventListener(){}}}; }
    toggleAttribute() {}
    dispatchEvent(event) { this.event = event; }
  }
  const context = vm.createContext({HTMLElement:Element,window:{},customElements:{get(){},define(){}},CustomEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}},Intl,Date});
  vm.runInContext(source + '\nthis.api = {EzGeyserCard,deviceEntities,FIELDS,tankColors,heatIcon};', context);
  const card = new context.api.EzGeyserCard();
  card._registry = Object.entries(context.api.FIELDS).map(([key,suffix]) => ({
    entity_id:`${['top','bottom','target','source'].includes(key) ? 'sensor' : 'binary_sensor'}.kitchen_${suffix}`,
    platform:'ezgeyser',device_id:'kitchen-device',unique_id:`mac_${suffix}`,
  }));
  card.setConfig({entity:'sensor.kitchen_temperature_top',name:'Kitchen',...config});
  const values = {top:'51.8',bottom:'47.2',target:'65',source:'gas',top_ok:'on',bottom_ok:'on',burner_left:'off',burner_right:'off',element_1:'off',element_2:'off',boost:'off'};
  const states = Object.fromEntries(Object.entries(card._ids).map(([key,id]) => [id,{state:values[key],attributes:{unit_of_measurement:'°C',...(key==='source' ? {source_code:1}: {})},last_updated:'2026-11-11T00:00:00Z'}]));
  let hass = {states,locale:{language:'en'},themes:{darkMode:false}};
  card.hass = hass;
  return {card,api:context.api,update(changes){for(const [key,state] of Object.entries(changes)) states[card._ids[key]] = {...states[card._ids[key]],state};card.hass={...hass};return card.card.innerHTML;},html:()=>card.card.innerHTML};
}
test('idle, target, gas and electric bars, boost',() => {
  const t=setup(); assert.match(t.html(),/Sensors OK/);assert.match(t.html(),/Idle · Gas/);
  const html=t.update({burner_left:'on',element_2:'on',boost:'on'});
  assert.match(html,/Burner left side on/);assert.match(html,/Element 1 off, element 2 on/);assert.match(html,/>Heating</);assert.match(html,/>Boost</);
});
test('sensor faults stay faults and mask invalid numerical readings',() => {
  const t=setup();const html=t.update({top_ok:'off',top:'unknown'});
  assert.match(html,/Top sensor/);assert.doesNotMatch(html,/Status unknown/);assert.match(html,/half fault/);assert.match(html,/fault-text">—/);
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
