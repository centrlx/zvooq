/**
 * playlist.js — Playlists page logic
 */

(() => {
  if (window.__playlistScriptLoaded) {
    window.ZLog?.('playlist', 'script already loaded, skip re-init');
    return;
  }
  window.__playlistScriptLoaded = true;

  let allPlaylists = [];
  let allTracks = [];
  let currentPlaylistId = null;
  const log = (msg, data) => window.ZLog?.('playlist', msg, data);
  const logErr = (msg, err) => window.ZError?.('playlist', msg, err);
  const isPlaylistDom = () => !!document.getElementById('playlists-grid');

async function initPlaylist() {
  log('initPlaylist start');
  renderHeader('playlist');
  bindUI();
  await loadData();

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) openPlaylistDetail(parseInt(id));
  log('initPlaylist done', { currentPlaylistId });
}

window.PageInits = window.PageInits || {};
window.PageInits.playlist = initPlaylist;
window.initPlaylist = initPlaylist;

if (!window.__SPA__) {
  document.addEventListener('DOMContentLoaded', initPlaylist);
}

async function loadData() {
  log('loadData start');
  try {
    [allPlaylists, allTracks] = await Promise.all([
      API.get('/api/playlists'),
      API.get('/api/tracks')
    ]);
    log('loadData loaded', { playlists: allPlaylists.length, tracks: allTracks.length });
    if (!isPlaylistDom()) {
      log('loadData abort render: DOM not playlist anymore');
      return;
    }
    renderPlaylistList();
  } catch (e) {
    showToast('Ошибка загрузки', 'error');
    logErr('loadData error', e);
  }
}

function renderPlaylistList() {
  const grid = document.getElementById('playlists-grid');
  log('renderPlaylistList', { count: allPlaylists.length });
  if (!allPlaylists.length) {
    grid.innerHTML = `<div class="empty-state empty-state-full">
      <div class="empty-icon material-symbols-rounded">queue_music</div>
      <h3>Нет плейлистов</h3>
      <p>Создайте первый плейлист, нажав кнопку выше</p>
    </div>`;
    return;
  }
  grid.innerHTML = allPlaylists.map(pl => buildPlCard(pl)).join('');

  grid.querySelectorAll('[data-open-pl]').forEach(btn => {
    btn.addEventListener('click', () => openPlaylistDetail(parseInt(btn.dataset.openPl)));
  });
  grid.querySelectorAll('[data-del-pl]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePlaylist(parseInt(btn.dataset.delPl));
    });
  });
}

function buildPlCard(pl) {
  const user = Auth.getUser();
  const canEdit = user && (pl.userId == user.id || user.isAdmin === true || user.isAdmin === 1);
  const tracks = pl.tracks.map(id => allTracks.find(t => t.id == id)).filter(Boolean);
  const dur = totalDuration(tracks);
  const covers = tracks.slice(0, 4).map(t => t?.cover).filter(Boolean);
  const mosaicHTML = covers.length
    ? covers.map(c => `<img src="${c}" alt="" onerror="this.style.display='none'">`).join('')
    : '<div class="playlist-cover-fallback"></div>';

  return `<div class="playlist-card">
    <div class="playlist-cover-mosaic">${mosaicHTML}</div>
    <div class="playlist-title">${pl.title}</div>
    <div class="playlist-info">${tracks.length} трека · ${formatDuration(dur)}</div>
    <div class="card-actions">
      <button class="card-btn" data-open-pl="${pl.id}"><span class="material-symbols-rounded">play_arrow</span> Открыть</button>
      ${canEdit ? `<button class="card-btn danger" data-del-pl="${pl.id}"><span class="material-symbols-rounded">delete</span> Удалить</button>` : ''}
    </div>
  </div>`;
}

function openPlaylistDetail(id) {
  log('openPlaylistDetail', { id });
  currentPlaylistId = id;
  const pl = allPlaylists.find(p => p.id === id);
  if (!pl) return;
  const user = Auth.getUser();
  const canEdit = user && (pl.userId == user.id || user.isAdmin === true || user.isAdmin === 1);
  document.getElementById('pl-list').style.display = 'none';
  document.getElementById('pl-detail').style.display = 'block';
  document.getElementById('pl-detail-title').textContent = pl.title;
  document.getElementById('pl-page-title').textContent = pl.title;
  const addBtn = document.getElementById('add-track-to-pl-btn');
  const delBtn = document.getElementById('delete-pl-btn');
  if (addBtn) addBtn.style.display = canEdit ? 'inline-flex' : 'none';
  if (delBtn) delBtn.style.display = canEdit ? 'inline-flex' : 'none';
  renderPlaylistTracks(pl);
  history.pushState({}, '', `/playlist.html?id=${id}`);
}

