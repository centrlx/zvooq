








const API = {
  async get(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('[API] GET', url, e);
      throw e;
    }
  },
  async post(url, data) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      return out;
    } catch (e) {
      console.error('[API] POST', url, e);
      throw e;
    }
  },
  async put(url, data) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      return out;
    } catch (e) {
      console.error('[API] PUT', url, e);
      throw e;
    }
  },
  async delete(url) {
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      return out;
    } catch (e) {
      console.error('[API] DELETE', url, e);
      throw e;
    }
  },
  async postForm(url, formData) {
    try {
      const res = await fetch(url, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      return out;
    } catch (e) {
      console.error('[API] POST_FORM', url, e);
      throw e;
    }
  }
};





const Auth = {
  getUser() {
    try {
      const u = JSON.parse(localStorage.getItem('zvooq_user'));
      return u;
    } catch (e) {
      console.error('[Auth] getUser parse error', e);
      return null;
    }
  },
  setUser(u) { localStorage.setItem('zvooq_user', JSON.stringify(u)); },
  logout() {
    if (window.Player?.stop) Player.stop(true);
    localStorage.removeItem('zvooq_user');
    window.location.href = '/auth.html';
  },
  isLoggedIn() { return !!this.getUser(); },
  requireAuth() {
    if (!this.isLoggedIn()) { window.location.href = '/auth.html'; return false; }
    return true;
  }
};





function showToast(msg, type = 'success', duration = 3000, icon = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-rounded';
    iconEl.textContent = icon;
    const textEl = document.createElement('span');
    textEl.className = 'toast-text';
    textEl.textContent = msg;
    toast.append(iconEl, textEl);
  } else {
    toast.textContent = msg;
  }
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}





function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
}

function totalDuration(tracks) {
  return tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
}





