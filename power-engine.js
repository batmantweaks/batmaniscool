const fs = require('fs');
const path = require('path');
const options = require('./power-options');
const guidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function parseIndex(text) {
  const values = [...text.matchAll(/0x([0-9a-f]+)/gi)];
  if (values.length < 2) throw new Error('This power setting is not available on this PC.');
  return parseInt(values[values.length - 2][1],16); // AC then DC, independent of translated labels.
}
function createPowerEngine(run, directory) {
  async function command(args) {
    const result = await run(`powercfg.exe ${args}`);
    if(!result.success) throw new Error(result.output || 'Windows rejected the power setting.');
    return result.output;
  }
  return async (id,payload) => {
    const item=options.find(item=>item.id===id);
    if(!item) return {success:false,details:'Unknown power control.'};
    const restoring=payload?.restore===true;
    const choice=item.options.find(([value])=>String(value)===payload?.value);
    if(!restoring && !choice) return {success:false,action:item.title,details:'Select one of the listed values.'};
    let undoPayload;
    try {
      const activeText=await command('/getactivescheme');
      const active=activeText.match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)?.[0];
      if(!active) throw new Error('Windows did not return an active power plan.');
      fs.mkdirSync(directory,{recursive:true});
      const file=path.join(directory,`${id}.json`);
      let snapshot=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
      if(snapshot && (!guidPattern.test(snapshot.plan)||!Number.isInteger(snapshot.value)||snapshot.value<0||snapshot.value>0xffffffff)) throw new Error('Power backup is invalid.');
      if(restoring && !snapshot) throw new Error('No saved original value exists for this control.');
      // An existing backup belongs to its original plan; do not overwrite it with another plan's settings.
      if(snapshot && snapshot.plan.toLowerCase()!==active.toLowerCase()) throw new Error('Select the original power plan in Windows before applying or restoring this control.');
      const address=`${active} ${item.subgroup} ${item.setting}`;
      const before=parseIndex(await command(`/qh ${address}`));
      if(!snapshot) {
        snapshot={plan:active,value:before};
        fs.writeFileSync(file,JSON.stringify(snapshot),{flag:'wx'});
      }
      const target=restoring?snapshot.value:choice[0];
      try {
        await command(`/setacvalueindex ${address} ${target}`);
        await command(`/setactive ${active}`);
        if(parseIndex(await command(`/qh ${address}`))!==target) throw new Error('Power setting verification failed.');
      } catch(error) {
        try { await command(`/setacvalueindex ${address} ${before}`); await command(`/setactive ${active}`); }
        catch(rollback) { throw new Error(`${error.message} Rollback failed: ${rollback.message}. Saved backup retained.`); }
        throw error;
      }
      if(restoring) fs.unlinkSync(file); else undoPayload={restore:true};
      return {success:true,action:item.title,details:restoring?'Restored the saved plugged-in value.':`${choice[1]} saved and verified for the active plan (plugged in only).`,undoPayload};
    } catch(error) { return {success:false,action:item.title,details:error.message}; }
  };
}
module.exports={createPowerEngine,parseIndex};
