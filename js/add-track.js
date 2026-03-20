/**
 * add-track.js — Logic for add-track.html
 * Handles audio upload, form build for track vs album, validation, submission
 */

let selectedFiles = [];
let isAlbum = false;
const fileDurations = new Map();
const log = (msg, data) => window.ZLog?.('add-track', msg, data);
const logErr = (msg, err) => window.ZError?.('add-track', msg, err);

function fileKey(f) {
  return `${f.name}_${f.size}_${f.lastModified}`;
}

function getAudioDuration(file) {
  log('getAudioDuration', { name: file.name, size: file.size });
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.preload = 'metadata';
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      const d = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(0);
    });
  });
}

async function ensureDurations(files) {
  log('ensureDurations start', { count: files.length });
  const results = [];
  for (const f of files) {
    const key = fileKey(f);
    if (fileDurations.has(key)) {
      results.push(fileDurations.get(key));
      continue;
    }
    const d = await getAudioDuration(f);
    fileDurations.set(key, d);
    results.push(d);
  }
  log('ensureDurations done', results);
  return results;
}

document.addEventListener('DOMContentLoaded', () => {
  log('DOMContentLoaded');
  renderHeader('');
  bindDropZone();
  bindCoverUpload();
  bindFormEvents();
  // Set today as default date
  document.getElementById('releaseDate').value = new Date().toISOString().split('T')[0];
});

// ── Drop Zone ────────────────────────────────────────────────

function bindDropZone() {
  log('bindDropZone');
  const zone  = document.getElementById('drop-zone');
  const input = document.getElementById('audio-files');

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    log('drop files', e.dataTransfer.files.length);
    addFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('audio/')));
  });
  input.addEventListener('change', () => addFiles([...input.files]));
}

function addFiles(files) {
  log('addFiles', { count: files.length });
  files.forEach(f => {
    if (!selectedFiles.find(x => x.name === f.name && x.size === f.size)) {
      selectedFiles.push(f);
    }
  });
  renderFileList();
}

function renderFileList() {
  log('renderFileList', { count: selectedFiles.length });
  const list = document.getElementById('file-list');
  const proceedBtn = document.getElementById('proceed-btn');
  list.innerHTML = selectedFiles.map((f, i) => `
    <div class="file-item">
      <span><span class="material-symbols-rounded">music_note</span> ${f.name}</span>
      <button class="remove-file icon-only" data-idx="${i}" aria-label="Удалить файл"><span class="material-symbols-rounded">close</span></button>
    </div>`).join('');

  list.querySelectorAll('.remove-file').forEach(btn => {
    btn.addEventListener('click', () => {
      log('remove file', { idx: btn.dataset.idx });
      const removed = selectedFiles.splice(parseInt(btn.dataset.idx), 1)[0];
      if (removed) fileDurations.delete(fileKey(removed));
      renderFileList();
    });
  });

  proceedBtn.disabled = selectedFiles.length === 0;
}

// ── Proceed to form ──────────────────────────────────────────

document.getElementById('proceed-btn').addEventListener('click', () => {
  isAlbum = selectedFiles.length > 1;
  log('proceed', { isAlbum, files: selectedFiles.length });
  buildForm();
  document.getElementById('step-upload').style.display = 'none';
  document.getElementById('track-form').style.display = 'block';
  document.getElementById('form-page-title').textContent = isAlbum ? 'Создать альбом' : 'Добавить трек';
  document.getElementById('form-title-text').textContent = isAlbum ? 'Информация об альбоме' : 'Информация о треке';
});

document.getElementById('back-btn').addEventListener('click', () => {
  log('back to upload step');
  document.getElementById('track-form').style.display = 'none';
  document.getElementById('step-upload').style.display = 'block';
});

function buildForm() {
  log('buildForm', { isAlbum, files: selectedFiles.length });
  const albumGroup  = document.getElementById('album-title-group');
  const singleGroup = document.getElementById('single-title-group');
  const multiGroup  = document.getElementById('multi-titles-group');

  if (isAlbum) {
    albumGroup.style.display  = 'block';
    singleGroup.style.display = 'none';
    multiGroup.style.display  = 'block';
    const genreOptions = document.getElementById('genre').innerHTML;
    multiGroup.innerHTML = `
      <label class="form-label" style="margin-bottom:10px;">Метаданные треков <span style="color:var(--rose)">*</span></label>
      ${selectedFiles.map((f, i) => `
        <div class="form-group" style="display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start;">
          <span class="track-num" style="flex-shrink:0;width:24px;text-align:center;color:var(--text3);line-height:40px;">${i+1}</span>
          <div style="display:grid;gap:8px;">
            <input type="text" class="form-input track-title-input" placeholder="Название трека ${i+1}" value="${f.name.replace(/\.[^.]+$/, '')}">
            <input type="text" class="form-input track-artist-input" placeholder="Артист(ы) (если пусто — как у альбома)">
            <select class="form-select track-genre-input">
              ${genreOptions}
            </select>
            <textarea class="form-textarea track-desc-input" placeholder="Описание трека (если пусто — как у альбома)"></textarea>
          </div>
        </div>`).join('')}`;
  } else {
    albumGroup.style.display  = 'none';
    singleGroup.style.display = 'block';
    multiGroup.style.display  = 'none';
    const titleInput = document.getElementById('single-title');
    if (selectedFiles[0]) {
      titleInput.value = selectedFiles[0].name.replace(/\.[^.]+$/, '');
    }
  }
}