function renderPlaylistTracks(pl) {
  log('renderPlaylistTracks', { id: pl?.id, tracks: pl?.tracks?.length });
  const container = document.getElementById('pl-tracks-list');
  const tracks = pl.tracks.map(id => allTracks.find(t => t.id == id)).filter(Boolean);
  const user = Auth.getUser();
  const canEdit = user && (pl.userId == user.id || user.isAdmin === true || user.isAdmin === 1);

  if (!tracks.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon material-symbols-rounded">music_note</div>
      <h3>Плейлист пустой</h3>
      <p>Добавьте треки через кнопку выше</p>
    </div>`;
    return;
  }

  container.innerHTML = tracks.map((t, i) => `
    <div class="track-list-item" data-track-id="${t.id}">
      <span class="track-num track-num-wide">${i+1}</span>
      <img class="track-list-cover" src="${t.cover || ''}" alt="" onerror="this.style.display='none'">
      <div class="track-list-info">
        <div class="track-list-title">${t.title}</div>
        <div class="track-list-artist">${t.artist}</div>
      </div>
      <span class="text-12 text-muted">${formatDuration(t.duration)}</span>
      <button class="card-btn icon-only card-btn-tight" data-play="${t.id}" title="Воспроизвести"><span class="material-symbols-rounded">play_arrow</span></button>
      ${canEdit ? `<button class="card-btn danger icon-only card-btn-tight" data-remove="${t.id}" title="Убрать"><span class="material-symbols-rounded">close</span></button>` : ''}
    </div>`).join('');

  container.querySelectorAll('[data-play]').forEach(btn => {
    btn.addEventListener('click', () => {
      const track = tracks.find(t => t.id == btn.dataset.play);
      log('play track in playlist', { trackId: btn.dataset.play });
      if (track) Player.play(track, tracks);
    });
  });

  container.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeTrackFromPlaylist(parseInt(btn.dataset.remove)));
  });
}

async function removeTrackFromPlaylist(trackId) {
  if (!currentPlaylistId) return;
  log('removeTrackFromPlaylist', { trackId, currentPlaylistId });
  try {
    const user = Auth.getUser();
    if (!user) { showToast('Войдите для редактирования', 'error'); return; }
    const updated = await API.delete(`/api/playlists/${currentPlaylistId}/tracks/${trackId}?userId=${user.id}`);
    const idx = allPlaylists.findIndex(p => p.id === currentPlaylistId);
    if (idx !== -1) allPlaylists[idx] = updated;
    renderPlaylistTracks(allPlaylists[idx]);
    showToast('Трек убран из плейлиста', 'success');
  } catch (e) { showToast('Ошибка', 'error'); logErr('removeTrackFromPlaylist error', e); }
}

async function deletePlaylist(id) {
  log('deletePlaylist', { id });
  if (!confirm('Удалить плейлист?')) return;
  try {
    const user = Auth.getUser();
    if (!user) { showToast('Войдите для редактирования', 'error'); return; }
    await API.delete(`/api/playlists/${id}?userId=${user.id}`);
    allPlaylists = allPlaylists.filter(p => p.id !== id);
    if (currentPlaylistId === id) {
      currentPlaylistId = null;
      document.getElementById('pl-detail').style.display = 'none';
      document.getElementById('pl-list').style.display = 'block';
      history.pushState({}, '', '/playlist.html');
    }
    renderPlaylistList();
    showToast('Плейлист удалён', 'success');
  } catch (e) { showToast('Ошибка', 'error'); logErr('deletePlaylist error', e); }
}

function bindUI() {
  log('bindUI');
  if (!isPlaylistDom()) {
    log('bindUI skipped: DOM not playlist');
    return;
  }
  // Back to list
  const backBtn = document.getElementById('back-to-list');
  if (backBtn) backBtn.addEventListener('click', () => {
    log('back to list');
    currentPlaylistId = null;
    document.getElementById('pl-detail').style.display = 'none';
    document.getElementById('pl-list').style.display = 'block';
    document.getElementById('pl-page-title').textContent = 'Плейлисты';
    history.pushState({}, '', '/playlist.html');
  });

  // Delete current playlist
  const deleteBtn = document.getElementById('delete-pl-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      log('delete current playlist click', { currentPlaylistId });
      if (currentPlaylistId) deletePlaylist(currentPlaylistId);
    });
  }

  // New playlist modal
  const newPlBtn = document.getElementById('new-pl-btn');
  const newPlModal = document.getElementById('new-pl-modal');
  const closeNewPl = document.getElementById('close-new-pl-modal');
  const cancelPl = document.getElementById('cancel-pl-btn');
  const createPl = document.getElementById('create-pl-btn');
  if (newPlBtn && newPlModal) {
    newPlBtn.addEventListener('click', () => newPlModal.classList.add('open'));
  }
  if (closeNewPl && newPlModal) {
    closeNewPl.addEventListener('click', () => newPlModal.classList.remove('open'));
  }
  if (cancelPl && newPlModal) {
    cancelPl.addEventListener('click', () => newPlModal.classList.remove('open'));
  }
  if (createPl) {
    createPl.addEventListener('click', createPlaylist);
  }

  // Add track to playlist modal
  const addTrackBtn = document.getElementById('add-track-to-pl-btn');
  const addTrackModal = document.getElementById('add-track-modal');
  const closeAddTrack = document.getElementById('close-add-track-modal');
  const modalSearch = document.getElementById('modal-search');
  if (addTrackBtn && addTrackModal) {
    addTrackBtn.addEventListener('click', () => {
      log('open add-track modal');
      renderModalTracks('');
      addTrackModal.classList.add('open');
    });
  }
  if (closeAddTrack && addTrackModal) {
    closeAddTrack.addEventListener('click', () => addTrackModal.classList.remove('open'));
  }
  if (modalSearch) {
    modalSearch.addEventListener('input', (e) => {
      log('modal search', e.target.value);
      renderModalTracks(e.target.value.toLowerCase());
    });
  }

  // Close modals on overlay click
  if (newPlModal) {
    newPlModal.addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
  }
  if (addTrackModal) {
    addTrackModal.addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
  }
}

function renderModalTracks(query) {
  log('renderModalTracks', { query });
  const pl = allPlaylists.find(p => p.id === currentPlaylistId);
  const existing = pl?.tracks || [];
  let tracks = allTracks.filter(t => !existing.includes(t.id));
  if (query) tracks = tracks.filter(t =>
    t.title.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query)
  );

  const list = document.getElementById('modal-track-list');
  if (!tracks.length) {
    list.innerHTML = `<p class="empty-text">Все треки уже в плейлисте или не найдено</p>`;
    return;
  }
  list.innerHTML = tracks.map(t => `
    <div class="track-list-item cursor-pointer" data-add-track="${t.id}">
      <img class="track-list-cover" src="${t.cover||''}" alt="" onerror="this.style.display='none'">
      <div class="track-list-info">
        <div class="track-list-title">${t.title}</div>
        <div class="track-list-artist">${t.artist}</div>
      </div>
      <button class="btn btn-primary btn-sm no-shrink">+ Добавить</button>
    </div>`).join('');

  list.querySelectorAll('[data-add-track]').forEach(el => {
    el.querySelector('button').addEventListener('click', async () => {
      await addTrackToPlaylist(parseInt(el.dataset.addTrack));
    });
  });
}

async function addTrackToPlaylist(trackId) {
  if (!currentPlaylistId) return;
  log('addTrackToPlaylist', { trackId, currentPlaylistId });
  try {
    const user = Auth.getUser();
    if (!user) { showToast('Войдите для редактирования', 'error'); return; }
    const updated = await API.post(`/api/playlists/${currentPlaylistId}/tracks`, { trackId, userId: user.id });
    const idx = allPlaylists.findIndex(p => p.id === currentPlaylistId);
    if (idx !== -1) allPlaylists[idx] = updated;
    renderPlaylistTracks(allPlaylists[idx]);
    document.getElementById('add-track-modal').classList.remove('open');
    showToast('Трек добавлен в плейлист ✓', 'success');
  } catch (e) { showToast('Ошибка', 'error'); logErr('addTrackToPlaylist error', e); }
}

async function createPlaylist() {
  log('createPlaylist');
  const user = Auth.getUser();
  if (!user) { showToast('Войдите для создания плейлиста', 'error'); return; }
  const name = document.getElementById('new-pl-name').value.trim();
  if (!name) { showToast('Введите название', 'error'); return; }
  try {
    const pl = await API.post('/api/playlists', { title: name, userId: user.id });
    allPlaylists.push(pl);
    renderPlaylistList();
    document.getElementById('new-pl-modal').classList.remove('open');
    document.getElementById('new-pl-name').value = '';
    showToast('Плейлист создан ✓', 'success');
  } catch (e) { showToast('Ошибка создания', 'error'); logErr('createPlaylist error', e); }
}

})();
