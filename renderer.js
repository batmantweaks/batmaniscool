// Renderer Logic for Batman System Utility

document.addEventListener('DOMContentLoaded', () => {

  // --- PENDING TWEAKS EXPLICIT APPLY SYSTEM ---
  const pendingTweaks = {}; // Stores { tweakId: payload }
  let applying = false;
  const profileOwned = new Map();
  const initialTweakStates = new Map(
    [...document.querySelectorAll('.tweak-toggle, .tweak-select')].map(control => [control, control.type === 'checkbox' ? control.checked : control.value])
  );

  function updatePendingUI() {
    const pendingBar = document.getElementById('pending-changes-bar');
    const pendingCountLabel = document.getElementById('pending-count-label');
    const keys = Object.keys(pendingTweaks);

    if (pendingCountLabel) pendingCountLabel.textContent = keys.length;

    if (keys.length > 0) {
      pendingBar?.classList.add('visible');
    } else {
      pendingBar?.classList.remove('visible');
    }

    // Update status chips on tweak cards
    document.querySelectorAll('.tweak-card[data-tweak]').forEach(card => {
      const tweakId = card.getAttribute('data-tweak');
      const chip = card.querySelector('.status-chip');
      if (!chip) return;

      if (pendingTweaks[tweakId] !== undefined) {
        card.classList.add('pending');
        chip.textContent = 'PENDING';
        chip.className = 'status-chip pending';
      } else {
        card.classList.remove('pending');
        chip.textContent = '';
        chip.className = 'status-chip';
      }
    });
    document.dispatchEvent(new Event('queue-updated'));
  }

  document.querySelectorAll('.power-restore').forEach(button => button.addEventListener('click', () => {
    stageTweak(button.dataset.powerId, { restore: true });
    document.querySelector(`[data-tweak-id="${button.dataset.powerId}"]`).value = '';
  }));

  // Staging is deliberately separate from execution. Nothing in this function
  // touches Windows; it only adds the requested action to the review queue.
  function stageTweak(tweakId, payload = {}) {
    if (applying) return;
    profileOwned.delete(tweakId);
    const toggles = [...document.querySelectorAll(`[data-tweak-id="${tweakId}"]`)].filter(control => control.type === 'checkbox');
    if (toggles.length && typeof payload.enabled !== 'boolean') payload = { enabled: true };
    toggles.forEach(control => control.checked = payload.enabled);
    pendingTweaks[tweakId] = payload;
    updatePendingUI();
    showToast('Added to pending changes. Review and press Apply Changes to run it.', 'info');
  }

  const HISTORY_KEY = 'batmaniscool_change_history';
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (error) { return []; }
  }
  function saveHistory(items) { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50))); }
  function recordAppliedChange(tweakId, payload, result) {
    const hasToggleInverse = typeof payload?.enabled === 'boolean';
    const item = { id: `${Date.now()}-${tweakId}`, tweakId, action: result.action || tweakId, details: result.details || 'Applied through batmaniscool.', timestamp: new Date().toISOString(), inverse: result.undoPayload || (hasToggleInverse ? { enabled: !payload.enabled } : null), reverted: false };
    saveHistory([item, ...getHistory()]);
  }
  function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    const history = getHistory();
    list.replaceChildren();
    if (!history.length) { list.innerHTML = '<div class="history-empty">No changes have been applied through batmaniscool yet.</div>'; return; }
    history.forEach(item => {
      const entry = document.createElement('div'); entry.className = 'history-entry';
      const icon = document.createElement('div'); icon.className = 'history-entry-icon'; icon.innerHTML = `<i class="fa-solid ${item.reverted ? 'fa-arrow-rotate-left' : 'fa-check'}"></i>`;
      const copy = document.createElement('div'); copy.className = 'history-entry-copy';
      const title = document.createElement('strong'); title.textContent = item.action;
      const detail = document.createElement('span'); detail.textContent = item.reverted ? 'Reverted through History & Undo.' : item.details;
      copy.append(title, detail);
      const time = document.createElement('time'); time.textContent = new Date(item.timestamp).toLocaleString();
      entry.append(icon, copy, time);
      if (item.inverse && !item.reverted) {
        const undo = document.createElement('button'); undo.className = 'btn-secondary'; undo.type = 'button'; undo.textContent = 'Revert';
        undo.addEventListener('click', async () => {
          if (applying || !window.confirm(`Revert “${item.action}”? ${item.inverse.restore ? 'This restores the original value saved before this control was first applied.' : 'This runs the recorded inverse action.'}`)) return;
          const result = await window.electronAPI?.applyTweak(item.tweakId, item.inverse);
          if (result?.success) { const updated = getHistory().map(historyItem => historyItem.id === item.id ? { ...historyItem, reverted: true } : historyItem); saveHistory(updated); renderHistory(); showToast(`${item.action} reverted.`, 'success'); }
          else showToast(result?.details || 'The change could not be reverted.', 'warning');
        });
        entry.append(undo);
      }
      list.append(entry);
    });
  }

  // Plain-language explanations are intentionally available before a user
  // queues anything, so the app is transparent about each change.
  const tweakDetails = {
    ...Object.fromEntries(window.powerOptions.map(item => [item.id, [item.title, item.description + ' Applies only to the active plan while plugged in; battery values stay unchanged. Choose a value on the card first. Unsupported hardware reports an error. Queue original value restores the saved pre-change setting on the same plan.'] ])),
    ...Object.fromEntries(window.tweakCatalog.catalog.map(item => [item.id, [item.title, item.description + ' Turn off to restore the original value captured before applying.'] ])),
    'changelog': ['batmaniscool changelog', 'See what has changed in the app and how the safety workflow has evolved.'],
    'game-mode': ['Windows Game Mode', 'Asks Windows to prioritize the active game when managing system resources.'],
    'hags': ['Hardware GPU Scheduling', 'Lets supported graphics hardware take a more direct role in scheduling video memory. Windows may require a restart.'],
    'power-throttling': ['Background Power Throttling', 'Prevents Windows from aggressively slowing background work. It can use more battery power on laptops.'],
    'gaming-responsiveness': ['Gaming Multimedia Scheduling', 'Writes the documented Windows SystemProfile responsiveness value used by multimedia scheduling. It can help keep an active game or audio workload responsive, but it is not a guaranteed FPS increase.'],
    'usb-selective-suspend': ['USB Selective Suspend', 'Turns off USB power saving in the active power plan. This can reduce wake-up delays for connected devices, but it uses more battery power.'],
    'pcie-link-state': ['PCI Express Link-State Power Saving', 'Turns off PCIe link power saving in the active power plan. This can avoid aggressive power-state transitions, but can raise heat and power use.'],
    'processor-boost': ['CPU Boost Mode', 'Uses a more responsive CPU boost setting while plugged in. It may increase fan noise and temperature, especially on laptops.'],
    'transparency': ['Reduce Windows Transparency', 'Turns off Windows transparency effects. This is a reversible appearance change that can slightly reduce desktop visual overhead on lower-powered PCs.'],
    'app-launch-tracking': ['App Launch Tracking', 'Stops Windows from using a recent-app history for Start and Search suggestions. This is a privacy and background-activity preference, not a guaranteed FPS improvement.'],
    'tcp-ack-profile': ['Advanced TCP ACK Latency Profile', 'Writes TCP acknowledgement values to each currently active network adapter. It can change online-game network behavior and needs a restart before testing. Turn it off to remove the custom values.'],
    'games-priority-profile': ['Games Scheduling Priority Profile', 'Writes multimedia SystemProfile values for the Windows Games task, favoring its CPU, GPU, and I/O scheduling category. Restart recommended.'],
    'high-performance-gpu': ['Default High-Performance GPU Preference', 'Writes the Windows DirectX global GPU preference to favor the high-performance GPU where a system has more than one GPU. Per-app Windows and NVIDIA settings can override it.'],
    'memory-compression': ['Memory Compression', 'Turns off Windows memory compression. This is best tested on PCs with plenty of RAM; it can use more memory and is not right for every PC.'],
    'ntfs-last-access': ['NTFS Last-Access Updates', 'Stops NTFS from updating an access timestamp on every file read. This can reduce metadata writes but is an advanced system behavior change.'],
    'tcp-fast-open': ['TCP Fast Open', 'Enables the Windows TCP Fast Open feature. It may reduce connection setup time only with compatible game services and servers.'],
    'cpu-minimum-state': ['CPU Minimum Performance State', 'Sets the active power plan to keep the CPU at a 100% minimum state. It reduces downclocking delays but increases heat, fan speed, and battery use.'],
    'active-cooling': ['Active Cooling Policy', 'Makes Windows raise fan cooling before asking the CPU to throttle. This can help sustained performance but may noticeably increase fan noise.'],
    'disk-idle-timeout': ['Disk Idle Timeout', 'Prevents the active power plan from putting disks into an idle sleep state. It can avoid storage wake delays but uses more power.'],
    'network-adapter-power': ['Network Adapter Power Saving', 'Removes Windows permission to power down active physical network adapters. This may help avoid adapter wake behavior but can use more power.'],
    'game-bar-overlay': ['Game Bar Overlay', 'Turns off the Game Bar overlay and Windows app-capture switch. It is separate from the Game DVR setting so you can control the overlay itself.'],
    'fullscreen-optimizations': ['Fullscreen Optimizations', 'Sets the Windows GameConfigStore preference for fullscreen optimizations. Individual games can still use their own compatibility settings.'],
    'edge-background': ['Edge Background Tasks', 'Writes Microsoft Edge policy values that turn off Startup Boost and background mode.'],
    'copilot-policy': ['Windows Copilot', 'Sets a current-user Windows policy that turns off Copilot.'],
    'telemetry': ['Windows Telemetry', 'Changes Windows diagnostic-data policy and attempts to stop the related tracking service.'],
    'background-apps': ['Background Apps', 'Prevents Microsoft Store apps from continuing selected tasks in the background for this Windows user.'],
    'windows-widgets': ['Windows Widgets Button', 'Shows or hides the Widgets button for your Windows user. Restart Explorer or sign out to see the change.'],
    'search-highlights': ['Search Highlights', 'Turns off changing online content displayed in the Windows Search interface.'],
    'windows-spotlight': ['Windows Spotlight', 'Turns off Windows Spotlight features and suggested lock-screen background content.'],
    'tailored-experiences': ['Tailored Experiences', 'Stops Windows from using diagnostic information to customize selected experiences.'],
    'long-paths': ['Long File Paths', 'Enables the Windows setting that allows compatible programs to use paths longer than 260 characters.'],
    'task-view-button': ['Task View Button', 'Hides the Task View button on the Windows taskbar. You can restore it by toggling this option off and applying changes.'],
    'windows-dark-mode': ['Windows Dark Mode', 'Changes the Windows and supported-app color preference to dark mode. This is a reversible preference change.'],
    'taskbar-clock-seconds': ['Taskbar Clock Seconds', 'Shows seconds in the Windows taskbar clock. This is a reversible preference change.'],
    'create-restore-point': ['System Restore Point', 'Asks Windows to create a restore point before you apply other queued changes. Windows System Protection must be enabled for this to succeed.'],
    'taskbar-alignment': ['Taskbar Alignment', 'Chooses whether taskbar controls are centered or left-aligned. This is a reversible Windows preference.'],
    'taskbar-size': ['Taskbar Icon Size', 'Chooses a compact, standard, or larger taskbar size where your Windows version supports it.'],
    'taskbar-search': ['Taskbar Search', 'Chooses whether taskbar search is hidden, shown as an icon, or displayed as a full search box.'],
    'clean-event-logs': ['Clear Windows Event Logs', 'Removes existing event log entries. Export any logs you need before applying this action.'],
    'empty-recycle': ['Empty Recycle Bin', 'Permanently removes files currently held in the Windows Recycle Bin.'],
  };
  let activeDrawerTweak = null;
  const drawer = document.getElementById('info-drawer');
  const drawerScrim = document.getElementById('info-drawer-scrim');

  function closeDrawer() {
    drawer?.classList.remove('open');
    drawer?.setAttribute('aria-hidden', 'true');
    drawerScrim?.classList.remove('open');
  }

  function openDrawer(tweakId) {
    const detail = tweakDetails[tweakId] || ['About this tweak', 'This Windows setting is optional. Review the description on the card, then add it to your queue only if it suits your PC.'];
    activeDrawerTweak = tweakId;
    document.getElementById('drawer-title').textContent = detail[0];
    document.getElementById('drawer-description').textContent = detail[1];
    document.getElementById('drawer-note-text').textContent = 'Opening this panel or adding it to the queue does not change Windows. Only Apply Changes runs queued actions.';
    const queueButton = document.getElementById('btn-queue-drawer-tweak');
    if (queueButton) queueButton.hidden = tweakId === 'changelog';
    drawer?.classList.add('open');
    drawer?.setAttribute('aria-hidden', 'false');
    drawerScrim?.classList.add('open');
  }

  document.querySelectorAll('.tweak-card[data-tweak]').forEach(card => {
    const titleRow = card.querySelector('.tweak-title-row');
    const tweakId = card.dataset.tweak;
    if (!titleRow || !tweakId) return;
    const infoButton = document.createElement('button');
    infoButton.className = 'tweak-info-btn';
    infoButton.type = 'button';
    infoButton.title = 'What this does';
    infoButton.setAttribute('aria-label', `What ${card.querySelector('.tweak-title')?.textContent || 'this tweak'} does`);
    infoButton.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
    infoButton.addEventListener('click', () => openDrawer(tweakId));
    titleRow.appendChild(infoButton);
  });

  document.getElementById('btn-close-drawer')?.addEventListener('click', closeDrawer);
  drawerScrim?.addEventListener('click', closeDrawer);
  document.querySelectorAll('.drawer-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.drawer-tab').forEach(item => item.classList.toggle('active', item === tab));
    const isDetails = tab.dataset.drawerTab === 'details';
    document.getElementById('drawer-details-panel')?.classList.toggle('active', isDetails);
    document.getElementById('drawer-changes-panel')?.classList.toggle('active', !isDetails);
  }));
  document.getElementById('btn-open-changelog')?.addEventListener('click', () => {
    playAudioTone('click');
    openDrawer('changelog');
    document.querySelector('[data-drawer-tab="changes"]')?.click();
  });
  document.getElementById('btn-queue-drawer-tweak')?.addEventListener('click', () => {
    const control = document.querySelector(`[data-tweak-id="${activeDrawerTweak}"]`);
    if (activeDrawerTweak && activeDrawerTweak !== 'changelog') {
      if (control?.type === 'checkbox') { control.checked = true; stageTweak(activeDrawerTweak, { enabled: true }); }
      else if (control?.tagName === 'SELECT') control.dispatchEvent(new Event('change'));
      else stageTweak(activeDrawerTweak);
    }
    closeDrawer();
  });

  // Register toggle change events into pending state (NO AUTOMATIC EXECUTION)
  document.querySelectorAll('.tweak-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      playAudioTone('click');
      const tweakId = toggle.getAttribute('data-tweak-id');
      if (!tweakId) return;
      profileOwned.delete(tweakId);
      document.querySelectorAll(`[data-tweak-id="${tweakId}"]`).forEach(control => { if (control.type === 'checkbox') control.checked = e.target.checked; });
      pendingTweaks[tweakId] = { enabled: e.target.checked };
      updatePendingUI();
    });
  });

  // Register dropdown select events into pending state
  document.querySelectorAll('.tweak-select').forEach(select => {
    select.addEventListener('change', (e) => {
      playAudioTone('click');
      const tweakId = select.getAttribute('data-tweak-id');
      if (!tweakId || applying) return;
      profileOwned.delete(tweakId);
      if (!e.target.value) { delete pendingTweaks[tweakId]; updatePendingUI(); return; }
      if (tweakId === 'power-plan') pendingTweaks[tweakId] = { plan: e.target.value };
      else if (tweakId === 'set-dns') pendingTweaks[tweakId] = { preset: e.target.value };
      else pendingTweaks[tweakId] = { value: e.target.value };

      updatePendingUI();
    });
  });

  // Reset Pending Button
  document.getElementById('btn-reset-pending')?.addEventListener('click', () => {
    playAudioTone('click');
    for (const key in pendingTweaks) delete pendingTweaks[key];
    profileOwned.clear();
    document.querySelectorAll('[data-tuning-profile]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    initialTweakStates.forEach((initialValue, control) => {
      if (control.type === 'checkbox') control.checked = initialValue;
      else control.value = initialValue;
    });
    updatePendingUI();
    showToast('Pending changes cleared. No Windows settings were changed.', 'info');
  });

  let lastApplyResults = [];
  function closeResults() {
    document.getElementById('apply-results-overlay')?.setAttribute('hidden', '');
  }
  function renderApplyResults(results) {
    lastApplyResults = results;
    const applied = results.filter(item => item.success).length;
    const summary = document.getElementById('apply-results-summary');
    if (summary) summary.textContent = `${applied} of ${results.length} queued action${results.length === 1 ? '' : 's'} applied. Review the details below.`;
    const list = document.getElementById('apply-results-list');
    list?.replaceChildren();
    results.forEach(item => {
      const row = document.createElement('div'); row.className = `result-row ${item.success ? 'success' : 'failure'}`;
      const icon = document.createElement('i'); icon.className = `fa-solid ${item.success ? 'fa-check' : 'fa-xmark'}`;
      const copy = document.createElement('div'); copy.className = 'result-copy';
      const title = document.createElement('strong'); title.textContent = item.action || item.id;
      const detail = document.createElement('span'); detail.textContent = item.details || (item.success ? 'Completed.' : 'The action did not complete.');
      copy.append(title, detail); row.append(icon, copy); list?.append(row);
    });
    const restart = document.getElementById('apply-results-restart');
    if (restart) restart.hidden = !results.some(item => item.success && /restart|sign out|reopen|refresh/i.test(item.details || ''));
    const undo = document.getElementById('btn-undo-session');
    if (undo) {
      const undoCount = results.filter(item => item.success && item.inverse).length;
      undo.disabled = undoCount === 0;
      undo.title = undoCount ? `Queue ${undoCount} reversible change${undoCount === 1 ? '' : 's'}` : 'No reversible actions in this session';
    }
    document.getElementById('apply-results-overlay')?.removeAttribute('hidden');
  }
  function queueUndoSession() {
    let count = 0;
    for (const item of lastApplyResults) {
      if (!item.success || !item.inverse) continue;
      pendingTweaks[item.tweakId] = item.inverse;
      document.querySelectorAll(`[data-tweak-id="${item.tweakId}"]`).forEach(control => {
        if (control.type === 'checkbox' && typeof item.inverse.enabled === 'boolean') control.checked = item.inverse.enabled;
        if (control.tagName === 'SELECT' && item.inverse.restore) control.value = '';
      });
      count++;
    }
    closeResults(); updatePendingUI();
    showToast(count ? `${count} undo action${count === 1 ? '' : 's'} queued. Press Apply Changes to run them.` : 'This session has no reversible actions.', count ? 'info' : 'warning');
  }
  document.getElementById('btn-close-results')?.addEventListener('click', closeResults);
  document.getElementById('btn-close-results-primary')?.addEventListener('click', closeResults);
  document.getElementById('btn-undo-session')?.addEventListener('click', queueUndoSession);

  // EXPLICIT "APPLY CHANGES" BUTTON CLICK
  document.getElementById('btn-apply-pending')?.addEventListener('click', async () => {
    if (applying) return;
    playAudioTone('success');
    const keys = Object.keys(pendingTweaks);
    if (keys.length === 0) return;

    applying = true;
    const controls = [...document.querySelectorAll('.tweak-toggle, .tweak-select, .debloat-action, .catalog-action, .power-restore, [data-tuning-profile], .pending-actions button, #btn-queue-drawer-tweak')];
    const previous = controls.map(control => control.disabled);
    controls.forEach(control => control.disabled = true);
    let succeeded = 0;
    const applyResults = [];
    showToast(`Applying ${keys.length} system tweak(s)...`, 'info');
    try { for (const tweakId of keys) {
      const payload = pendingTweaks[tweakId];
        try {
          if (!window.electronAPI) throw new Error('Desktop connection unavailable. Open the packaged desktop app.');
          const res = await window.electronAPI.applyTweak(tweakId, payload);
          if (!res.success) { applyResults.push({ tweakId, action: res.action || tweakId, details: res.details, success: false, inverse: null }); showToast(`Notice: ${res.details}`, 'warning'); }
          else {
            recordAppliedChange(tweakId, payload, res); succeeded++;
            applyResults.push({ tweakId, action: res.action || tweakId, details: res.details, success: true, inverse: res.undoPayload || (typeof payload.enabled === 'boolean' ? {enabled: !payload.enabled} : null) });
            delete pendingTweaks[tweakId]; profileOwned.delete(tweakId);
            document.querySelectorAll(`[data-tweak-id="${tweakId}"]`).forEach(control => initialTweakStates.set(control, control.type === 'checkbox' ? control.checked : control.value));
          }
        } catch (err) {
          applyResults.push({ tweakId, action: tweakId, details: err.message, success: false, inverse: null });
          showToast(`Error: ${err.message}`, 'error');
        }
    } } finally {
      applying = false; controls.forEach((control, index) => control.disabled = previous[index]);
    }
    updatePendingUI();
    const failed = keys.length - succeeded;
    renderApplyResults(applyResults);
    showToast(failed ? `${succeeded} applied; ${failed} unsuccessful. Unsuccessful changes remain queued.` : `${succeeded} changes applied.`, failed ? 'warning' : 'success');
  });

  // Built-in focus audio. It is generated locally, never starts by default,
  // and can be paused at any time.
  const ambientPlayer = { context: null, master: null, timer: null, stopTimer: null, playing: false };
  const soundscapeChords = {
    focus: [[220, 277.18, 329.63], [196, 246.94, 293.66], [261.63, 329.63, 392]],
    warm: [[174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 207.65, 246.94]],
    night: [[146.83, 174.61, 220], [164.81, 196, 246.94], [130.81, 164.81, 196]],
    deep: [[110, 146.83, 174.61], [98, 130.81, 164.81], [123.47, 164.81, 196]],
    arcade: [[261.63, 329.63, 392], [293.66, 369.99, 440], [246.94, 311.13, 369.99]],
  };

  function updateMusicUI() {
    const isPlaying = ambientPlayer.playing;
    document.querySelectorAll('#btn-toggle-music, #btn-toggle-music-dashboard, #btn-toggle-music-studio').forEach(button => {
      if (!button) return;
      const icon = button.querySelector('i');
      const label = button.querySelector('span');
      if (icon) icon.className = `fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`;
      if (label) label.textContent = isPlaying ? 'Pause audio' : (button.id === 'btn-toggle-music' ? 'Focus Audio' : 'Play audio');
    });
  }

  function scheduleAmbientPhrase() {
    if (!ambientPlayer.context || !ambientPlayer.master || !ambientPlayer.playing) return;
    const ctx = ambientPlayer.context;
    const style = document.getElementById('music-style')?.value || 'focus';
    const chords = soundscapeChords[style] || soundscapeChords.focus;
    chords.forEach((chord, index) => {
      const start = ctx.currentTime + (index * 4.4);
      chord.forEach((frequency, noteIndex) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = style === 'arcade' && noteIndex === 2 ? 'square' : (noteIndex === 0 ? 'sine' : 'triangle');
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(noteIndex === 0 ? 0.1 : 0.045, start + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 4.2);
        oscillator.connect(gain); gain.connect(ambientPlayer.master);
        oscillator.start(start); oscillator.stop(start + 4.3);
      });
    });
  }

  function armMusicTimer() {
    clearTimeout(ambientPlayer.stopTimer);
    const minutes = Number(document.getElementById('music-timer')?.value || 0);
    if (!ambientPlayer.playing || !minutes) return;
    ambientPlayer.stopTimer = setTimeout(() => {
      if (ambientPlayer.playing) toggleAmbientMusic();
      showToast('Focus audio session finished', 'info');
    }, minutes * 60 * 1000);
  }

  async function toggleAmbientMusic() {
    if (ambientPlayer.playing) {
      clearInterval(ambientPlayer.timer);
      clearTimeout(ambientPlayer.stopTimer);
      ambientPlayer.timer = null;
      ambientPlayer.master?.gain.cancelScheduledValues(ambientPlayer.context.currentTime);
      ambientPlayer.master?.gain.setTargetAtTime(0.0001, ambientPlayer.context.currentTime, 0.08);
      ambientPlayer.playing = false;
      updateMusicUI();
      showToast('Focus audio paused', 'info');
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ambientPlayer.context) {
      ambientPlayer.context = new AudioCtx();
      ambientPlayer.master = ambientPlayer.context.createGain();
      ambientPlayer.master.connect(ambientPlayer.context.destination);
    }
    await ambientPlayer.context.resume();
    const volume = Number(document.getElementById('music-volume')?.value || 35) / 100;
    ambientPlayer.master.gain.cancelScheduledValues(ambientPlayer.context.currentTime);
    ambientPlayer.master.gain.setTargetAtTime(volume * 0.32, ambientPlayer.context.currentTime, 0.08);
    ambientPlayer.playing = true;
    scheduleAmbientPhrase();
    ambientPlayer.timer = setInterval(scheduleAmbientPhrase, 13200);
    armMusicTimer();
    updateMusicUI();
    showToast('Focus audio playing', 'success');
  }

  document.querySelectorAll('#btn-toggle-music, #btn-toggle-music-dashboard, #btn-toggle-music-studio').forEach(button => button?.addEventListener('click', toggleAmbientMusic));
  document.getElementById('music-volume')?.addEventListener('input', event => {
    localStorage.setItem('batmaniscool_music_volume', event.target.value);
    if (ambientPlayer.master && ambientPlayer.context) ambientPlayer.master.gain.setTargetAtTime((Number(event.target.value) / 100) * 0.32, ambientPlayer.context.currentTime, 0.05);
  });
  document.getElementById('music-style')?.addEventListener('change', event => localStorage.setItem('batmaniscool_music_style', event.target.value));
  document.getElementById('music-timer')?.addEventListener('change', event => { localStorage.setItem('batmaniscool_music_timer', event.target.value); armMusicTimer(); });
  document.getElementById('music-autoplay')?.addEventListener('change', event => localStorage.setItem('batmaniscool_music_autoplay', event.target.checked ? 'true' : 'false'));
  document.getElementById('music-ui-sounds')?.addEventListener('change', event => localStorage.setItem('batmaniscool_music_ui_sounds', event.target.checked ? 'true' : 'false'));
  const savedMusicVolume = localStorage.getItem('batmaniscool_music_volume');
  const savedMusicStyle = localStorage.getItem('batmaniscool_music_style');
  const savedAutoplay = localStorage.getItem('batmaniscool_music_autoplay') === 'true';
  const savedMusicTimer = localStorage.getItem('batmaniscool_music_timer');
  const savedUiSounds = localStorage.getItem('batmaniscool_music_ui_sounds') !== 'false';
  if (savedMusicVolume) document.getElementById('music-volume').value = savedMusicVolume;
  if (savedMusicStyle) document.getElementById('music-style').value = savedMusicStyle;
  if (savedAutoplay) document.getElementById('music-autoplay').checked = true;
  if (savedMusicTimer) document.getElementById('music-timer').value = savedMusicTimer;
  document.getElementById('music-ui-sounds').checked = savedUiSounds;

  // UI Sound Tones
  function playAudioTone(type = 'click') {
    try {
      if (localStorage.getItem('batmaniscool_music_ui_sounds') === 'false') return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'error') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {}
  }

  // Auth System
  const DEFAULT_AGENTS = {
    'BATMAN': 'Wayne',
    'BRUCE': 'Wayne',
    'ADMIN': 'Admin',
    'DEVELOPER': 'batmaniscool-dev'
  };

  function getStoredAgents() {
    try {
      const stored = localStorage.getItem('batman_utility_users');
      if (stored) {
        return { ...DEFAULT_AGENTS, ...JSON.parse(stored) };
      }
    } catch (e) {}
    return { ...DEFAULT_AGENTS };
  }

  function saveAgent(username, password) {
    try {
      const agents = getStoredAgents();
      agents[username.toUpperCase()] = password;
      localStorage.setItem('batman_utility_users', JSON.stringify(agents));
      return true;
    } catch (e) { return false; }
  }

  const btnModeLogin = document.getElementById('btn-mode-login');
  const btnModeSignup = document.getElementById('btn-mode-signup');
  const formLogin = document.getElementById('bat-login-form');
  const formSignup = document.getElementById('bat-signup-form');
  const statusMsg = document.getElementById('login-status-msg');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const rememberUser = document.getElementById('remember-user');

  // Convenience only: remember the username, never the password.
  const rememberedUsername = localStorage.getItem('batmaniscool_remembered_username');
  if (rememberedUsername && loginUsername) {
    loginUsername.value = rememberedUsername;
    if (rememberUser) rememberUser.checked = true;
    loginPassword?.focus();
  } else {
    loginUsername?.focus();
  }

  document.querySelectorAll('[data-password-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      button.querySelector('i').className = `fa-regular ${reveal ? 'fa-eye-slash' : 'fa-eye'}`;
    });
  });

  document.getElementById('signup-password')?.addEventListener('input', (event) => {
    const value = event.target.value;
    const score = [value.length >= 8, /[A-Za-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
    const bar = document.getElementById('password-strength-bar');
    const text = document.getElementById('password-strength-text');
    const names = ['Use 8+ characters with a mix of letters and numbers.', 'Weak password', 'Fair password', 'Strong password', 'Very strong password'];
    const colors = ['var(--accent-rose)', 'var(--accent-rose)', 'var(--accent-amber)', 'var(--accent-cyan)', 'var(--accent-emerald)'];
    if (bar) { bar.style.width = `${score * 25}%`; bar.style.background = colors[score]; }
    if (text) text.textContent = names[score];
  });

  function setAuthStatus(msg, isError = true) {
    if (!statusMsg) return;
    if (!msg) {
      statusMsg.style.display = 'none';
      return;
    }
    statusMsg.className = `login-status-msg ${isError ? 'error' : 'success'}`;
    statusMsg.innerHTML = `<i class="fa-solid ${isError ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> <span>${msg}</span>`;
    statusMsg.style.display = 'block';
  }

  btnModeLogin?.addEventListener('click', () => {
    playAudioTone('click');
    btnModeLogin.classList.add('active');
    btnModeSignup.classList.remove('active');
    formLogin.style.display = 'flex';
    formSignup.style.display = 'none';
    setAuthStatus('');
  });

  btnModeSignup?.addEventListener('click', () => {
    playAudioTone('click');
    btnModeSignup.classList.add('active');
    btnModeLogin.classList.remove('active');
    formSignup.style.display = 'flex';
    formLogin.style.display = 'none';
    setAuthStatus('');
  });

  document.getElementById('btn-developer-profile')?.addEventListener('click', () => {
    playAudioTone('click');
    btnModeLogin?.click();
    if (loginUsername) loginUsername.value = 'DEVELOPER';
    loginPassword?.focus();
    setAuthStatus('Developer profile selected. Enter your local developer password to continue.', false);
  });

  formSignup?.addEventListener('submit', (e) => {
    e.preventDefault();
    playAudioTone('click');

    const username = document.getElementById('signup-username').value.trim();
    const pass = document.getElementById('signup-password').value;
    const confirmPass = document.getElementById('signup-confirm-pass').value;

    if (!username || !pass) {
      setAuthStatus('Please fill in all fields.', true);
      return;
    }

    if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
      setAuthStatus('Use 3–32 letters, numbers, underscores, or hyphens for your username.', true);
      return;
    }

    if (pass.length < 8 || !/[A-Za-z]/.test(pass) || !/\d/.test(pass)) {
      setAuthStatus('Use at least 8 characters, including a letter and a number.', true);
      return;
    }

    if (pass !== confirmPass) {
      playAudioTone('error');
      setAuthStatus('Passwords do not match.', true);
      return;
    }

    const agents = getStoredAgents();
    if (agents[username.toUpperCase()]) {
      playAudioTone('error');
      setAuthStatus(`Username "${username}" is already taken. Please sign in.`, true);
      return;
    }

    saveAgent(username, pass);
    playAudioTone('success');
    setAuthStatus(`Account created for "${username}"! Please sign in.`, false);

    setTimeout(() => {
      btnModeLogin.click();
      document.getElementById('login-username').value = username;
      document.getElementById('login-password').value = pass;
    }, 1200);
  });

  formLogin?.addEventListener('submit', (e) => {
    e.preventDefault();
    const userVal = document.getElementById('login-username').value.trim();
    const passVal = document.getElementById('login-password').value;

    const lockState = JSON.parse(localStorage.getItem('batmaniscool_login_attempts') || '{"count":0,"until":0}');
    if (lockState.until > Date.now()) {
      const seconds = Math.ceil((lockState.until - Date.now()) / 1000);
      setAuthStatus(`Too many attempts. Try again in ${seconds} seconds.`, true);
      return;
    }

    const agents = getStoredAgents();
    const validPass = agents[userVal.toUpperCase()];

    if (validPass && validPass === passVal) {
      localStorage.removeItem('batmaniscool_login_attempts');
      if (rememberUser?.checked) localStorage.setItem('batmaniscool_remembered_username', userVal);
      else localStorage.removeItem('batmaniscool_remembered_username');
      playAudioTone('success');
      if (localStorage.getItem('batmaniscool_music_autoplay') === 'true' && !ambientPlayer.playing) toggleAmbientMusic();
      setAuthStatus('');

      const loaderContainer = document.getElementById('login-loader');
      const loaderBar = document.getElementById('login-loader-bar');
      const loaderText = document.getElementById('login-loader-status');

      if (loaderContainer) loaderContainer.style.display = 'flex';
      formLogin.style.display = 'none';
      document.querySelector('.auth-mode-toggle').style.display = 'none';

      if (loaderText) loaderText.textContent = `Authenticating ${userVal}...`;
      if (loaderBar) {
        setTimeout(() => { loaderBar.style.width = '100%'; }, 100);
      }

      setTimeout(() => {
        const overlay = document.getElementById('bat-login-overlay');
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => { overlay.style.display = 'none'; }, 400);
        }
        showToast(`Welcome back, ${userVal}!`, 'success');
        if (!localStorage.getItem('batmaniscool_first_run_seen')) {
          setTimeout(() => document.getElementById('first-run-welcome')?.removeAttribute('hidden'), 450);
        }
      }, 1300);

    } else {
      const failedCount = (lockState.count || 0) + 1;
      const nextState = failedCount >= 5
        ? { count: 0, until: Date.now() + 30000 }
        : { count: failedCount, until: 0 };
      localStorage.setItem('batmaniscool_login_attempts', JSON.stringify(nextState));
      playAudioTone('error');
      const card = document.getElementById('bat-login-card');
      card?.classList.add('shake');
      setTimeout(() => card?.classList.remove('shake'), 400);
      setAuthStatus(nextState.until ? 'Too many attempts. Try again in 30 seconds.' : `Invalid username or password. ${5 - failedCount} attempt(s) remaining.`, true);
    }
  });

  // Frameless Window Controls
  document.getElementById('btn-minimize')?.addEventListener('click', () => {
    playAudioTone('click');
    window.electronAPI?.minimizeWindow();
  });

  document.getElementById('btn-maximize')?.addEventListener('click', () => {
    playAudioTone('click');
    window.electronAPI?.maximizeWindow();
  });

  document.getElementById('btn-close')?.addEventListener('click', () => {
    playAudioTone('click');
    window.electronAPI?.closeWindow();
  });

  // Tab Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.page-tab-content');
  function activateTab(targetTabId) {
    if (!targetTabId) return;
    navItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === targetTabId));
    tabContents.forEach(c => c.classList.toggle('active', c.id === targetTabId));
    if (targetTabId === 'tab-gadgets') { fetchPingData(); fetchProcessData(); }
    if (targetTabId === 'tab-tools') { fetchStartupApps(); fetchDriverStatus(); }
    if (targetTabId === 'tab-nvidia') fetchNvidiaInfo();
    if (targetTabId === 'tab-history') renderHistory();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      playAudioTone('click');
      const targetTabId = item.getAttribute('data-tab');
      activateTab(targetTabId);
    });
  });

  document.getElementById('btn-complete-welcome')?.addEventListener('click', () => {
    localStorage.setItem('batmaniscool_first_run_seen', 'true');
    document.getElementById('first-run-welcome')?.setAttribute('hidden', '');
    activateTab('tab-dashboard');
  });
  document.getElementById('btn-welcome-performance')?.addEventListener('click', () => {
    localStorage.setItem('batmaniscool_first_run_seen', 'true');
    document.getElementById('first-run-welcome')?.setAttribute('hidden', '');
    activateTab('tab-performance');
  });
  window.electronAPI?.getAppInfo?.().then(info => {
    const version = document.getElementById('app-version');
    if (version) version.textContent = `${info.name} v${info.version} · Windows desktop app`;
  }).catch(() => {});
  const updateStatusText = document.getElementById('update-status');
  const updateButton = document.getElementById('btn-check-updates');
  const renderUpdateStatus = status => {
    if (updateStatusText) updateStatusText.textContent = status.version ? `${status.state} Version ${status.version}.` : status.state;
    if (updateButton) { updateButton.disabled = !status.configured; updateButton.title = status.configured ? 'Check the configured release server' : status.details; }
    if (updateButton && status.state === 'Update available.') { updateButton.textContent = 'Download update'; updateButton.dataset.action = 'download'; updateButton.disabled = false; }
    if (updateButton && status.state === 'Update downloaded — restart to install.') { updateButton.textContent = 'Restart and install'; updateButton.dataset.action = 'install'; updateButton.disabled = false; }
  };
  window.electronAPI?.getUpdateStatus?.().then(renderUpdateStatus).catch(() => {
    if (updateStatusText) updateStatusText.textContent = 'Update status is unavailable in this build.';
  });
  updateButton?.addEventListener('click', async () => {
    if (updateButton.disabled) return;
    if (updateButton.dataset.action === 'download') { updateButton.disabled = true; renderUpdateStatus(await window.electronAPI.downloadUpdate()); return; }
    if (updateButton.dataset.action === 'install') { await window.electronAPI.installUpdate(); return; }
    updateButton.disabled = true; updateButton.textContent = 'Checking…';
    try { renderUpdateStatus(await window.electronAPI.checkForUpdates()); }
    finally { updateButton.textContent = 'Check for updates'; window.electronAPI?.getUpdateStatus?.().then(status => updateButton.disabled = !status.configured); }
  });
  window.electronAPI?.onUpdateStatus?.(renderUpdateStatus);

  document.getElementById('btn-clear-history')?.addEventListener('click', () => {
    if (!window.confirm('Clear the local change history? This does not undo any Windows settings.')) return;
    saveHistory([]); renderHistory(); showToast('Local change history cleared.', 'info');
  });

  function applyAppTheme(theme) {
    document.body.dataset.theme = theme === 'gold' ? '' : theme;
    document.querySelectorAll('.theme-card').forEach(card => card.classList.toggle('active', card.dataset.appTheme === theme));
    localStorage.setItem('batmaniscool_theme', theme);
  }
  document.querySelectorAll('.theme-card').forEach(card => card.addEventListener('click', () => {
    playAudioTone('click'); applyAppTheme(card.dataset.appTheme); showToast(`${card.dataset.appTheme[0].toUpperCase()}${card.dataset.appTheme.slice(1)} theme selected.`, 'success');
  }));
  applyAppTheme(localStorage.getItem('batmaniscool_theme') || 'gold');

  // System Stats Polling
  async function updateStats() {
    if (!window.electronAPI) return;
    try {
      const stats = await window.electronAPI.getSystemStats();
      if (!stats) return;

      const cpuVal = document.getElementById('cpu-load-val');
      const cpuBar = document.getElementById('cpu-bar');
      const cpuModel = document.getElementById('cpu-model-text');
      if (cpuVal) cpuVal.textContent = stats.cpuLoadPct;
      if (cpuBar) cpuBar.style.width = `${stats.cpuLoadPct}%`;
      if (cpuModel) cpuModel.textContent = `${stats.cpuModel} (${stats.cpuCores} Cores)`;

      const ramVal = document.getElementById('ram-usage-val');
      const ramBar = document.getElementById('ram-bar');
      const ramDetail = document.getElementById('ram-detail-text');
      if (ramVal) ramVal.textContent = stats.memUsagePct;
      if (ramBar) ramBar.style.width = `${stats.memUsagePct}%`;
      if (ramDetail) ramDetail.textContent = `${stats.usedMemGB} GB / ${stats.totalMemGB} GB Used`;

      const diskVal = document.getElementById('disk-free-val');
      const diskDetail = document.getElementById('disk-detail-text');
      if (diskVal) diskVal.textContent = stats.diskFreeGB;
      if (diskDetail) diskDetail.textContent = `${stats.diskFreeGB} GB Free of ${stats.diskTotalGB} GB`;

      const sysOs = document.getElementById('sys-os-text');
      const uptimeText = document.getElementById('uptime-text');
      if (sysOs) sysOs.textContent = `${stats.osName} (${stats.arch})`;
      if (uptimeText) uptimeText.textContent = `Uptime: ${stats.uptimeHours} Hours`;

    } catch (e) {
      console.warn('Failed stats:', e);
    }
  }

  async function fetchNvidiaInfo() {
    const name = document.getElementById('nvidia-gpu-name');
    const meta = document.getElementById('nvidia-gpu-meta');
    const temp = document.getElementById('nvidia-temp');
    const power = document.getElementById('nvidia-power');
    if (!window.electronAPI?.getNvidiaInfo) return;
    try {
      const info = await window.electronAPI.getNvidiaInfo();
      if (!info?.available) {
        if (name) name.textContent = 'NVIDIA GPU not detected';
        if (meta) meta.textContent = 'Install an NVIDIA driver and NVIDIA Control Panel to use the guided settings on this page.';
        return;
      }
      if (name) name.textContent = info.name;
      if (meta) meta.textContent = `Driver ${info.driver} detected. These recommendations are not applied automatically.`;
      if (temp) temp.textContent = `${info.temperature} °C`;
      if (power) power.textContent = `${info.powerLimit} W`;
    } catch (error) {
      if (name) name.textContent = 'NVIDIA status unavailable';
    }
  }

  const nvidiaProfiles = {
    competitive: { name: 'Competitive FPS', power: 'Prefer maximum performance', refresh: 'Highest available', textureQuality: 'High performance', anisotropic: 'On', trilinear: 'On', latency: 'On', vsync: 'Use the 3D application setting', threaded: 'Auto', tripleBuffering: 'Off', cuda: 'All' },
    balanced: { name: 'Balanced', power: 'Optimal power', refresh: 'Highest available', textureQuality: 'Quality', anisotropic: 'Application-controlled', trilinear: 'On', latency: 'Off', vsync: 'Use the 3D application setting', threaded: 'Auto', tripleBuffering: 'Off', cuda: 'All' },
    quality: { name: 'Visual Quality', power: 'Prefer maximum performance', refresh: 'Highest available', textureQuality: 'High quality', anisotropic: 'Application-controlled', trilinear: 'On', latency: 'Off', vsync: 'Use the 3D application setting', threaded: 'Auto', tripleBuffering: 'Off', cuda: 'All' },
  };

  function selectNvidiaProfile(profileId) {
    const profile = nvidiaProfiles[profileId] || nvidiaProfiles.competitive;
    document.querySelectorAll('.nvidia-profile-card').forEach(card => card.classList.toggle('active', card.dataset.nvidiaProfile === profileId));
    document.querySelectorAll('[data-nvidia-value]').forEach(value => { value.textContent = profile[value.dataset.nvidiaValue]; });
    const heading = document.getElementById('nvidia-profile-heading');
    const badge = document.getElementById('nvidia-profile-badge');
    if (heading) heading.textContent = `${profile.name} — recommended 3D settings`;
    if (badge) badge.textContent = profile.name;
    localStorage.setItem('batmaniscool_nvidia_profile', profileId);
  }

  document.querySelectorAll('.nvidia-profile-card').forEach(card => card.addEventListener('click', () => {
    playAudioTone('click');
    selectNvidiaProfile(card.dataset.nvidiaProfile);
    showToast(`${nvidiaProfiles[card.dataset.nvidiaProfile].name} profile selected. NVIDIA settings have not been changed.`, 'info');
  }));
  selectNvidiaProfile(localStorage.getItem('batmaniscool_nvidia_profile') || 'competitive');

  document.getElementById('btn-open-nvidia-panel')?.addEventListener('click', async () => {
    playAudioTone('click');
    const result = await window.electronAPI?.openNvidiaControlPanel?.();
    showToast(result?.details || 'NVIDIA Control Panel could not be opened.', result?.success ? 'success' : 'warning');
  });

  function makeDiagnosticRow(title, detail, badge) {
    const row = document.createElement('div'); row.className = 'diagnostic-row';
    const copy = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = title;
    const small = document.createElement('small'); small.textContent = detail || 'No additional details available.';
    copy.append(strong, small); row.append(copy);
    if (badge) { const chip = document.createElement('span'); chip.className = 'diagnostic-badge'; chip.textContent = badge; row.append(chip); }
    return row;
  }
  async function fetchStartupApps() {
    const list = document.getElementById('startup-list'); if (!list || !window.electronAPI?.getStartupApps) return;
    list.replaceChildren(); list.append(makeDiagnosticRow('Checking startup registrations…', 'This check is read-only.'));
    try {
      const apps = await window.electronAPI.getStartupApps(); list.replaceChildren();
      if (!apps?.length) list.append(makeDiagnosticRow('No startup registrations found', 'Windows may manage startup items through another location.'));
      else apps.slice(0, 12).forEach(app => list.append(makeDiagnosticRow(app.Name || app.name || 'Startup app', app.Command || app.Path || app.command || 'Registered startup command', app.Scope || 'Startup')));
    } catch (error) { list.replaceChildren(makeDiagnosticRow('Startup check unavailable', 'Try Refresh list again.')); }
  }
  async function fetchDriverStatus() {
    const list = document.getElementById('driver-list'); if (!list || !window.electronAPI?.getDriverStatus) return;
    list.replaceChildren(); list.append(makeDiagnosticRow('Checking display drivers…', 'This check does not install or update drivers.'));
    try {
      const drivers = await window.electronAPI.getDriverStatus(); list.replaceChildren();
      if (!drivers?.length) list.append(makeDiagnosticRow('No display driver information found', 'Use Windows Update or your GPU maker for driver updates.'));
      else drivers.forEach(driver => list.append(makeDiagnosticRow(driver.DeviceName || 'Display adapter', `${driver.Manufacturer || 'Driver'} · version ${driver.DriverVersion || 'unknown'}`, driver.DriverDate ? String(driver.DriverDate).slice(0, 10) : 'Installed')));
    } catch (error) { list.replaceChildren(makeDiagnosticRow('Driver check unavailable', 'Try Check drivers again.')); }
  }
  async function runNetworkTest() {
    const results = document.getElementById('network-results'); if (!results || !window.electronAPI?.getNetworkDiagnostics) return;
    results.replaceChildren(makeDiagnosticRow('Running short network test…', 'Testing Cloudflare DNS; no network settings are changed.'));
    try {
      const info = await window.electronAPI.getNetworkDiagnostics(); results.replaceChildren();
      results.append(makeDiagnosticRow(info.Adapter || 'Network adapter unavailable', `${info.LinkSpeed || 'Link speed unavailable'} · gateway ${info.Gateway || 'not found'}`, 'Adapter'));
      results.append(makeDiagnosticRow(info.AverageMs == null ? 'Ping unavailable' : `${info.AverageMs} ms average ping`, info.JitterMs == null ? 'ICMP may be blocked by this network.' : `${info.JitterMs} ms jitter · ${info.PacketLoss || 0}% packet loss`, 'Cloudflare'));
    } catch (error) { results.replaceChildren(makeDiagnosticRow('Network test unavailable', 'Try again after checking your connection.')); }
  }
  document.getElementById('btn-refresh-startup')?.addEventListener('click', () => { playAudioTone('click'); fetchStartupApps(); });
  document.getElementById('btn-check-drivers')?.addEventListener('click', () => { playAudioTone('click'); fetchDriverStatus(); });
  document.getElementById('btn-run-network-test')?.addEventListener('click', () => { playAudioTone('click'); runNetworkTest(); });
  document.getElementById('btn-open-startup-settings')?.addEventListener('click', async () => {
    const result = await window.electronAPI?.openStartupSettings?.(); showToast(result?.details || 'Windows Startup Apps settings could not be opened.', result?.success ? 'success' : 'warning');
  });

  async function scanSystem() {
    const button = document.getElementById('btn-scan-system');
    if (!window.electronAPI?.getSystemStats) return;
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Scanning…</span>'; }

    try {
      const stats = await window.electronAPI.getSystemStats();
      if (!stats) throw new Error('No system data available');
      const memory = Number(stats.memUsagePct);
      const diskFree = Number(stats.diskFreeGB);
      const diskTotal = Number(stats.diskTotalGB);
      const diskUsed = diskTotal ? 100 - ((diskFree / diskTotal) * 100) : 0;
      const cpu = Number(stats.cpuLoadPct);
      const recommendations = [];
      let score = 100;

      if (memory >= 75) { score -= 12; recommendations.push(['optimize-ram', 'Memory pressure is high', `RAM usage is ${memory}%. Queue a memory cleanup if active apps feel slow.`]); }
      if (diskUsed >= 85) { score -= 14; recommendations.push(['clean-temp', 'Storage is getting full', `${diskFree.toFixed(1)} GB is free on C:. Queue a temporary-file cleanup to review.`]); }
      if (cpu >= 75) { score -= 8; recommendations.push(['visual-fx', 'Processor load is elevated', `CPU usage is ${cpu}%. Reducing visual effects may make the desktop feel more responsive.`]); }

      score = Math.max(60, score);
      const results = document.getElementById('scan-results');
      const scoreEl = document.getElementById('scan-score');
      const title = document.getElementById('scan-title');
      const description = document.getElementById('scan-description');
      const list = document.getElementById('scan-recommendations');
      if (results) results.hidden = false;
      if (scoreEl) scoreEl.textContent = score;
      if (title) title.textContent = recommendations.length ? `${recommendations.length} relevant recommendation${recommendations.length === 1 ? '' : 's'}` : 'Your PC looks balanced';
      if (description) description.textContent = recommendations.length ? 'These suggestions are based on the readings from this local scan. Nothing has been queued yet.' : 'No high-impact tweaks are recommended from the current memory, storage, and processor readings.';
      if (list) {
        list.replaceChildren();
        if (!recommendations.length) {
          const item = document.createElement('div');
          item.className = 'scan-recommendation';
          item.innerHTML = '<i class="fa-solid fa-circle-check"></i><span><strong>No action needed.</strong> Keep using the app to monitor your system.</span>';
          list.appendChild(item);
        }
        recommendations.forEach(([tweakId, label, detail]) => {
          const item = document.createElement('div');
          item.className = 'scan-recommendation';
          const copy = document.createElement('span');
          copy.innerHTML = `<strong>${label}</strong><br>${detail}`;
          const icon = document.createElement('i'); icon.className = 'fa-solid fa-lightbulb';
          const action = document.createElement('button'); action.className = 'btn-secondary'; action.type = 'button'; action.textContent = 'Add to queue';
          action.addEventListener('click', () => stageTweak(tweakId));
          item.append(icon, copy, action);
          list.appendChild(item);
        });
      }
    } catch (error) {
      showToast('The local scan could not read system information.', 'warning');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart" style="color: var(--accent-cyan);"></i><span>Scan My PC</span>'; }
    }
  }

  document.getElementById('btn-scan-system')?.addEventListener('click', () => {
    playAudioTone('click');
    scanSystem();
  });

  updateStats();
  setInterval(updateStats, 3000);

  // Ping Latency Data
  async function fetchPingData() {
    if (!window.electronAPI?.getPingLatency) return;
    try {
      const pings = await window.electronAPI.getPingLatency();
      if (Array.isArray(pings)) {
        pings.forEach(p => {
          if (p.ip === '1.1.1.1') document.getElementById('ping-cloudflare').textContent = `${p.latencyMs} ms`;
          if (p.ip === '8.8.8.8') document.getElementById('ping-google').textContent = `${p.latencyMs} ms`;
          if (p.ip === '9.9.9.9') document.getElementById('ping-quad9').textContent = `${p.latencyMs} ms`;
          if (p.ip === '208.67.222.222') document.getElementById('ping-opendns').textContent = `${p.latencyMs} ms`;
        });
      }
    } catch (e) {}
  }

  // Process Hunter Data
  async function fetchProcessData() {
    if (!window.electronAPI?.getTopProcesses) return;
    const body = document.getElementById('process-table-body');
    if (!body) return;

    try {
      const procs = await window.electronAPI.getTopProcesses();
      body.innerHTML = '';

      if (Array.isArray(procs) && procs.length > 0) {
        procs.forEach(p => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="font-family: 'JetBrains Mono', monospace; color: var(--accent-amber);">${p.Id}</td>
            <td style="font-weight: 600;">${p.ProcessName}</td>
            <td style="color: var(--text-muted); font-weight: 500;">${p.RAM_MB} MB</td>
            <td>
              <button class="btn-secondary btn-kill-proc" data-pid="${p.Id}" style="padding: 4px 10px; font-size: 11px;">
                <i class="fa-solid fa-xmark"></i> End Task
              </button>
            </td>
          `;
          body.appendChild(row);
        });

        document.querySelectorAll('.btn-kill-proc').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            playAudioTone('click');
            const pid = btn.getAttribute('data-pid');
            if (pid && window.electronAPI?.killProcess) {
              showToast(`Ending Process ID ${pid}...`, 'info');
              const res = await window.electronAPI.killProcess(pid);
              showToast(res.details, res.success ? 'success' : 'warning');
              fetchProcessData();
            }
          });
        });
      }
    } catch (e) {}
  }

  document.getElementById('btn-refresh-gadgets')?.addEventListener('click', () => {
    playAudioTone('click');
    fetchPingData();
    fetchProcessData();
    showToast('Diagnostics refreshed!', 'success');
  });

  // Every action button stages a request. Windows is changed only by the
  // explicit Apply Changes button at the top of this file.
  const queuedActions = {
    'btn-clean-ram': 'optimize-ram', 'btn-quick-flush-dns': 'flush-dns',
    'btn-clean-temp': 'clean-temp', 'btn-clean-update-cache': 'clean-update-cache',
    'btn-disable-hibernation': 'disable-hibernation', 'btn-empty-recycle': 'empty-recycle',
    'btn-queue-restore-point': 'create-restore-point',
    'btn-optimize-tcp': 'optimize-tcp', 'btn-run-sfc': 'repair-sfc',
    'btn-run-dism': 'repair-dism', 'btn-run-winsock': 'repair-winsock',
    'btn-clean-prefetch': 'clean-prefetch', 'btn-clean-event-logs': 'clean-event-logs',
  };
  Object.entries(queuedActions).forEach(([buttonId, tweakId]) => {
    document.getElementById(buttonId)?.addEventListener('click', () => {
      playAudioTone('click');
      stageTweak(tweakId);
    });
  });

  document.querySelectorAll('.debloat-action').forEach(button => {
    button.addEventListener('click', () => {
      const profile = button.dataset.debloatProfile;
      if (!profile) return;
      playAudioTone('click');
      stageTweak(`debloat-${profile}`, { profile });
    });
  });
  document.getElementById('btn-queue-full-debloat')?.addEventListener('click', () => {
    if (applying) return;
    const message = 'Queue all seven curated optional-app groups? This only adds them to the review queue. Nothing is removed until Apply Changes.';
    if (!window.confirm(message)) return;
    playAudioTone('click');
    stageTweak('debloat-full', { profile: 'full' });
  });
  document.querySelectorAll('.catalog-action').forEach(button => button.addEventListener('click', () => stageTweak(button.dataset.action)));

  // Local plan portability. Import is intentionally allowlisted and only stages
  // values; it never calls the desktop bridge.
  function availablePlanIds() {
    return new Set([
      ...[...document.querySelectorAll('[data-tweak-id]')].map(control => control.dataset.tweakId),
      ...[...document.querySelectorAll('[data-debloat-profile]')].map(button => `debloat-${button.dataset.debloatProfile}`),
      ...Object.values(queuedActions),
      ...window.powerOptions.map(item => item.id),
    ]);
  }
  function queueImportedPlan(plan) {
    if (!plan || typeof plan !== 'object' || !plan.pending || typeof plan.pending !== 'object') throw new Error('This is not a batmaniscool review plan.');
    const allowed = availablePlanIds(); let count = 0;
    for (const [id, payload] of Object.entries(plan.pending)) {
      if (!allowed.has(id) || !payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
      const safe = {};
      if (typeof payload.enabled === 'boolean') safe.enabled = payload.enabled;
      if (typeof payload.value === 'string' && payload.value.length <= 80) safe.value = payload.value;
      if (typeof payload.restore === 'boolean') safe.restore = payload.restore;
      if (typeof payload.plan === 'string' && payload.plan.length <= 80) safe.plan = payload.plan;
      if (typeof payload.preset === 'string' && payload.preset.length <= 80) safe.preset = payload.preset;
      if (typeof payload.profile === 'string' && payload.profile.length <= 80) safe.profile = payload.profile;
      if (!Object.keys(safe).length) continue;
      pendingTweaks[id] = safe; count++;
      document.querySelectorAll(`[data-tweak-id="${id}"]`).forEach(control => {
        if (control.type === 'checkbox' && typeof safe.enabled === 'boolean') control.checked = safe.enabled;
        if (control.tagName === 'SELECT' && typeof safe.value === 'string') control.value = safe.value;
      });
    }
    profileOwned.clear(); updatePendingUI();
    showToast(count ? `${count} imported action${count === 1 ? '' : 's'} queued for review.` : 'No compatible queued actions were found in that file.', count ? 'success' : 'warning');
  }
  document.getElementById('btn-export-plan')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({format:'batmaniscool-review-plan',version:1,createdAt:new Date().toISOString(),pending:pendingTweaks}, null, 2)], {type:'application/json'});
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'batmaniscool-review-plan.json'; link.click(); URL.revokeObjectURL(link.href);
    showToast('Review plan exported. No Windows settings were changed.', 'success');
  });
  const importFile = document.getElementById('import-plan-file');
  document.getElementById('btn-import-plan')?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { queueImportedPlan(JSON.parse(await file.text())); } catch (error) { showToast(error.message || 'Could not import that plan.', 'warning'); }
    event.target.value = '';
  });
  document.getElementById('btn-queue-history-undo')?.addEventListener('click', () => {
    const history = getHistory(); let count = 0;
    for (const item of history) {
      if (item.reverted || !item.inverse || !availablePlanIds().has(item.tweakId)) continue;
      pendingTweaks[item.tweakId] = item.inverse; count++;
      document.querySelectorAll(`[data-tweak-id="${item.tweakId}"]`).forEach(control => {
        if (control.type === 'checkbox' && typeof item.inverse.enabled === 'boolean') control.checked = item.inverse.enabled;
        if (control.tagName === 'SELECT' && item.inverse.restore) control.value = '';
      });
    }
    profileOwned.clear(); updatePendingUI();
    showToast(count ? `${count} history undo action${count === 1 ? '' : 's'} queued. Press Apply Changes to run them.` : 'No reversible history entries are available.', count ? 'info' : 'warning');
  });

  document.getElementById('btn-quick-optimize')?.addEventListener('click', () => {
    playAudioTone('success');
    ['optimize-ram', 'flush-dns', 'clean-temp'].forEach(tweakId => { pendingTweaks[tweakId] = {}; });
    updatePendingUI();
    showToast('Optimization actions added to pending changes. Press Apply Changes when ready.', 'info');
  });

  const tuningProfiles = {
    extreme: ['game-mode', 'hags', 'dynamic-tick', 'power-throttling', 'visual-fx', 'core-parking', 'mouse-accel', 'game-dvr', 'network-throttling', 'gaming-responsiveness', 'usb-selective-suspend', 'pcie-link-state', 'processor-boost', 'tcp-ack-profile', 'games-priority-profile', 'high-performance-gpu', 'tcp-fast-open', 'network-adapter-power', 'network-rss', 'network-rsc', 'network-lso', 'cpu-minimum-state', 'active-cooling', 'disk-idle-timeout', 'game-bar-overlay', 'fullscreen-optimizations', 'game-bar-tips', 'game-dvr-audio', 'capture-cursor', 'captured-cursor-border', 'mouse-click-lock', 'mouse-snap-default', 'keyboard-repeat-speed', 'desktop-menu-delay', 'mouse-hover-delay', 'menu-animation', 'edge-background', 'copilot-policy', 'background-apps', 'windows-widgets', 'search-highlights', 'transparency'],
    balanced: ['game-mode', 'hags', 'power-throttling', 'mouse-accel', 'game-dvr', 'gaming-responsiveness', 'processor-boost', 'games-priority-profile', 'high-performance-gpu', 'tcp-fast-open', 'network-rss', 'game-bar-overlay', 'game-bar-tips', 'game-dvr-audio', 'desktop-menu-delay', 'mouse-click-lock', 'background-apps', 'windows-widgets'],
    low: ['game-mode', 'game-dvr', 'game-bar-overlay', 'background-apps', 'windows-widgets', 'search-highlights', 'transparency', 'edge-background', 'copilot-policy']
  };
  const profileValues = {
    extreme: { 'power-epp':0, 'power-boost':2, 'power-max':100, 'power-min':100, 'power-cooling':1, 'power-pcie':0, 'power-wifi':0, 'power-disk':0, 'power-rise-threshold':10, 'power-fall-threshold':8, 'power-rise-policy':2 },
    balanced: { 'power-epp':50, 'power-boost':1, 'power-max':100, 'power-min':5, 'power-cooling':1, 'power-rise-threshold':30, 'power-fall-threshold':20, 'power-rise-policy':0 },
    low: {}
  };
  const replaced = new Set(window.powerOptions.map(item => item.legacy).filter(Boolean));
  const retired = new Set(['mouse-click-lock','captured-cursor-border','menu-animation']);
  for (const name of Object.keys(tuningProfiles)) {
    tuningProfiles[name] = [...tuningProfiles[name].filter(id => !replaced.has(id) && !retired.has(id)), ...Object.keys(profileValues[name])];
  }
  document.querySelectorAll('[data-tuning-profile]').forEach(button => {
    button.querySelector('b').textContent = `Queue ${tuningProfiles[button.dataset.tuningProfile].length} controls`;
    button.addEventListener('click', () => {
      if (applying) return;
      const profile = button.dataset.tuningProfile;
      const tweaks = tuningProfiles[profile] || [];
      for (const [id, prior] of profileOwned) {
        if (prior.payload === undefined) delete pendingTweaks[id]; else pendingTweaks[id] = prior.payload;
        prior.controls.forEach(([control, value]) => { if (control.type === 'checkbox') control.checked = value; else control.value = value; });
      }
      profileOwned.clear();
      tweaks.forEach(tweakId => {
        profileOwned.set(tweakId, { payload: pendingTweaks[tweakId], controls: [...document.querySelectorAll(`[data-tweak-id="${tweakId}"]`)].map(control => [control, control.type === 'checkbox' ? control.checked : control.value]) });
        pendingTweaks[tweakId] = profileValues[profile]?.[tweakId] !== undefined ? { value: String(profileValues[profile][tweakId]) } : { enabled: true };
        document.querySelectorAll(`[data-tweak-id="${tweakId}"]`).forEach(control => { if (control.type === 'checkbox') control.checked = true; else control.value = pendingTweaks[tweakId].value; });
      });
      updatePendingUI();
      document.querySelectorAll('[data-tuning-profile]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      playAudioTone('click');
      showToast(`${button.querySelector('strong')?.textContent || 'Tuning'} profile added to review. Nothing has been applied.`, 'info');
    });
  });

  const customProfilesKey = 'batmaniscool_custom_profiles';
  function getCustomProfiles() { try { const value = JSON.parse(localStorage.getItem(customProfilesKey) || '[]'); return Array.isArray(value) ? value : []; } catch (e) { return []; } }
  function saveCustomProfiles(profiles) { localStorage.setItem(customProfilesKey, JSON.stringify(profiles)); }
  function renderCustomProfiles() {
    const list = document.getElementById('custom-profile-list'); if (!list) return;
    list.replaceChildren(); const profiles = getCustomProfiles();
    if (!profiles.length) { const empty = document.createElement('span'); empty.className = 'custom-profile-empty'; empty.textContent = 'No saved profiles yet. Queue a few controls, name the setup, and save it here.'; list.append(empty); return; }
    profiles.forEach(profile => {
      const row = document.createElement('div'); row.className = 'custom-profile-row';
      const copy = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = profile.name; const small = document.createElement('small'); small.textContent = `${Object.keys(profile.pending || {}).length} queued controls · saved locally`; copy.append(strong, small);
      const load = document.createElement('button'); load.className = 'btn-secondary'; load.type = 'button'; load.textContent = 'Load to queue'; load.addEventListener('click', () => { queueImportedPlan({ pending: profile.pending }); showToast(`${profile.name} loaded to review. Nothing has been applied.`, 'info'); });
      const remove = document.createElement('button'); remove.className = 'btn-icon'; remove.type = 'button'; remove.title = `Delete ${profile.name}`; remove.innerHTML = '<i class="fa-solid fa-trash-can"></i>'; remove.addEventListener('click', () => { saveCustomProfiles(getCustomProfiles().filter(item => item.id !== profile.id)); renderCustomProfiles(); showToast('Custom profile deleted.', 'info'); });
      row.append(copy, load, remove); list.append(row);
    });
  }
  document.getElementById('btn-save-custom-profile')?.addEventListener('click', () => {
    const field = document.getElementById('custom-profile-name'); const name = field?.value.trim(); const pending = Object.fromEntries(Object.entries(pendingTweaks).map(([id, value]) => [id, {...value}]));
    if (!name) { showToast('Name your custom profile first.', 'warning'); return; }
    if (!Object.keys(pending).length) { showToast('Queue controls first, then save the profile.', 'warning'); return; }
    const profiles = getCustomProfiles(); profiles.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: name.slice(0, 32), pending, createdAt: new Date().toISOString() }); saveCustomProfiles(profiles.slice(0, 12)); if (field) field.value = ''; renderCustomProfiles(); showToast(`${name} saved locally.`, 'success');
  });
  renderCustomProfiles();

  // Live Console Logs
  let logItemCount = 1;
  if (window.electronAPI?.onLogUpdate) {
    window.electronAPI.onLogUpdate((logData) => {
      appendLog(logData.action, logData.success, logData.details, logData.timestamp);
    });
  }

  function appendLog(action, success, details, timestamp = new Date().toLocaleTimeString()) {
    const container = document.getElementById('log-container');
    const logCountEl = document.getElementById('log-count');
    if (!container) return;

    logItemCount++;
    if (logCountEl) logCountEl.textContent = `${logItemCount} logged`;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = document.createElement('span'); time.className = 'log-time'; time.textContent = `[${timestamp}]`;
    const tag = document.createElement('span'); tag.className = `log-tag ${success ? 'success' : 'fail'}`; tag.textContent = success ? 'SUCCESS' : 'WARN';
    const content = document.createElement('span'); content.textContent = `${action}: ${details}`;
    entry.append(time, tag, content);

    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  // Toast Notification
  function showToast(message, type = 'info') {
    const toastArea = document.getElementById('toast-area');
    if (!toastArea) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = 'fa-circle-info';
    let color = 'var(--accent-amber)';
    if (type === 'success') { icon = 'fa-circle-check'; color = 'var(--accent-emerald)'; }
    if (type === 'warning' || type === 'error') { icon = 'fa-circle-exclamation'; color = 'var(--accent-rose)'; }

    const glyph = document.createElement('i'); glyph.className = `fa-solid ${icon}`; glyph.style.color = color;
    const text = document.createElement('span'); text.textContent = message; toast.append(glyph, text);

    toastArea.appendChild(toast);
    while (toastArea.children.length > 3) toastArea.firstElementChild.remove();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
});
