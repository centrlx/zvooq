/**
 * index.js — Main page: render tracks, albums, playlists
 * Handles search, filter, play, favorite, delete
 */

let allTracks = [];
let allAlbums = [];
let allPlaylists = [];
let favTrackIds = [];
let indexDocBound = false;
const SHOW_LIMIT = 10;
const log = (msg, data) => window.ZLog?.('index', msg, data);
const logErr = (msg, err) => window.ZError?.('index', msg, err);
const isIndexDom = () => !!document.getElementById('search-input');

// ── Init ────────────────────────────────────────────────────
async function initIndex() {
  log('initIndex start');
  renderHeader('index');
  const user = Auth.getUser();
  favTrackIds = user?.favoriteTracks || [];
  await loadData();
  if (!isIndexDom()) {
    log('initIndex aborted: DOM not index anymore');
    return;
  }
  bindUI();
  log('initIndex done');
}

async function loadData() {
  log('loadData start');
  try {
    [allTracks, allAlbums, allPlaylists] = await Promise.all([
      API.get('/api/tracks'),
      API.get('/api/albums'),
      API.get('/api/playlists')
    ]);
    log('loadData loaded', { tracks: allTracks.length, albums: allAlbums.length, playlists: allPlaylists.length });
    if (!isIndexDom()) {
      log('loadData abort render: DOM not index anymore');
      return;
    }
    populateGenreFilter();
    renderAll();
  } catch (e) {
    showToast('Ошибка загрузки данных', 'error');
    logErr('loadData error', e);
  }
}

// ── Render ───────────────────────────────────────────────────

function renderAll() {
  log('renderAll');
  const params = new URLSearchParams(window.location.search);
  const viewAll = params.get('view') === 'all';
  const viewType = params.get('type');

  const query     = document.getElementById('search-input').value.toLowerCase();
  const genreF    = document.getElementById('filter-genre').value;
  const typeF     = document.getElementById('filter-type').value;

  // Standalone tracks (no albumId)
  let tracks = allTracks.filter(t => !t.albumId);
  let albums = allAlbums;

  // Apply search & filters
  if (query) {
    tracks = tracks.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.artist.toLowerCase().includes(query) ||
      (t.genre || '').toLowerCase().includes(query)
    );
    albums = albums.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.artist.toLowerCase().includes(query) ||
      (a.genre || '').toLowerCase().includes(query)
    );
  }
  if (genreF) {
    tracks = tracks.filter(t => t.genre === genreF);
    albums = albums.filter(a => a.genre === genreF);
  }
  if (typeF === 'track') albums = [];
  if (typeF === 'album') tracks = [];

  const sectionTracks = document.getElementById('section-tracks');
  const sectionAlbums = document.getElementById('section-albums');
  const sectionPlaylists = document.getElementById('section-playlists');

  if (viewAll) {
    if (viewType === 'tracks') { albums = []; }
    if (viewType === 'albums') { tracks = []; }
    if (viewType === 'playlists') { tracks = []; albums = []; }
    if (sectionTracks) sectionTracks.style.display = viewType === 'tracks' ? 'block' : 'none';
    if (sectionAlbums) sectionAlbums.style.display = viewType === 'albums' ? 'block' : 'none';
    if (sectionPlaylists) sectionPlaylists.style.display = viewType === 'playlists' ? 'block' : 'none';

    const viewHeader = document.getElementById('view-all-header');
    const mainHeader = document.getElementById('main-page-header');
    const viewTitle = document.getElementById('view-all-title');
    const viewSubtitle = document.getElementById('view-all-subtitle');
    if (viewHeader) viewHeader.style.display = 'flex';
    if (mainHeader) mainHeader.style.display = 'none';
    if (viewTitle) viewTitle.textContent = viewType === 'albums' ? 'Все альбомы' : viewType === 'playlists' ? 'Все плейлисты' : 'Все треки';
    if (viewSubtitle) viewSubtitle.textContent = 'Полный список';
  } else {
    if (sectionTracks) sectionTracks.style.display = 'block';
    if (sectionAlbums) sectionAlbums.style.display = 'block';
    if (sectionPlaylists) sectionPlaylists.style.display = 'block';
    const viewHeader = document.getElementById('view-all-header');
    const mainHeader = document.getElementById('main-page-header');
    if (viewHeader) viewHeader.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'flex';
  }

  renderTracks(viewAll ? tracks : tracks.slice(0, SHOW_LIMIT), tracks.length);
  renderAlbums(viewAll ? albums : albums.slice(0, SHOW_LIMIT), albums.length);
  renderPlaylists(viewAll ? allPlaylists : allPlaylists.slice(0, SHOW_LIMIT), allPlaylists.length);
  requestAnimationFrame(initAlbumTrackToggles);

  // Tab mirrors
  document.getElementById('tracks-grid-tab').innerHTML = tracks.length
    ? tracks.map(t => buildCard(t, [], { favTrackIds })).join('')
    : emptyState('Треки не найдены');
  document.getElementById('albums-grid-tab').innerHTML = albums.length
    ? albums.map(a => buildCard(a, getAlbumTracks(a.id), { isAlbum: true, favTrackIds })).join('')
    : emptyState('Альбомы не найдены');
  document.getElementById('playlists-grid-tab').innerHTML = allPlaylists.length
    ? allPlaylists.map(p => buildPlaylistCard(p)).join('')
    : emptyState('Плейлисты не найдены');

  setRowMode(!viewAll);
  log('renderAll done', { tracks: tracks.length, albums: albums.length, playlists: allPlaylists.length, viewAll, viewType });
}