const Player = (() => {

  let state = JSON.parse(sessionStorage.getItem('zvooq_player') || '{}');

  if (!state.queue) state.queue = [];
  if (state.volume === undefined) state.volume = 0.8;

  let audio = null;
  let ui = {};

  function saveState() { sessionStorage.setItem('zvooq_player', JSON.stringify(state)); }

  function initAudio() {

    audio = document.getElementById('zvooq-audio');
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'zvooq-audio';
      audio.style.display = 'none';
      document.body.appendChild(audio);
    }
    audio.volume = state.volume;

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      if (ui.fill) ui.fill.style.width = pct + '%';
      if (ui.current) ui.current.textContent = formatDuration(audio.currentTime);
      state.progress = audio.currentTime;
      saveState();
    });

    audio.addEventListener('loadedmetadata', () => {
      if (ui.total) ui.total.textContent = formatDuration(audio.duration);
    });
    audio.addEventListener('play', () => {
      state.playing = true;
      state.autoplayPending = false;
      updatePlayBtn(true);
      saveState();
    });
    audio.addEventListener('pause', () => {
      state.playing = false;
      updatePlayBtn(false);
      saveState();
    });
  }

  function buildUI() {
    const playerEl = document.getElementById('global-player');
    if (!playerEl) return;

    playerEl.innerHTML = `
      <div class="player-info">
        <img class="player-cover" id="player-cover" src="" alt="">
        <div class="player-meta">
          <div class="player-title" id="player-title">Не воспроизводится</div>
          <div class="player-artist" id="player-artist">—</div>
        </div>
      </div>
      <div class="player-controls">
        <div class="player-buttons">
          <button class="player-btn icon-only" id="player-shuffle" title="Перемешать"><span class="material-symbols-rounded">shuffle</span></button>
          <button class="player-btn icon-only" id="player-prev" title="Предыдущий"><span class="material-symbols-rounded">skip_previous</span></button>
          <button class="player-btn play-btn icon-only" id="player-play" title="Воспроизвести"><span class="material-symbols-rounded">play_arrow</span></button>
          <button class="player-btn icon-only" id="player-next" title="Следующий"><span class="material-symbols-rounded">skip_next</span></button>
          <button class="player-btn icon-only" id="player-repeat" title="Повтор"><span class="material-symbols-rounded">repeat</span></button>
        </div>
        <div class="player-progress">
          <span class="player-time" id="player-current">0:00</span>
          <div class="progress-bar" id="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <span class="player-time" id="player-total">0:00</span>
        </div>
      </div>
      <div class="player-volume">
        <span class="volume-icon material-symbols-rounded">volume_up</span>
        <input type="range" class="volume-slider" id="volume-slider" min="0" max="1" step="0.02" value="${state.volume}">
      </div>
    `;

    ui = {
      cover:   document.getElementById('player-cover'),
      title:   document.getElementById('player-title'),
      artist:  document.getElementById('player-artist'),
      playBtn: document.getElementById('player-play'),
      fill:    document.getElementById('progress-fill'),
      current: document.getElementById('player-current'),
      total:   document.getElementById('player-total'),
      progBar: document.getElementById('progress-bar'),
      vol:     document.getElementById('volume-slider')
    };

    const btnPrev = document.getElementById('player-prev');
    const btnNext = document.getElementById('player-next');
    const btnShuffle = document.getElementById('player-shuffle');
    const btnRepeat = document.getElementById('player-repeat');
    if (ui.playBtn) ui.playBtn.addEventListener('click', togglePlay);
    if (btnPrev) btnPrev.addEventListener('click', prev);
    if (btnNext) btnNext.addEventListener('click', next);
    if (btnShuffle) btnShuffle.addEventListener('click', shuffle);
    if (btnRepeat) btnRepeat.addEventListener('click', toggleRepeat);


    ui.progBar.addEventListener('click', (e) => {
      const rect = ui.progBar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      if (audio) audio.currentTime = audio.duration * pct;
    });

    ui.vol.addEventListener('input', () => {
      state.volume = parseFloat(ui.vol.value);
      if (audio) audio.volume = state.volume;
      saveState();
    });


    if (state.queue.length > 0) {
      const track = state.queue[state.currentIndex || 0];
      if (track) updateTrackUI(track);
    }
    updatePlayBtn(state.playing);
  }

  function updateTrackUI(track) {
    if (!ui.title) return;
    ui.title.textContent  = track.title || 'Unknown';
    ui.artist.textContent = track.artist || '—';
    ui.cover.src          = track.cover || '';
    ui.cover.style.display = track.cover ? 'block' : 'none';
  }

  function updatePlayBtn(playing) {
    if (!ui.playBtn) return;
    ui.playBtn.innerHTML = `<span class="material-symbols-rounded">${playing ? 'pause' : 'play_arrow'}</span>`;
  }

  function play(track, queueTracks) {
    if (!audio) return;
    if (queueTracks) {
      state.queue = queueTracks;
      state.currentIndex = queueTracks.findIndex(t => t.id === track.id);
      if (state.currentIndex < 0) state.currentIndex = 0;
    }
    if (!state.queue.length) { state.queue = [track]; state.currentIndex = 0; }

    const current = state.queue[state.currentIndex];
    updateTrackUI(current);
    audio.src = current.audio;
    audio.play().catch(() => {});
    saveState();
  }

  function togglePlay() {
    if (!audio || !audio.src) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function stop(clearQueue = false) {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.src = '';
    state.playing = false;
    state.progress = 0;
    if (clearQueue) {
      state.queue = [];
      state.currentIndex = 0;
    }
    updatePlayBtn(false);
    saveState();
  }

  function prev() {
    if (!state.queue.length) return;
    state.currentIndex = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
    play(state.queue[state.currentIndex]);
  }

  function next() {
    if (!state.queue.length) return;
    if (state.repeat) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    state.currentIndex = (state.currentIndex + 1) % state.queue.length;
    play(state.queue[state.currentIndex]);
  }

  function shuffle() {
    for (let i = state.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
    }
    state.currentIndex = 0;
    showToast('Очередь перемешана', 'success', 1500);
    saveState();
  }

  function toggleRepeat() {
    state.repeat = !state.repeat;
    const btn = document.getElementById('player-repeat');
    if (btn) btn.style.color = state.repeat ? 'var(--rose)' : '';
    showToast(state.repeat ? 'Повтор включён' : 'Повтор выключен', 'success', 1500);
    saveState();
  }

  function requestAutoplay() {
    if (!audio) return;
    audio.play().then(() => {
      state.autoplayPending = false;
      saveState();
    }).catch(() => {
      state.autoplayPending = true;
      saveState();
    });
  }

  function bindAutoplayResume() {
    const resume = () => {
      if (!state.autoplayPending) return;
      requestAutoplay();
      if (!state.autoplayPending) {
        window.removeEventListener('click', resume, true);
        window.removeEventListener('keydown', resume, true);
      }
    };
    window.addEventListener('click', resume, true);
    window.addEventListener('keydown', resume, true);
  }

  function init() {
    initAudio();
    buildUI();

    if (state.queue.length > 0 && audio) {
      const track = state.queue[state.currentIndex || 0];
      if (track && track.audio && !audio.src.includes(track.audio)) {
        audio.src = track.audio;
        if (state.progress) audio.currentTime = state.progress;
      }
      if (ui.current && state.progress) ui.current.textContent = formatDuration(state.progress);
      if (state.playing) {
        requestAutoplay();
        bindAutoplayResume();
      }
    }
  }

  return { init, play, togglePlay, prev, next, stop };
})();





