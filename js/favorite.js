

let favTracks = [];
const logErr = (msg, err) => window.ZError?.('favorite', msg, err);


const log = () => {};async function initFavorite() {
  log('initFavorite start');
  renderHeader('favorite');
  const user = Auth.getUser();
  if (!user) {
    document.getElementById('fav-grid').innerHTML = `
      <div class="empty-state empty-state-full">
        <div class="empty-icon material-symbols-rounded">lock</div>
        <h3>Войдите в аккаунт</h3>
        <p>Чтобы видеть избранные треки</p>
        <a href="/auth.html" class="btn btn-primary mt-16">Войти</a>
      </div>`;
    document.getElementById('fav-subtitle').textContent = '';
    log('no user, show login state');
    return;
  }

  try {
    const allTracks = await API.get('/api/tracks');
    const favIds = user.favoriteTracks || [];
    favTracks = allTracks.filter(t => favIds.includes(t.id));
    renderFavorites();
    log('favorites loaded', { total: favTracks.length });
  } catch {
    showToast('Ошибка загрузки', 'error');
    logErr('initFavorite error', 'load failed');
  }
}

window.PageInits = window.PageInits || {};
window.PageInits.favorite = initFavorite;
window.initFavorite = initFavorite;

if (!window.__SPA__) {
  document.addEventListener('DOMContentLoaded', initFavorite);
}

function renderFavorites() {
  log('renderFavorites', { count: favTracks.length });
  const grid = document.getElementById('fav-grid');
  const sub  = document.getElementById('fav-subtitle');
  const user = Auth.getUser();
  const favIds = user?.favoriteTracks || [];

  sub.textContent = `${favTracks.length} ${plural(favTracks.length, 'трек', 'трека', 'треков')}`;

  if (!favTracks.length) {
    grid.innerHTML = `
      <div class="empty-state empty-state-full">
        <div class="empty-icon material-symbols-rounded">heart_broken</div>
        <h3>Здесь пока пусто</h3>
        <p>Ты вообще что-нибудь слушаешь?<br>Добавляй треки в избранное через <span class="material-symbols-rounded">favorite</span></p>
        <a href="/index.html" class="btn btn-primary mt-16">Перейти к музыке</a>
      </div>`;
    return;
  }

  grid.innerHTML = favTracks.map(t => {
    const card = buildCard(t, [], { favTrackIds: favIds });
    return card;
  }).join('');

  bindCardEvents();
}

function bindCardEvents() {
  document.getElementById('fav-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    const action = btn.dataset.action;
    log('card action', { action, id });

    if (action === 'play') {
      const track = favTracks.find(t => t.id == id);
      if (track) Player.play(track, favTracks);
      return;
    }

    if (action === 'fav') {

      await toggleFavorite(id, btn);

      const card = document.getElementById(`track-${id}`);
      if (card) {
        card.classList.add('is-removing');
        setTimeout(() => {
          favTracks = favTracks.filter(t => t.id !== id);
          card.remove();
          renderFavorites();
        }, 300);
      }
      return;
    }

    if (action === 'edit') {
      window.location.href = `/edit-track.html?id=${id}&type=track`;
      return;
    }

    if (action === 'delete') {
      if (!confirm('Удалить трек?')) return;
      try {
        await API.delete(`/api/tracks/${id}`);
        favTracks = favTracks.filter(t => t.id !== id);
        renderFavorites();
        showToast('Удалено', 'success');
      } catch (e) { showToast('Ошибка', 'error'); logErr('delete track error', e); }
    }
  });
}

function plural(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return few;
  return many;
}