function renderTracks(tracks, total = tracks.length) {
  const grid = document.getElementById('tracks-grid');
  document.getElementById('track-count').textContent = `(${total})`;
  grid.innerHTML = tracks.length
    ? tracks.map(t => buildCard(t, [], { favTrackIds })).join('')
    : emptyState('Треки не найдены');
  toggleShowAll('tracks', total);
}

function renderAlbums(albums, total = albums.length) {
  const grid = document.getElementById('albums-grid');
  document.getElementById('album-count').textContent = `(${total})`;
  grid.innerHTML = albums.length
    ? albums.map(a => buildCard(a, getAlbumTracks(a.id), { isAlbum: true, favTrackIds })).join('')
    : emptyState('Альбомы не найдены');
  toggleShowAll('albums', total);
}

function renderPlaylists(playlists, total = playlists.length) {
  const grid = document.getElementById('playlists-grid');
  document.getElementById('playlist-count').textContent = `(${total})`;
  grid.innerHTML = playlists.length
    ? playlists.map(p => buildPlaylistCard(p)).join('')
    : emptyState('Плейлисты не найдены');
  document.getElementById('playlists-grid-tab').innerHTML = grid.innerHTML;
  toggleShowAll('playlists', total);
}

function buildPlaylistCard(playlist) {
  const user = Auth.getUser();
  const canEdit = user && (playlist.userId == user.id || user.isAdmin === true || user.isAdmin === 1);
  const tracks = playlist.tracks.map(id => allTracks.find(t => t.id == id)).filter(Boolean);
  const dur = totalDuration(tracks);
  const covers = tracks.slice(0, 4).map(t => t?.cover).filter(Boolean);
  const mosaicHTML = covers.length
    ? covers.map(c => `<img src="${c}" alt="" onerror="this.style.display='none'">`).join('')
    : '<div style="background:var(--surface);width:100%;height:100%"></div>';

  return `
    <div class="playlist-card" data-pl-id="${playlist.id}">
      <div class="playlist-cover-mosaic">${mosaicHTML}</div>
      <div class="playlist-title">${playlist.title}</div>
      <div class="playlist-info">${tracks.length} трека · ${formatDuration(dur)}</div>
      <div class="card-actions" style="margin-top:12px;">
        <a href="/playlist.html?id=${playlist.id}" class="card-btn"><span class="material-symbols-rounded">play_arrow</span> Открыть</a>
        ${canEdit ? `<button class="card-btn danger" data-action="delete-playlist" data-id="${playlist.id}"><span class="material-symbols-rounded">delete</span> Удалить</button>` : ''}
      </div>
    </div>`;
}

function emptyState(msg) {
  return `<div class="empty-state" style="grid-column:1/-1;padding:40px 0;">
    <div class="empty-icon material-symbols-rounded">music_note</div>
    <p>${msg}</p>
  </div>`;
}

function getAlbumTracks(albumId) {
  return allTracks.filter(t => t.albumId == albumId);
}

// ── Genre filter population ──────────────────────────────────

function populateGenreFilter() {
  const genres = [...new Set([
    ...allTracks.map(t => t.genre),
    ...allAlbums.map(a => a.genre)
  ].filter(Boolean))];
  const sel = document.getElementById('filter-genre');
  genres.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    sel.appendChild(o);
  });
}