function renderHeader(activePage = '') {
  const user = Auth.getUser();
  const nav = [
    { href: '/index.html',    label: 'Главная',    key: 'index' },
    { href: '/favorite.html', label: '<span class="material-symbols-rounded">favorite</span> Избранное', key: 'favorite' },
    { href: '/playlist.html', label: 'Плейлисты',  key: 'playlist' },
    { href: '/stats.html',    label: 'Статистика',  key: 'stats' },
    { href: '/archive.html',  label: 'Архив',      key: 'archive' },
    { href: '/about.html',    label: 'О проекте',  key: 'about' },
  ];
  const navHTML = nav.map(n =>
    `<a href="${n.href}" class="nav-link ${activePage === n.key ? 'active' : ''}">${n.label}</a>`
  ).join('');

  const userHTML = user
    ? `<a href="/profile.html" class="header-user">
        <div class="avatar">${user.username[0].toUpperCase()}</div>
        <span>${user.username}</span>
       </a>`
    : `<a href="/auth.html" class="btn btn-secondary btn-sm">Войти</a>`;

  const header = document.getElementById('site-header');
  if (header) {
    header.innerHTML = `
      <a href="/index.html" class="header-logo">Zvooq</a>
      <button class="header-burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="header-menu">
        <span class="material-symbols-rounded">menu</span>
      </button>
      <div class="header-menu" id="header-menu">
        <nav class="header-nav">${navHTML}</nav>
        <div class="header-actions">${userHTML}</div>
      </div>
      <div class="header-scrim" data-action="menu-close" aria-hidden="true"></div>
    `;

    const burger = header.querySelector('.header-burger');
    const scrim = header.querySelector('.header-scrim');
    const closeMenu = () => {
      header.classList.remove('menu-open');
      document.body.classList.remove('menu-open');
      if (burger) burger.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      header.classList.add('menu-open');
      document.body.classList.add('menu-open');
      if (burger) burger.setAttribute('aria-expanded', 'true');
    };

    if (burger) {
      burger.addEventListener('click', () => {
        if (header.classList.contains('menu-open')) closeMenu();
        else openMenu();
      });
    }
    if (scrim) scrim.addEventListener('click', closeMenu);
    header.querySelectorAll('.header-nav a').forEach(link => link.addEventListener('click', closeMenu));

    if (!window.__zvooqHeaderEscBound) {
      window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const currentHeader = document.getElementById('site-header');
        if (!currentHeader) return;
        currentHeader.classList.remove('menu-open');
        document.body.classList.remove('menu-open');
        const currentBurger = currentHeader.querySelector('.header-burger');
        if (currentBurger) currentBurger.setAttribute('aria-expanded', 'false');
      });
      window.__zvooqHeaderEscBound = true;
    }
  }
}





