const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { catalog, apps } = require('../tweak-catalog');
const { createCatalogEngine } = require('../catalog-engine');
(async () => {
  const commands = [];
  const apply = createCatalogEngine(async script => { commands.push(script); return { success:true,output:'' }; }, fs.mkdtempSync(path.join(os.tmpdir(),'batman-engine-test-')));
  assert.equal((await apply('unknown', {enabled:true})).success, false);
  assert.equal((await apply(catalog[0].id, {})).success, false);
  assert.equal(commands.length, 0);
  for (const item of require('../retired-catalog')) {
    assert.equal((await apply(item.id, {enabled:true})).success,false);
    assert.equal((await apply(item.id, {enabled:false})).success,true);
    assert.match(commands.at(-1), /\$saved\.exists/);
  }
  for (const item of catalog) {
    assert.equal((await apply(item.id, {enabled:true})).success, true);
    assert.match(commands.at(-1), /GetValueKind/);
    assert.match(commands.at(-1), /Setting verification failed/);
    assert.ok(commands.at(-1).indexOf('ConvertTo-Json') < commands.at(-1).indexOf('New-ItemProperty'));
    assert.equal((await apply(item.id, {enabled:false})).success, true);
    assert.match(commands.at(-1), /\$saved\.exists/);
    assert.match(commands.at(-1), /\$saved\.kind/);
  }
  const dir = path.join(__dirname,'..');
  let nativeFailure = false;
  const context = { module:{exports:{}}, Buffer, require: name => name === 'child_process' ? { execFile: (file,args,options,cb) => {
    assert.equal(file,'powershell.exe'); assert.equal(options.windowsHide,true);
    commands.push(Buffer.from(args.at(-1),'base64').toString('utf16le'));
    cb(nativeFailure ? new Error('exit 1') : null, '', nativeFailure ? 'Access denied' : '');
  } } : name.startsWith('./') ? require(path.join(dir,name)) : require(name) };
  vm.runInNewContext(fs.readFileSync(path.join(dir,'tweaks-engine.js'),'utf8'), context);
  const engine = context.module.exports;
  for (const item of apps) {
    const result = await engine.removeBloatApps(item.id); assert.equal(result.success,true);
    assert.ok(!commands.at(-1).includes('-AllUsers')); assert.ok(!commands.at(-1).includes('Remove-AppxProvisionedPackage'));
    assert.ok(commands.at(-1).includes(item.packageName));
  }
  const fullDebloat = await engine.removeBloatApps('full');
  assert.equal(fullDebloat.success,true);
  assert.ok(commands.at(-1).includes('Microsoft.GetHelp'));
  assert.ok(commands.at(-1).includes('Microsoft.XboxGamingOverlay'));
  assert.ok(commands.at(-1).includes('Microsoft.Windows.DevHome'));
  assert.ok(!commands.at(-1).includes('-AllUsers'));
  assert.ok(!commands.at(-1).includes('Remove-AppxProvisionedPackage'));
  assert.equal((await engine.removeBloatApps("'; Remove-Item C:\\ -Recurse; '")).success,false);
  nativeFailure = true;
  assert.equal((await engine.runPowerShell('Write-Output test')).success,false);
  assert.equal(engine.runPowerShell.lastFailure,'Administrator permission is required for this Windows setting.');
  const parser = `$scripts=[Console]::In.ReadToEnd() | ConvertFrom-Json; foreach ($script in $scripts) { $tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseInput($script,[ref]$tokens,[ref]$errors); if ($errors.Count) { throw ($errors | Out-String) } }; 'PowerShell syntax checked without execution.'`;
  console.log(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(parser,'utf16le').toString('base64')],{input:JSON.stringify(commands),windowsHide:true,encoding:'utf8',maxBuffer:1024*1024}));
  console.log(`PASS ${catalog.length} catalog apply/restore scripts, ${apps.length} individual plus one curated full-debloat request, rejected unknown requests, surfaced command errors.`);
})().catch(error => { console.error(error); process.exitCode=1; });
