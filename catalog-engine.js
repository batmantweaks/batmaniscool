const { catalog } = require('./tweak-catalog');
const retired = require('./retired-catalog');
const fs = require('fs');
const path = require('path');
const quote = value => "'" + String(value).replace(/'/g, "''") + "'";

// Only catalog-defined paths, names and values can reach PowerShell.
function createCatalogEngine(run, directory) {
  return async function apply(id, payload) {
    const archived = retired.find(item => item.id === id);
    if (archived && payload?.enabled !== false) return {success:false,details:'This control has been retired. Only its saved original value can be restored.'};
    const item = catalog.find(item => item.id === id) || archived;
    if (!item || typeof payload?.enabled !== 'boolean') return { success: false, details: 'Unknown setting or missing on/off value.' };
    fs.mkdirSync(directory, { recursive: true });
    const backup = quote(path.join(directory, `${id}.json`));
    const prelude = `$p=${quote(item.path)}; $n=${quote(item.name)}; $backup=${backup};`;
    const restore = `if (Test-Path -LiteralPath $backup) {
      $saved = Get-Content -LiteralPath $backup -Raw | ConvertFrom-Json;
      if ($saved.exists) { New-Item -Path $p -Force | Out-Null; New-ItemProperty -LiteralPath $p -Name $n -Value $saved.value -PropertyType $saved.kind -Force | Out-Null }
      elseif (Test-Path -LiteralPath $p) { $key=Get-Item -LiteralPath $p; if ($key.GetValueNames() -contains $n) { Remove-ItemProperty -LiteralPath $p -Name $n } }
    } else { throw 'No original-value backup exists for this setting.' }`;
    const capture = `if (!(Test-Path -LiteralPath $backup)) {
      $exists=$false; $value=$null; $kind=$null;
      if (Test-Path -LiteralPath $p) { $key=Get-Item -LiteralPath $p; $exists=$key.GetValueNames() -contains $n; if ($exists) { $value=$key.GetValue($n); $kind=$key.GetValueKind($n).ToString() } }
      @{exists=$exists; value=$value; kind=$kind} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $backup -Encoding UTF8
    }`;
    const command = payload.enabled ? `${capture}; try {
      New-Item -Path $p -Force | Out-Null;
      New-ItemProperty -LiteralPath $p -Name $n -Value ${item.type === 'String' ? quote(item.value) : item.value} -PropertyType ${item.type} -Force | Out-Null;
      if ((Get-ItemPropertyValue -LiteralPath $p -Name $n) -ne ${quote(item.value)}) { throw 'Setting verification failed.' }
    } catch { $problem=$_; ${restore}; throw $problem }` : `${restore}; Remove-Item -LiteralPath $backup`;
    const result = await run(prelude + command);
    return { action: item.title, success: result.success, details: result.success ? (payload.enabled ? 'Setting saved and verified. ' + item.description : 'Restored the original registry value.') : result.output, undoPayload: result.success ? { enabled: !payload.enabled } : null };
  };
}
module.exports = { createCatalogEngine };