async function toggleFavorite(trackId, btn) {
  const user = Auth.getUser();
  if (!user) { showToast('Войдите, чтобы добавлять в избранное', 'error'); return; }
  try {
    const result = await API.post(`/api/tracks/${trackId}/favorite`, { userId: user.id });
    const isFav = result.favorited;
    if (btn) {
      btn.classList.toggle('active', isFav);
      btn.title = isFav ? 'Убрать из избранного' : 'В избранное';
      const icon = btn.querySelector('.material-symbols-rounded');
      if (icon) icon.textContent = isFav ? 'favorite' : 'favorite_border';
    }

    const updatedUser = { ...user };
    if (!updatedUser.favoriteTracks) updatedUser.favoriteTracks = [];
    if (isFav) { if (!updatedUser.favoriteTracks.includes(trackId)) updatedUser.favoriteTracks.push(trackId); }
    else updatedUser.favoriteTracks = updatedUser.favoriteTracks.filter(id => id !== trackId);
    Auth.setUser(updatedUser);
    showToast(isFav ? 'Добавлено в избранное' : 'Убрано из избранного', 'success', 2000, isFav ? 'favorite' : 'favorite_border');
    return isFav;
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}





function buildCard(item, albumTracks, options = {}) {
  const { isAlbum = false, favTrackIds = [] } = options;
  const user = Auth.getUser();
  const isFav = user && favTrackIds.includes(item.id);
  const isOwner = user && item.ownerId && user.id == item.ownerId;
  const dur = isAlbum ? totalDuration(albumTracks) : (item.duration || 0);

  const tracksHTML = isAlbum && albumTracks.length > 0
    ? (() => {
        const showLimit = 3;
        const hasMore = albumTracks.length > showLimit;
        let expandedMap = {};
        try { expandedMap = JSON.parse(sessionStorage.getItem('zvooq_album_expand') || '{}'); } catch {}
        const isExpandedTracks = !!expandedMap[item.id];
        return `<div class="card-tracks ${isExpandedTracks ? 'expanded' : ''}" data-album-id="${item.id}" data-show-limit="${showLimit}">
          <div class="card-tracks-list">
            ${albumTracks.map((t, i) => {
              const isFavTrack = favTrackIds.includes(t.id);
              return `
              <div class="card-track-row" data-track-id="${t.id}">
                <span class="track-num">${i + 1}</span>
                <span class="track-name">${t.title}</span>
                <span class="track-dur">${formatDuration(t.duration)}</span>
                <button class="track-fav-mini icon-only ${isFavTrack ? 'active' : ''}" data-action="fav" data-id="${t.id}" title="${isFavTrack ? 'Убрать из избранного' : 'В избранное'}"><span class="material-symbols-rounded">${isFavTrack ? 'favorite' : 'favorite_border'}</span></button>
                <button class="track-play-mini icon-only" data-track='${JSON.stringify(t).replace(/'/g, "&#39;")}' title="Воспроизвести"><span class="material-symbols-rounded">play_arrow</span></button>
              </div>`;
            }).join('')}
          </div>
          ${hasMore ? `<button class="track-show-toggle" data-action="toggle-tracks" data-more="${albumTracks.length - showLimit}">
            <span class="material-symbols-rounded">${isExpandedTracks ? 'expand_less' : 'expand_more'}</span>
            ${isExpandedTracks ? 'Скрыть' : `Показать еще ${albumTracks.length - showLimit} треков`}
          </button>` : ''}
         </div>`;
      })()
    : '';

  const cardId = isAlbum ? `album-${item.id}` : `track-${item.id}`;

  return `
    <div class="music-card" id="${cardId}" data-id="${item.id}" data-type="${isAlbum ? 'album' : 'track'}">
      <div class="card-cover-wrap">
        <img class="card-cover" src="${item.cover || '/uploads/images/default.jpg'}" alt="${item.title}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'><rect fill=\\'%234D3C77\\'/></svg>'">
        <div class="card-cover-overlay"></div>
        ${isAlbum ? `<span class="card-badge">Альбом · ${albumTracks.length} тр.</span>` : ''}
        <button class="card-play-btn icon-only" data-action="play" data-id="${item.id}" data-type="${isAlbum ? 'album' : 'track'}" title="Воспроизвести"><span class="material-symbols-rounded">play_arrow</span></button>
      </div>
      <div class="card-body">
        <div class="card-genre">${item.genre || '—'}</div>
        <div class="card-title-row">
          <div class="card-title">${item.title}</div>
          ${!isAlbum ? `<button class="fav-btn ${isFav ? 'active' : ''} icon-only" data-action="fav" data-id="${item.id}" title="${isFav ? 'Убрать из избранного' : 'В избранное'}"><span class="material-symbols-rounded">${isFav ? 'favorite' : 'favorite_border'}</span></button>` : ''}
        </div>
        <div class="card-artist">${item.artist}</div>
        ${item.description ? `<div class="card-desc">${item.description}</div>` : ''}
        ${tracksHTML}
        <div class="card-meta">
          <span class="meta-item"><span class="icon material-symbols-rounded">schedule</span> ${formatDuration(dur)}</span>
          <span class="meta-item"><span class="icon material-symbols-rounded">event</span> ${formatDate(item.releaseDate)}</span>
          ${item.label ? `<span class="meta-item"><span class="icon material-symbols-rounded">label</span> ${item.label}</span>` : ''}
        </div>
        ${isOwner ? `<div class="card-actions">
          <button class="card-btn" data-action="edit" data-id="${item.id}" data-type="${isAlbum ? 'album' : 'track'}"><span class="material-symbols-rounded">edit</span> Изменить</button>
          <button class="card-btn danger" data-action="delete" data-id="${item.id}" data-type="${isAlbum ? 'album' : 'track'}"><span class="material-symbols-rounded">delete</span> Удалить</button>
        </div>` : ''}
      </div>
    </div>`;
}





document.addEventListener('DOMContentLoaded', () => {
  Player.init();
});
