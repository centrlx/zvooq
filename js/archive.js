/**
 * archive.js — Archive page (deleted tracks & albums)
 */

async function initArchive() {
  const log = (msg, data) => window.ZLog?.('archive', msg, data);
  const logErr = (msg, err) => window.ZError?.('archive', msg, err);
  log('initArchive start');
  renderHeader('archive');
  try {
    const archive = await API.get('/api/archive');
    const container = document.getElementById('archive-content');
    log('archive loaded', { count: archive.length });

    if (!archive.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon material-symbols-rounded">archive</div>
          <h3>Архив пуст</h3>
          <p>Удалённые треки и альбомы появятся здесь</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <p class="text-muted text-xs mb-20">
        ${archive.length} удалённых элементов
      </p>
      ${archive.slice().reverse().map(item => `
        <div class="track-list-item">
          <img class="track-list-cover" src="${item.cover||''}" alt="" onerror="this.style.display='none'">
          <div class="track-list-info">
            <div class="track-list-title">${item.title}</div>
            <div class="track-list-artist">${item.artist} · ${item.genre || '—'}</div>
          </div>
          <div class="text-right no-shrink">
            <div class="text-xxs text-muted">${item.type === 'album' ? '<span class="material-symbols-rounded icon-sm">album</span> Альбом' : '<span class="material-symbols-rounded icon-sm">music_note</span> Трек'}</div>
            <div class="text-xxs text-muted mt-2">
              Удалён: ${formatDate(item.deletedAt)}
            </div>
          </div>
        </div>`).join('')}`;

  } catch {
    showToast('Ошибка загрузки архива', 'error');
    logErr('initArchive error', 'load failed');
  }
}

window.PageInits = window.PageInits || {};
window.PageInits.archive = initArchive;
window.initArchive = initArchive;

if (!window.__SPA__) {
  document.addEventListener('DOMContentLoaded', initArchive);
}
