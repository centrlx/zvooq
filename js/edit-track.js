

document.addEventListener('DOMContentLoaded', async () => {
  const logErr = (msg, err) => window.ZError?.('edit-track', msg, err);
  
const log = () => {};log('DOMContentLoaded');
  renderHeader('');
  const params = new URLSearchParams(window.location.search);
  const id   = params.get('id');
  const type = params.get('type') || 'track';

  if (!id) { window.location.href = '/index.html'; return; }

  try {
    let item;
    if (type === 'album') {
      log('load album', { id });
      const albums = await API.get('/api/albums');
      item = albums.find(a => a.id == id);
      document.getElementById('edit-page-title').textContent = 'Редактировать альбом';
      document.getElementById('edit-form-title').textContent = 'Редактирование альбома';
      document.getElementById('album-title-group').style.display = 'block';
      document.getElementById('track-title-group').style.display = 'none';
    } else {
      log('load track', { id });
      const tracks = await API.get('/api/tracks');
      item = tracks.find(t => t.id == id);
    }

    if (!item) { showToast('Элемент не найден', 'error'); return; }


    if (type === 'album') {
      document.getElementById('edit-album-title').value = item.title || '';
    } else {
      document.getElementById('edit-title').value = item.title || '';
    }
    document.getElementById('edit-artist').value      = item.artist || '';
    document.getElementById('edit-genre').value       = item.genre || '';
    document.getElementById('edit-releaseDate').value = item.releaseDate || '';
    document.getElementById('edit-label').value       = item.label || '';
    document.getElementById('edit-description').value = item.description || '';

    const preview = document.getElementById('edit-cover-preview');
    if (item.cover) { preview.src = item.cover; preview.style.display = 'block'; }
    else preview.style.display = 'none';

    document.getElementById('edit-loading').style.display = 'none';
    document.getElementById('edit-form').style.display = 'block';

    document.getElementById('edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      log('submit edit', { id, type });

      const titleVal = type === 'album'
        ? document.getElementById('edit-album-title').value.trim()
        : document.getElementById('edit-title').value.trim();
      const artist = document.getElementById('edit-artist').value.trim();
      const genre  = document.getElementById('edit-genre').value;

      if (!titleVal || !artist || !genre) {
        alert('Заполните обязательные поля: название, артист, жанр');
        return;
      }

      const body = {
        title: titleVal,
        artist,
        genre,
        releaseDate: document.getElementById('edit-releaseDate').value,
        label:       document.getElementById('edit-label').value.trim(),
        description: document.getElementById('edit-description').value.trim()
      };

      const url = type === 'album' ? `/api/albums/${id}` : `/api/tracks/${id}`;
      try {
        await API.put(url, body);
        showToast('Изменения сохранены ✓', 'success');
        setTimeout(() => window.location.href = '/index.html', 800);
      } catch (err) { showToast('Ошибка сохранения', 'error'); logErr('save error', err); }
    });

  } catch (err) {
    showToast('Ошибка загрузки', 'error');
    logErr('load error', err);
  }
});