// ── Bind UI events ───────────────────────────────────────────

function bindUI() {
  log('bindUI');
  if (!isIndexDom()) {
    log('bindUI skipped: DOM not index');
    return;
  }
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Search & Filter
  const searchInput = document.getElementById('search-input');
  const filterGenre = document.getElementById('filter-genre');
  const filterType  = document.getElementById('filter-type');
  if (searchInput) searchInput.addEventListener('input', renderAll);
  if (filterGenre) filterGenre.addEventListener('change', renderAll);
  if (filterType)  filterType.addEventListener('change', renderAll);

  // Card actions (delegated)
  if (!indexDocBound) {
    document.addEventListener('click', handleCardClick);
    indexDocBound = true;
  }

  // Playlist modal
  const newPlBtn = document.getElementById('new-playlist-btn');
  const modalClose = document.getElementById('modal-close-btn');
  const cancelPl = document.getElementById('cancel-playlist-btn');
  const createPl = document.getElementById('create-playlist-btn');
  const modal = document.getElementById('playlist-modal');
  if (newPlBtn) newPlBtn.addEventListener('click', () => {
    log('open playlist modal');
    modal?.classList.add('open');
  });
  if (modalClose) modalClose.addEventListener('click', () => {
    log('close playlist modal');
    modal?.classList.remove('open');
  });
  if (cancelPl) cancelPl.addEventListener('click', () => {
    log('cancel playlist modal');
    modal?.classList.remove('open');
  });
  if (createPl) createPl.addEventListener('click', createPlaylist);

  // Close modal on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
  }

  const backBtn = document.getElementById('view-all-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      log('view all back');
      history.pushState({}, '', '/index.html');
      renderAll();
    });
  }

  const showTracks = document.getElementById('tracks-show-all');
  if (showTracks) showTracks.addEventListener('click', () => setViewAll('tracks'));
  const showAlbums = document.getElementById('albums-show-all');
  if (showAlbums) showAlbums.addEventListener('click', () => setViewAll('albums'));
  const showPlaylists = document.getElementById('playlists-show-all');
  if (showPlaylists) showPlaylists.addEventListener('click', () => setViewAll('playlists'));
}

function setRowMode(enabled) {
  const grids = ['tracks-grid','albums-grid','playlists-grid','tracks-grid-tab','albums-grid-tab','playlists-grid-tab']
    .map(id => document.getElementById(id)).filter(Boolean);
  grids.forEach(g => {
    g.classList.toggle('cards-row', enabled);
  });
}

function toggleShowAll(type, total) {
  const btn = document.getElementById(`${type}-show-all`);
  if (!btn) return;
  const params = new URLSearchParams(window.location.search);
  const viewAll = params.get('view') === 'all';
  btn.style.display = (!viewAll && total > SHOW_LIMIT) ? 'inline-flex' : 'none';
}

function setViewAll(type) {
  history.pushState({}, '', `/index.html?view=all&type=${type}`);
  renderAll();
}

window.PageInits = window.PageInits || {};
window.PageInits.index = initIndex;
window.initIndex = initIndex;

if (!window.__SPA__) {
  document.addEventListener('DOMContentLoaded', initIndex);
}

