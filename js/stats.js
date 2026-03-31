

async function initStats() {
  const logErr = () => {};
  
const log = () => {};log('initStats start');
  renderHeader('stats');
  try {
    const [statsData, tracks, albums, playlists] = await Promise.all([
      API.get('/api/stats'),
      API.get('/api/tracks'),
      API.get('/api/albums'),
      API.get('/api/playlists')
    ]);
    log('data loaded', { tracks: tracks.length, albums: albums.length, playlists: playlists.length });


    const genreCounts = {};
    tracks.forEach(t => {
      if (t.genre) genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
    });
    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxGenreCount = topGenres[0]?.[1] || 1;


    const weekDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = tracks.filter(t => t.releaseDate === dateStr).length;
      weekDays.push({ label: d.toLocaleDateString('ru-RU', { weekday: 'short' }), count });
    }
    const maxDayCount = Math.max(...weekDays.map(d => d.count), 1);

    const totalDur = tracks.reduce((s, t) => s + (t.duration || 0), 0);
    const avgDur   = tracks.length ? Math.round(totalDur / tracks.length) : 0;

    document.getElementById('stats-content').innerHTML = `
      <!-- KPI Cards -->
      <div class="stats-grid mb-32">
        <div class="stat-card">
          <div class="stat-value">${tracks.length}</div>
          <div class="stat-label">Всего треков</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${albums.length}</div>
          <div class="stat-label">Альбомов</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${playlists.length}</div>
          <div class="stat-label">Плейлистов</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${statsData.addedThisWeek}</div>
          <div class="stat-label">Добавлено за неделю</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatDuration(totalDur)}</div>
          <div class="stat-label">Общая длительность</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatDuration(avgDur)}</div>
          <div class="stat-label">Средняя длина трека</div>
        </div>
      </div>

      <div class="stats-two-col">
        <!-- Genre Chart -->
        <div class="about-card">
          <h3><span class="material-symbols-rounded">music_note</span> Жанры</h3>
          ${topGenres.length ? topGenres.map(([genre, count]) => `
            <div class="genre-row">
              <div class="genre-row-head">
                <span>${genre}</span><span>${count}</span>
              </div>
              <div class="genre-bar">
                <div class="genre-bar-fill" data-w="${(count/maxGenreCount*100).toFixed(1)}"></div>
              </div>
            </div>`).join('') : '<p class="text-muted">Нет данных</p>'}
        </div>

        <!-- Week activity -->
        <div class="about-card">
          <h3><span class="material-symbols-rounded">event</span> Активность за неделю</h3>
          <div class="week-chart">
            ${weekDays.map(d => `
              <div class="week-col">
                <div class="week-col-body">
                  <div class="week-bar" data-h="${d.count ? Math.max(8,(d.count/maxDayCount*90)).toFixed(0) : 4}" data-active="${d.count ? '1' : '0'}"></div>
                </div>
                <span class="text-2xs text-muted">${d.label}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Top tracks by favorites -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title"><span class="dot"></span> Топ треков по избранному</h2>
        </div>
        ${statsData.topTracks.length ? statsData.topTracks.map((t, i) => `
          <div class="track-list-item">
            <span class="rank-num">${i+1}</span>
            <img class="track-list-cover" src="${t.cover||''}" alt="" onerror="this.style.display='none'">
            <div class="track-list-info">
              <div class="track-list-title">${t.title}</div>
              <div class="track-list-artist">${t.artist}</div>
            </div>
            <span class="track-list-badge"><span class="material-symbols-rounded">favorite</span> ${t.favoriteTracks?.length || 0}</span>
          </div>`).join('') : '<p class="text-muted text-sm">Нет данных</p>'}
      </div>
    `;

    applyStatsBars();

  } catch (e) {
    showToast('Ошибка загрузки статистики', 'error');
    logErr('initStats error', e);
  }
}

function applyStatsBars() {
  document.querySelectorAll('.genre-bar-fill').forEach(el => {
    const w = el.dataset.w || '0';
    el.style.setProperty('--w', `${w}%`);
  });
  document.querySelectorAll('.week-bar').forEach(el => {
    const h = el.dataset.h || '4';
    const active = el.dataset.active === '1';
    el.style.setProperty('--h', `${h}px`);
    el.style.setProperty('--bar-bg', active ? 'linear-gradient(to top,var(--violet),var(--mauve))' : 'var(--surface2)');
  });
}

window.PageInits = window.PageInits || {};
window.PageInits.stats = initStats;
window.initStats = initStats;

if (!window.__SPA__) {
  document.addEventListener('DOMContentLoaded', initStats);
}
