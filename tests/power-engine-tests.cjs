const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const options = require('../power-options');
const {createPowerEngine,parseIndex} = require('../power-engine');
const plan = '381b4222-f694-41f0-9685-ff5bb260df2e';
function harness() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'batman-power-test-'));
  const state = {value:37, dc:19, active:plan, commands:[], unsupported:false, failActivation:false};
  const apply = createPowerEngine(async command => {
    state.commands.push(command);
    if (command.includes('/getactivescheme')) return {success:true,output:state.active};
    if (command.includes('/qh')) return state.unsupported ? {success:false,output:'Setting unavailable'} : {success:true,output:`Possible index 0x00\nAC 0x${state.value.toString(16)}\nDC 0x${state.dc.toString(16)}`};
    if (command.includes('/setacvalueindex')) state.value = Number(command.split(' ').at(-1));
    if (command.includes('/setactive') && state.failActivation) { state.failActivation=false; return {success:false,output:'Activation failed'}; }
    return {success:true,output:''};
  },directory);
  return {state,apply,directory};
}
(async () => {
  assert.equal(parseIndex('Index 0x0002\nAC 0x00000064\nDC 0x00000005'),100);
  assert.throws(()=>parseIndex('not supported'));
  const invalid = harness();
  for(const [id,payload] of [['missing',{}],['power-epp',{}],['power-epp',{value:'0; calc'}],['power-epp',{value:'101'}]]) assert.equal((await invalid.apply(id,payload)).success,false);
  assert.equal(invalid.state.commands.length,0);
  for (const item of options) {
    const h = harness();
    for (const [value] of item.options) {
      const result = await h.apply(item.id,{value:String(value)});
      assert.equal(result.success,true,result.details); assert.deepEqual(result.undoPayload,{restore:true});
      assert.equal(h.state.value,value); assert.equal(h.state.dc,19);
      assert.equal(JSON.parse(fs.readFileSync(path.join(h.directory,item.id+'.json'))).value,37);
    }
    assert.equal((await h.apply(item.id,{restore:true})).success,true);
    assert.equal(h.state.value,37); assert.equal(h.state.dc,19);
    assert.equal(fs.existsSync(path.join(h.directory,item.id+'.json')),false);
    assert.equal((await h.apply(item.id,{restore:true})).success,false);
    assert.ok(h.state.commands.every(command=>!command.includes('setdcvalueindex')));
  }
  const unsupported = harness(); unsupported.state.unsupported=true;
  assert.equal((await unsupported.apply('power-epp',{value:'0'})).success,false);
  assert.ok(!unsupported.state.commands.some(command=>command.includes('/set')));
  assert.equal(fs.readdirSync(unsupported.directory).length,0);
  const rollback = harness(); rollback.state.failActivation=true;
  assert.equal((await rollback.apply('power-epp',{value:'0'})).success,false);
  assert.equal(rollback.state.value,37);
  const mismatch=harness(); await mismatch.apply('power-epp',{value:'0'});
  mismatch.state.active='8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'; mismatch.state.commands=[];
  assert.equal((await mismatch.apply('power-epp',{restore:true})).success,false);
  assert.ok(!mismatch.state.commands.some(command=>command.includes('/set')));
  console.log(`PASS ${options.length} power controls / ${options.reduce((sum,item)=>sum+item.options.length,0)} choices, AC-only writes, original restore, rejected input, unavailable hardware, rollback, and plan mismatch. All commands mocked.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
