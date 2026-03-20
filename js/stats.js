/**
 * stats.js — Statistics page
 */

async function initStats() {
  const log = (msg, data) => window.ZLog?.('stats', msg, data);
  const logErr = (msg, err) => window.ZError?.('stats', msg, err);
  log('initStats start');
  renderHeader('stats');
  try {
    const [statsData, tracks, albums, playlists] = await Promise.all([
      API.get('/api/stats'),
      API.get('/api/tracks'),
      API.get('/api/albums'),
      API.get('/api/playlists')
    ]);
    log('data loaded', { tracks: tracks.length, albums: albums.length, playlists: playlists.length });

    // Genre distribution
    const genreCounts = {};
    tracks.forEach(t => {
      if (t.genre) genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
    });
    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxGenreCount = topGenres[0]?.[1] || 1;

    // Week breakdown (last 7 days)
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
      <div class="stats-grid" style="margin-bottom:32px;">
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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
        <!-- Genre Chart -->
        <div class="about-card">
          <h3><span class="material-symbols-rounded">music_note</span> Жанры</h3>
          ${topGenres.length ? topGenres.map(([genre, count]) => `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text2);margin-bottom:4px;">
                <span>${genre}</span><span>${count}</span>
              </div>
              <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${(count/maxGenreCount*100).toFixed(1)}%;background:linear-gradient(90deg,var(--mauve),var(--rose));border-radius:3px;transition:width 0.6s;"></div>
              </div>
            </div>`).join('') : '<p style="color:var(--text3)">Нет данных</p>'}
        </div>

        <!-- Week activity -->
        <div class="about-card">
          <h3><span class="material-symbols-rounded">event</span> Активность за неделю</h3>
          <div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding-top:10px;">
            ${weekDays.map(d => `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
                <div style="flex:1;width:100%;display:flex;align-items:flex-end;">
                  <div style="width:100%;height:${d.count ? Math.max(8,(d.count/maxDayCount*90)).toFixed(0) : 4}px;background:${d.count ? 'linear-gradient(to top,var(--violet),var(--mauve))' : 'var(--surface2)'};border-radius:3px 3px 0 0;transition:height 0.5s;"></div>
                </div>
                <span style="font-size:10px;color:var(--text3);">${d.label}</span>
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
            <span style="font-family:'Syne',sans-serif;font-weight:800;font-size:18px;color:var(--mauve);width:28px;text-align:center;flex-shrink:0;">${i+1}</span>
            <img class="track-list-cover" src="${t.cover||''}" alt="" onerror="this.style.display='none'">
            <div class="track-list-info">
              <div class="track-list-title">${t.title}</div>
              <div class="track-list-artist">${t.artist}</div>
            </div>
            <span class="track-list-badge"><span class="material-symbols-rounded">favorite</span> ${t.favoriteTracks?.length || 0}</span>
          </div>`).join('') : '<p style="color:var(--text3);font-size:14px;">Нет данных</p>'}
      </div>
    `;

  } catch (e) {
    showToast('Ошибка загрузки статистики', 'error');
    logErr('initStats error', e);
  }
}

window.PageInits = window.PageInits || {};
window.PageInits.stats = initStats;
window.initStats = initStats;

if (!window.__SPA__) {
  document.addEventListener('DOMContentLoaded', initStats);
}
