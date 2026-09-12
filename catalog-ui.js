document.addEventListener('DOMContentLoaded', () => {
  function section(tab, title) {
    const page = document.getElementById(`tab-${tab}`);
    if (!page) return null;
    const group = document.createElement('div'); group.className = 'tweaks-section';
    const heading = document.createElement('div'); heading.className = 'tweaks-section-label';
    heading.textContent = title;
    const grid = document.createElement('div'); grid.className = 'tweaks-grid';
    group.append(heading, grid); page.append(group); return grid;
  }
  const groups = new Map();
  const powerGrid = section('performance', 'Plugged-in power controls');
  for (const item of window.powerOptions) {
    if (item.legacy) document.querySelectorAll(`[data-tweak="${item.legacy}"]`).forEach(card => card.remove());
    const card = document.createElement('div'); card.className = 'tweak-card power-card'; card.dataset.tweak = item.id;
    card.innerHTML = '<div class="tweak-info"><div class="power-label">PLUGGED IN · ORIGINAL-VALUE RESTORE</div><div class="tweak-title-row"><span class="tweak-title"></span><span class="status-chip"></span></div><div class="tweak-desc"></div></div><div class="power-actions"><select class="select-input tweak-select"><option value="">Choose a value…</option></select><button type="button" class="btn-secondary power-restore">Queue original value</button></div>';
    card.querySelector('.tweak-title').textContent = item.title;
    card.querySelector('.tweak-desc').textContent = item.description;
    const select = card.querySelector('select'); select.dataset.tweakId = item.id; select.setAttribute('aria-label', item.title);
    for (const [value,label] of item.options) select.add(new Option(label, String(value)));
    card.querySelector('button').dataset.powerId = item.id;
    powerGrid.append(card);
  }
  for (const item of window.tweakCatalog.catalog) {
    if (!groups.has(item.tab)) groups.set(item.tab, section(item.tab, 'More controls · original-value restore'));
    const card = document.createElement('div'); card.className = 'tweak-card'; card.dataset.tweak = item.id;
    card.innerHTML = `<div class="tweak-info"><div class="tweak-title-row"><span class="tweak-title"></span><span class="status-chip"></span></div><div class="tweak-desc"></div></div><label class="switch"><input type="checkbox" class="tweak-toggle"><span class="slider"></span></label>`;
    card.querySelector('.tweak-title').textContent = item.title;
    card.querySelector('.tweak-desc').textContent = item.description;
    const input = card.querySelector('input'); input.dataset.tweakId = item.id; input.setAttribute('aria-label', item.title);
    groups.get(item.tab)?.append(card);
  }
  const debloat = section('debloat', 'Remove individual apps');
  for (const item of window.tweakCatalog.apps) {
    const card = document.createElement('div'); card.className = 'tweak-card'; card.dataset.tweak = `debloat-${item.id}`;
    card.innerHTML = '<div class="tweak-info"><div class="tweak-title"></div><div class="tweak-desc">Remove for your Windows account. Local app data may be lost. Reinstall from Microsoft Store if needed.</div><span class="status-chip"></span></div><button type="button" class="btn-secondary debloat-action">Queue removal</button>';
    card.querySelector('.tweak-title').textContent = item.title;
    card.querySelector('button').dataset.debloatProfile = item.id; debloat?.append(card);
  }
  const repairs = section('repair', 'Checks without automatic repairs');
  for (const [id, title, desc] of [
    ['verify-windows-files', 'Verify Windows system files', 'Runs SFC verification without repairing files. Administrator access required; may take several minutes.'],
    ['check-component-store', 'Check component-store health', 'Reads the DISM component-store corruption flag without starting a repair. Administrator access required.']
  ]) {
    const card = document.createElement('div'); card.className = 'tweak-card';
    card.innerHTML = '<div class="tweak-info"><div class="tweak-title"></div><div class="tweak-desc"></div></div><button type="button" class="btn-secondary catalog-action">Queue check</button>';
    card.querySelector('.tweak-title').textContent = title; card.querySelector('.tweak-desc').textContent = desc;
    card.querySelector('button').dataset.action = id; repairs?.append(card);
  }
  const advancedPerformance = section('performance', 'Adapter, cache & background controls');
  for (const [id, title, desc, enabled = true] of [
    ['network-rss', 'Enable network RSS', 'Uses multiple CPU cores for supported adapter receive processing.', true],
    ['network-rsc', 'Disable network RSC', 'Turns off receive-segment coalescing on supported adapters. Test in your own games before keeping it.', true],
    ['network-lso', 'Disable network LSO', 'Turns off large-send offload on supported adapters. Test before keeping it.', true],
    ['sysmain-service', 'Disable SysMain service', 'Stops Windows preloading activity. It can reduce background disk work but may slow some app launches.', true],
    ['search-indexer-service', 'Disable Search indexing', 'Stops Windows Search indexing. Search results can become slower or incomplete.', true]
  ]) {
    const card = document.createElement('div'); card.className = 'tweak-card'; card.dataset.tweak = id;
    card.innerHTML = '<div class="tweak-info"><div class="tweak-title-row"><span class="tweak-title"></span><span class="status-chip"></span></div><div class="tweak-desc"></div></div><label class="switch"><input type="checkbox" class="tweak-toggle"><span class="slider"></span></label>';
    card.querySelector('.tweak-title').textContent = title; card.querySelector('.tweak-desc').textContent = desc;
    card.querySelector('input').dataset.tweakId = id; card.querySelector('input').checked = !enabled;
    advancedPerformance.append(card);
  }
  const cacheTools = section('maintenance', 'Cache & network cleanup');
  for (const [id, title, desc] of [
    ['clean-shader-caches', 'Clean graphics shader caches', 'Clears DirectX, NVIDIA, and AMD shader-cache files that Windows can rebuild. The first game launch afterward may stutter while caches rebuild.'],
    ['flush-arp-cache', 'Flush ARP cache', 'Clears cached local network address mappings. This does not change your internet provider or server ping.']
  ]) {
    const card = document.createElement('div'); card.className = 'tweak-card';
    card.innerHTML = '<div class="tweak-info"><div class="tweak-title"></div><div class="tweak-desc"></div></div><button type="button" class="btn-secondary catalog-action">Add to queue</button>';
    card.querySelector('.tweak-title').textContent = title; card.querySelector('.tweak-desc').textContent = desc;
    card.querySelector('button').dataset.action = id; cacheTools?.append(card);
  }
  const performancePage = document.getElementById('tab-performance');
  const performanceCards = [...performancePage.querySelectorAll('.tweak-card')];
  const oldGroups = [...performancePage.querySelectorAll(':scope > .tweaks-section')];
  const categories = [
    ['Games & input', new Set(['game-mode','hags','mouse-accel','sticky-keys','game-dvr','game-bar-overlay','fullscreen-optimizations','high-performance-gpu','pointer-trails','keyboard-repeat','keyboard-repeat-speed','game-bar-tips','game-dvr-audio','show-fps-widget','mouse-click-lock','mouse-snap-default'])],
    ['CPU, power & cooling', new Set(['power-throttling','core-parking','usb-selective-suspend','power-plan', ...window.powerOptions.filter(item => item.id !== 'power-wifi').map(item => item.id)])],
    ['Network & connection settings', new Set(['power-wifi','network-throttling','tcp-ack-profile','tcp-fast-open','network-adapter-power','delivery-optimization','network-rss','network-rsc','network-lso'])],
    ['Memory & scheduling experiments', new Set(['dynamic-tick','gaming-responsiveness','games-priority-profile','paging-executive','large-system-cache','memory-compression','ntfs-last-access','sysmain-service','search-indexer-service'])],
    ['Desktop & background activity', new Set(['desktop-menu-delay','mouse-hover-delay'])]
  ];
  const grids = categories.map(([title]) => section('performance', title));
  for (const card of performanceCards) {
    let index = categories.findIndex(([,ids]) => ids.has(card.dataset.tweak));
    if (card.querySelector('#btn-optimize-tcp')) index = 2;
    grids[index < 0 ? categories.length - 1 : index].append(card);
  }
  oldGroups.forEach(group => group.remove());
  const navigation = document.createElement('nav'); navigation.className = 'category-navigation'; navigation.setAttribute('aria-label', 'Jump to tuning category');
  categories.forEach(([title],index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = title;
    button.addEventListener('click', () => {
      const group = grids[index].closest('details');
      const search = performancePage.querySelector('input[type="search"]'); search.value = '';
      performancePage.querySelector('.queued-filter').setAttribute('aria-pressed','false'); search.dispatchEvent(new Event('input'));
      group.open = true; group.scrollIntoView({ block:'start', behavior:'smooth' }); group.querySelector('summary').focus({ preventScroll:true });
    }); navigation.append(button);
  });
  performancePage.querySelector('.tuning-profiles').after(navigation);
  const release = document.createElement('div'); release.className = 'changelog-entry';
  release.innerHTML = '<span>v4.4</span><p>Eight selectable power controls with saved-value restore, three browser controls, updated profiles, category shortcuts, and a queued-only filter. Removed nine unverified or duplicate entries and corrected Explorer labels. Nothing runs when a profile is selected.</p>';
  document.getElementById('drawer-changes-panel').prepend(release);
  // Native disclosure groups keep a growing catalog manageable with a keyboard too.
  document.querySelectorAll('.page-tab-content').forEach(page => {
    const cards = [...page.querySelectorAll('.tweak-card')];
    if (cards.length < 5 || page.id === 'tab-dashboard') return;
    page.querySelectorAll(':scope > .tweaks-section').forEach(group => {
      const label = group.querySelector('.tweaks-section-label');
      if (!label) return;
      const details = document.createElement('details'); details.className = 'tweak-disclosure'; details.open = true;
      const summary = document.createElement('summary'); summary.textContent = label.querySelector('span')?.textContent || label.textContent;
      const number = document.createElement('small'); number.textContent = `${group.querySelectorAll('.tweak-card').length} options`; summary.append(number);
      label.remove(); group.before(details); details.append(summary, group);
    });
    const toolbar = document.createElement('div'); toolbar.className = 'catalog-toolbar';
    toolbar.innerHTML = '<input type="search" placeholder="Find a setting…" aria-label="Search controls on this page"><span class="catalog-count" aria-live="polite"></span><button type="button" class="btn-secondary queued-filter" aria-pressed="false">Queued only</button><button type="button" class="btn-secondary collapse-groups">Collapse groups</button>';
    const empty = document.createElement('p'); empty.className = 'catalog-empty'; empty.textContent = 'No matching controls. Try a different search.'; empty.hidden = true;
    page.querySelector('.page-header')?.after(toolbar); toolbar.after(empty);
    const search = toolbar.querySelector('input'); const count = toolbar.querySelector('.catalog-count');
    const filter = () => {
      const term = search.value.trim().toLowerCase(); let visible = 0;
      const queuedOnly = toolbar.querySelector('.queued-filter').getAttribute('aria-pressed') === 'true';
      for (const card of cards) { card.hidden = !card.textContent.toLowerCase().includes(term) || (queuedOnly && !card.classList.contains('pending')); if (!card.hidden) visible++; }
      for (const group of page.querySelectorAll('.tweak-disclosure')) {
        group.hidden = ![...group.querySelectorAll('.tweak-card')].some(card => !card.hidden);
        if (term || queuedOnly) group.open = true;
      }
      count.textContent = `${visible} of ${cards.length} controls`; empty.hidden = visible > 0;
    };
    search.addEventListener('input', filter); filter();
    document.addEventListener('queue-updated', filter);
    toolbar.querySelector('.queued-filter').addEventListener('click', event => {
      event.currentTarget.setAttribute('aria-pressed', String(event.currentTarget.getAttribute('aria-pressed') !== 'true')); filter();
    });
    toolbar.querySelector('.collapse-groups').addEventListener('click', event => {
      const groups = [...page.querySelectorAll('.tweak-disclosure')]; const open = !groups.some(group => group.open);
      groups.forEach(group => group.open = open); event.currentTarget.textContent = open ? 'Collapse groups' : 'Expand groups';
    });
  });
});