// ── Cover Upload ─────────────────────────────────────────────

function bindCoverUpload() {
  log('bindCoverUpload');
  const coverInput   = document.getElementById('cover-file');
  const coverPreview = document.getElementById('cover-preview');
  const coverZone    = document.getElementById('cover-drop-zone');

  coverInput.addEventListener('change', () => {
    if (coverInput.files[0]) {
      log('cover selected', coverInput.files[0].name);
      const url = URL.createObjectURL(coverInput.files[0]);
      coverPreview.src = url;
      coverPreview.style.display = 'block';
    }
  });

  coverZone.addEventListener('dragover', e => { e.preventDefault(); coverZone.classList.add('drag-over'); });
  coverZone.addEventListener('dragleave', () => coverZone.classList.remove('drag-over'));
  coverZone.addEventListener('drop', e => {
    e.preventDefault();
    coverZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      log('cover dropped', file.name);
      // Manually set to input
      const dt = new DataTransfer();
      dt.items.add(file);
      coverInput.files = dt.files;
      coverPreview.src = URL.createObjectURL(file);
      coverPreview.style.display = 'block';
    }
  });
}

// ── Form events ──────────────────────────────────────────────

function bindFormEvents() {
  log('bindFormEvents');
  document.getElementById('track-form').addEventListener('submit', handleSubmit);
}

// ── Validation ───────────────────────────────────────────────

function validateForm() {
  log('validateForm');
  let valid = true;
  const errors = [];

  const clearErr = (id) => {
    const g = document.getElementById(id)?.closest('.form-group');
    if (g) g.classList.remove('has-error');
  };
  const setErr = (id, msg) => {
    const g = document.getElementById(id)?.closest('.form-group');
    if (g) { g.classList.add('has-error'); }
    errors.push(msg);
    valid = false;
  };

  // Clear all errors first
  ['err-albumTitle','err-title','err-artist','err-genre'].forEach(id => clearErr(id));

  if (isAlbum) {
    const albumTitle = document.getElementById('album-title').value.trim();
    if (!albumTitle) setErr('err-albumTitle', 'Введите название альбома');

    const trackTitles = [...document.querySelectorAll('.track-title-input')].map(i => i.value.trim());
    if (trackTitles.some(t => !t)) {
      errors.push('Введите названия всех треков');
      valid = false;
    }
  } else {
    const title = document.getElementById('single-title').value.trim();
    if (!title) setErr('err-title', 'Введите название трека');
  }

  const artist = document.getElementById('artist').value.trim();
  if (!artist) setErr('err-artist', 'Укажите артиста');

  const genre = document.getElementById('genre').value;
  if (!genre) setErr('err-genre', 'Выберите жанр');

  if (!valid) {
    alert('Заполните обязательные поля:\n• ' + errors.join('\n• '));
  }
  return valid;
}

// ── Submit ───────────────────────────────────────────────────

async function handleSubmit(e) {
  log('handleSubmit start');
  e.preventDefault();
  if (!validateForm()) return;

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="material-symbols-rounded">hourglass_top</span> Сохранение…';

  const formData = new FormData();

  // Audio files
  selectedFiles.forEach(f => formData.append('audio', f));

  // Cover
  const coverFile = document.getElementById('cover-file').files[0];
  if (coverFile) formData.append('cover', coverFile);

  const user = Auth.getUser();
  if (user?.id) formData.append('userId', user.id);

  // Fields
  formData.append('artist',      document.getElementById('artist').value.trim());
  formData.append('genre',       document.getElementById('genre').value);
  formData.append('description', document.getElementById('description').value.trim());
  formData.append('label',       document.getElementById('label').value.trim());
  formData.append('releaseDate', document.getElementById('releaseDate').value);

  if (isAlbum) {
    formData.append('albumTitle', document.getElementById('album-title').value.trim());
    const trackTitles = [...document.querySelectorAll('.track-title-input')].map(i => i.value.trim());
    trackTitles.forEach(t => formData.append('trackTitles', t));
    const trackArtists = [...document.querySelectorAll('.track-artist-input')].map(i => i.value.trim());
    const trackGenres = [...document.querySelectorAll('.track-genre-input')].map(i => i.value);
    const trackDescs = [...document.querySelectorAll('.track-desc-input')].map(i => i.value.trim());
    trackArtists.forEach(a => formData.append('trackArtists', a));
    trackGenres.forEach(g => formData.append('trackGenres', g));
    trackDescs.forEach(d => formData.append('trackDescriptions', d));
  } else {
    formData.append('title', document.getElementById('single-title').value.trim());
  }

  try {
    const durations = await ensureDurations(selectedFiles);
    log('durations ready', durations);
    if (isAlbum) {
      durations.forEach(d => formData.append('durations', d || 0));
    } else {
      formData.append('duration', durations[0] || 0);
    }
    await API.postForm('/api/tracks', formData);
    showToast(isAlbum ? 'Альбом добавлен ✓' : 'Трек добавлен ✓', 'success');
    setTimeout(() => window.location.href = '/index.html', 1000);
  } catch (err) {
    showToast('Ошибка при сохранении', 'error');
    logErr('handleSubmit error', err);
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="material-symbols-rounded">save</span> Сохранить';
  }
}
