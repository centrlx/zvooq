

async function initProfile() {
  const logErr = (msg, err) => window.ZError?.('profile', msg, err);
  
const log = () => {};log('initProfile start');
  renderHeader('');
  const user = Auth.getUser();
  if (!user) { window.location.href = '/auth.html'; return; }

  try {
    const [allTracks, allPlaylists] = await Promise.all([
      API.get('/api/tracks'),
      API.get('/api/playlists')
    ]);
    log('data loaded', { tracks: allTracks.length, playlists: allPlaylists.length });

    const favCount  = (user.favoriteTracks || []).length;
    const myPls     = allPlaylists.filter(p => p.userId == user.id);
    const myTracks  = allTracks.filter(t => !t.albumId);

    document.getElementById('profile-content').innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar">${user.username[0].toUpperCase()}</div>
        <div>
          <div class="profile-name">${user.username}</div>
          <div class="profile-since">На Zvooq с ${formatDate(user.createdAt)}</div>
        </div>
        <div class="ml-auto">
          <button class="btn btn-danger btn-sm" id="logout-btn">Выйти</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${favCount}</div>
          <div class="stat-label">В избранном</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${allTracks.length}</div>
          <div class="stat-label">Всего треков</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${myPls.length}</div>
          <div class="stat-label">Плейлистов</div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2 class="section-title"><span class="dot"></span> Мои плейлисты</h2>
          <a href="/playlist.html" class="btn btn-outline btn-sm">Все плейлисты</a>
        </div>
        <div class="cards-grid">
          ${myPls.length ? myPls.map(pl => {
            const tracks = pl.tracks.map(id => allTracks.find(t => t.id == id)).filter(Boolean);
            const dur = totalDuration(tracks);
            return `<div class="playlist-card">
              <div class="playlist-title">${pl.title}</div>
              <div class="playlist-info">${tracks.length} треков · ${formatDuration(dur)}</div>
              <div class="card-actions mt-10">
                <a href="/playlist.html?id=${pl.id}" class="card-btn"><span class="material-symbols-rounded">play_arrow</span> Открыть</a>
              </div>
            </div>`;
          }).join('') : '<p class="text-muted text-sm">Плейлистов пока нет</p>'}
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2 class="section-title"><span class="dot"></span> Избранное</h2>
          <a href="/favorite.html" class="btn btn-outline btn-sm">Все избранные</a>
        </div>
        <div>
          ${(user.favoriteTracks || []).slice(0, 5).map(id => {
            const t = allTracks.find(tr => tr.id == id);
            if (!t) return '';
            return `<div class="track-list-item">
              <img class="track-list-cover" src="${t.cover||''}" alt="" onerror="this.style.display='none'">
              <div class="track-list-info">
                <div class="track-list-title">${t.title}</div>
                <div class="track-list-artist">${t.artist}</div>
              </div>
              <span class="track-list-badge"><span class="material-symbols-rounded">favorite</span></span>
            </div>`;
          }).join('') || '<p class="text-muted text-sm">Нет избранных треков</p>'}
        </div>
      </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', () => {
      log('logout click');
      Auth.logout();
    });

  } catch (e) {
    showToast('Ошибка загрузки профиля', 'error');
    logErr('initProfile error', e);
  }
}

window.PageInits = window.PageInits || {};
window.PageInits.profile = initProfile;
window.initProfile = initProfile;

if (!window.__SPA__) {
  document.addEventListener('DOMContentLoaded', initProfile);
}