async function handleCardClick(e) {
  // Play track mini
  const playMini = e.target.closest('.track-play-mini');
  if (playMini) {
    log('track mini play');
    try {
      const track = JSON.parse(playMini.dataset.track);
      const albumId = track.albumId;
      const queue = albumId ? allTracks.filter(t => t.albumId == albumId) : [track];
      Player.play(track, queue);
    } catch {}
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id     = btn.dataset.id;
  const type   = btn.dataset.type;

  // Play album/track
  if (action === 'play') {
    log('play action', { id, type });
    if (type === 'album') {
      const tracks = getAlbumTracks(id);
      if (tracks.length) Player.play(tracks[0], tracks);
    } else {
      const track = allTracks.find(t => t.id == id);
      if (track) Player.play(track, allTracks.filter(t => !t.albumId));
    }
    return;
  }

  // Favorite
  if (action === 'fav') {
    log('favorite action', { id });
    const isFav = await toggleFavorite(parseInt(id), btn);
    if (isFav !== undefined) {
      if (isFav) { if (!favTrackIds.includes(parseInt(id))) favTrackIds.push(parseInt(id)); }
      else favTrackIds = favTrackIds.filter(x => x !== parseInt(id));
    }
    return;
  }

  if (action === 'toggle-tracks') {
    log('toggle tracks');
    const tracksWrap = btn.closest('.card-tracks');
    if (!tracksWrap) return;
    const isExpanded = tracksWrap.classList.toggle('expanded');
    const more = parseInt(btn.dataset.more || '0');
    setAlbumTracksHeight(tracksWrap, isExpanded);
    btn.innerHTML = isExpanded
      ? `<span class="material-symbols-rounded">expand_less</span> Скрыть`
      : `<span class="material-symbols-rounded">expand_more</span> Показать еще ${more}`;
    const albumId = tracksWrap.dataset.albumId;
    if (albumId) {
      const map = getAlbumExpandMap();
      map[albumId] = isExpanded;
      setAlbumExpandMap(map);
    }
    return;
  }

  // Edit
  if (action === 'edit') {
    log('edit action', { id, type });
    window.location.href = `/edit-track.html?id=${id}&type=${type}`;
    return;
  }

  // Delete track/album
  if (action === 'delete') {
    log('delete action', { id, type });
    if (!confirm(`Удалить "${type === 'album' ? 'альбом' : 'трек'}"? Это действие нельзя отменить.`)) return;
    try {
      if (type === 'album') {
        await API.delete(`/api/albums/${id}`);
        allAlbums = allAlbums.filter(a => a.id != id);
        allTracks = allTracks.filter(t => t.albumId != id);
      } else {
        await API.delete(`/api/tracks/${id}`);
        allTracks = allTracks.filter(t => t.id != id);
      }
      showToast('Удалено и перемещено в архив', 'success');
      renderAll();
    } catch { showToast('Ошибка удаления', 'error'); }
    return;
  }

  // Delete playlist
  if (action === 'delete-playlist') {
    log('delete playlist action', { id });
    if (!confirm('Удалить плейлист?')) return;
    try {
      const user = Auth.getUser();
      if (!user) { showToast('Войдите, чтобы удалять плейлисты', 'error'); return; }
      await API.delete(`/api/playlists/${id}?userId=${user.id}`);
      allPlaylists = allPlaylists.filter(p => p.id != id);
      renderAll();
      showToast('Плейлист удалён', 'success');
    } catch { showToast('Ошибка', 'error'); }
    return;
  }
}

const albumExpandKey = 'zvooq_album_expand';
function getAlbumExpandMap() {
  try { return JSON.parse(sessionStorage.getItem(albumExpandKey) || '{}'); } catch { return {}; }
}
function setAlbumExpandMap(map) {
  sessionStorage.setItem(albumExpandKey, JSON.stringify(map));
}

function setAlbumTracksHeight(tracksWrap, expanded) {
  const list = tracksWrap.querySelector('.card-tracks-list');
  if (!list) return;
  const rows = [...list.querySelectorAll('.card-track-row')];
  if (!rows.length) return;
  if (expanded) {
    list.style.maxHeight = `${list.scrollHeight}px`;
    return;
  }
  const limit = parseInt(tracksWrap.dataset.showLimit || '3');
  const idx = Math.min(limit, rows.length) - 1;
  const last = rows[idx];
  const h = last.offsetTop + last.offsetHeight;
  list.style.maxHeight = `${h}px`;
}

function initAlbumTrackToggles() {
  document.querySelectorAll('.card-tracks').forEach(tracksWrap => {
    const list = tracksWrap.querySelector('.card-tracks-list');
    if (!list) return;
    const toggle = tracksWrap.querySelector('[data-action="toggle-tracks"]');
    if (!toggle) {
      list.style.maxHeight = `${list.scrollHeight}px`;
      return;
    }
    const expanded = tracksWrap.classList.contains('expanded');
    setAlbumTracksHeight(tracksWrap, expanded);
  });
}

async function createPlaylist() {
  log('createPlaylist start');
  const user = Auth.getUser();
  if (!user) { showToast('Войдите для создания плейлиста', 'error'); return; }
  const name = document.getElementById('playlist-name-input').value.trim();
  if (!name) { showToast('Введите название', 'error'); return; }
  try {
    const pl = await API.post('/api/playlists', { title: name, userId: user.id });
    allPlaylists.push(pl);
    renderAll();
    document.getElementById('playlist-modal').classList.remove('open');
    document.getElementById('playlist-name-input').value = '';
    showToast('Плейлист создан ✓', 'success');
    log('createPlaylist done', pl);
  } catch { showToast('Ошибка создания', 'error'); }
}
