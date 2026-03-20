const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer storage config
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads/audio')),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads/images')),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const uploadAudio = multer({ storage: audioStorage });
const uploadImage = multer({ storage: imageStorage });
const uploadFields = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'cover') {
        cb(null, path.join(__dirname, 'uploads/images'));
      } else {
        cb(null, path.join(__dirname, 'uploads/audio'));
      }
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(file.originalname))
  })
});

// Helper: read/write JSON
const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', file), 'utf8'));
  } catch { return []; }
};
const writeJSON = (file, data) => {
  fs.writeFileSync(path.join(__dirname, 'data', file), JSON.stringify(data, null, 2));
};

const getUserById = (id) => {
  const users = readJSON('users.json');
  return users.find(u => u.id == id);
};

const isAdminUser = (id) => {
  const user = getUserById(id);
  return !!(user && (user.isAdmin === true || user.isAdmin === 1 || user.role === 'admin'));
};

const canEditPlaylist = (pl, userId) => {
  if (!pl || !userId) return false;
  return pl.userId == userId || isAdminUser(userId);
};

// ── TRACKS ──────────────────────────────────────────────────
app.get('/api/tracks', (req, res) => res.json(readJSON('tracks.json')));

app.post('/api/tracks', uploadFields.any(), (req, res) => {
  const ownerId = req.body.userId ? parseInt(req.body.userId) : null;
  if (!ownerId) return res.status(403).json({ error: 'Auth required' });
  const tracks = readJSON('tracks.json');
  const albums = readJSON('albums.json');
  const body = req.body;
  const files = Array.isArray(req.files) ? req.files : [];
  const audioFiles = files.filter(f => f.fieldname === 'audio');
  const coverFile = files.find(f => f.fieldname === 'cover') || null;
  const coverPath = coverFile ? `/uploads/images/${coverFile.filename}` : '/uploads/images/default.jpg';

  if (audioFiles.length === 1) {
    // Single track
    const newTrack = {
      id: Date.now(),
      title: body.title,
      artist: body.artist,
      genre: body.genre,
      description: body.description || '',
      label: body.label || '',
      releaseDate: body.releaseDate || new Date().toISOString().split('T')[0],
      duration: parseInt(body.duration) || 0,
      audio: `/uploads/audio/${audioFiles[0].filename}`,
      cover: coverPath,
      favoriteTracks: [],
      albumId: null,
      ownerId
    };
    tracks.push(newTrack);
    writeJSON('tracks.json', tracks);
    res.json({ success: true, type: 'track', data: newTrack });
  } else {
    // Album
    const albumId = Date.now();
    const albumDuration = (Array.isArray(body.durations) ? body.durations : [body.durations || 0])
      .map(d => parseInt(d) || 0)
      .reduce((s, d) => s + d, 0);
    const newAlbum = {
      id: albumId,
      title: body.albumTitle || body.title,
      artist: body.artist,
      genre: body.genre,
      description: body.description || '',
      label: body.label || '',
      releaseDate: body.releaseDate || new Date().toISOString().split('T')[0],
      cover: coverPath,
      duration: albumDuration,
      ownerId
    };
    albums.push(newAlbum);
    writeJSON('albums.json', albums);

    const titles = Array.isArray(body.trackTitles) ? body.trackTitles : [body.trackTitles];
    const trackArtists = Array.isArray(body.trackArtists) ? body.trackArtists : [body.trackArtists || ''];
    const trackGenres = Array.isArray(body.trackGenres) ? body.trackGenres : [body.trackGenres || ''];
    const trackDescriptions = Array.isArray(body.trackDescriptions) ? body.trackDescriptions : [body.trackDescriptions || ''];
    const durations = Array.isArray(body.durations) ? body.durations : [body.durations || 0];
    const newTracks = audioFiles.map((f, i) => ({
      id: Date.now() + i + 1,
      title: titles[i] || `Track ${i + 1}`,
      artist: trackArtists[i] || body.artist,
      genre: trackGenres[i] || body.genre,
      description: trackDescriptions[i] || body.description || '',
      label: body.label || '',
      releaseDate: body.releaseDate || new Date().toISOString().split('T')[0],
      duration: parseInt(durations[i]) || 0,
      audio: `/uploads/audio/${f.filename}`,
      cover: coverPath,
      favoriteTracks: [],
      albumId: albumId,
      ownerId
    }));
    newTracks.forEach(t => tracks.push(t));
    writeJSON('tracks.json', tracks);
    res.json({ success: true, type: 'album', data: newAlbum, tracks: newTracks });
  }
});

app.put('/api/tracks/:id', (req, res) => {
  const tracks = readJSON('tracks.json');
  const idx = tracks.findIndex(t => t.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tracks[idx] = { ...tracks[idx], ...req.body };
  writeJSON('tracks.json', tracks);
  res.json(tracks[idx]);
});

app.delete('/api/tracks/:id', (req, res) => {
  const tracks = readJSON('tracks.json');
  const archive = readJSON('archive.json');
  const idx = tracks.findIndex(t => t.id == req.params.id);
  if (idx !== -1) {
    archive.push({ ...tracks[idx], deletedAt: new Date().toISOString() });
    tracks.splice(idx, 1);
    writeJSON('tracks.json', tracks);
    writeJSON('archive.json', archive);
  }
  res.json({ success: true });
});

// Toggle favorite
app.post('/api/tracks/:id/favorite', (req, res) => {
  const tracks = readJSON('tracks.json');
  const users = readJSON('users.json');
  const { userId } = req.body;
  const track = tracks.find(t => t.id == req.params.id);
  if (!track) return res.status(404).json({ error: 'Not found' });
  if (!track.favoriteTracks) track.favoriteTracks = [];
  const fi = track.favoriteTracks.indexOf(userId);
  if (fi === -1) track.favoriteTracks.push(userId);
  else track.favoriteTracks.splice(fi, 1);
  writeJSON('tracks.json', tracks);

  // Update user favorites too
  const user = users.find(u => u.id == userId);
  if (user) {
    if (!user.favoriteTracks) user.favoriteTracks = [];
    const ui = user.favoriteTracks.indexOf(parseInt(req.params.id));
    if (ui === -1) user.favoriteTracks.push(parseInt(req.params.id));
    else user.favoriteTracks.splice(ui, 1);
    writeJSON('users.json', users);
  }
  res.json({ favorited: fi === -1, track });
});

// ── ALBUMS ──────────────────────────────────────────────────
app.get('/api/albums', (req, res) => res.json(readJSON('albums.json')));

app.put('/api/albums/:id', (req, res) => {
  const albums = readJSON('albums.json');
  const idx = albums.findIndex(a => a.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  albums[idx] = { ...albums[idx], ...req.body };
  writeJSON('albums.json', albums);
  res.json(albums[idx]);
});

app.delete('/api/albums/:id', (req, res) => {
  const albums = readJSON('albums.json');
  const tracks = readJSON('tracks.json');
  const archive = readJSON('archive.json');
  const idx = albums.findIndex(a => a.id == req.params.id);
  if (idx !== -1) {
    archive.push({ ...albums[idx], type: 'album', deletedAt: new Date().toISOString() });
    albums.splice(idx, 1);
    // Remove all tracks of this album
    const remaining = tracks.filter(t => t.albumId != req.params.id);
    writeJSON('tracks.json', remaining);
    writeJSON('albums.json', albums);
    writeJSON('archive.json', archive);
  }
  res.json({ success: true });
});

// ── PLAYLISTS ────────────────────────────────────────────────
app.get('/api/playlists', (req, res) => res.json(readJSON('playlists.json')));

app.post('/api/playlists', (req, res) => {
  const playlists = readJSON('playlists.json');
  const userId = req.body.userId ? parseInt(req.body.userId) : null;
  if (!userId) return res.status(403).json({ error: 'Auth required' });
  const pl = { id: Date.now(), title: req.body.title, userId, tracks: [], createdAt: new Date().toISOString().split('T')[0] };
  playlists.push(pl);
  writeJSON('playlists.json', playlists);
  res.json(pl);
});

app.put('/api/playlists/:id', (req, res) => {
  const playlists = readJSON('playlists.json');
  const idx = playlists.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const userId = req.body.userId ? parseInt(req.body.userId) : null;
  if (!canEditPlaylist(playlists[idx], userId)) return res.status(403).json({ error: 'Forbidden' });
  playlists[idx] = { ...playlists[idx], ...req.body };
  writeJSON('playlists.json', playlists);
  res.json(playlists[idx]);
});

app.delete('/api/playlists/:id', (req, res) => {
  const playlists = readJSON('playlists.json');
  const idx = playlists.findIndex(p => p.id == req.params.id);
  const userId = req.query.userId ? parseInt(req.query.userId) : null;
  if (idx !== -1) {
    if (!canEditPlaylist(playlists[idx], userId)) return res.status(403).json({ error: 'Forbidden' });
    playlists.splice(idx, 1);
  }
  writeJSON('playlists.json', playlists);
  res.json({ success: true });
});

app.post('/api/playlists/:id/tracks', (req, res) => {
  const playlists = readJSON('playlists.json');
  const pl = playlists.find(p => p.id == req.params.id);
  if (!pl) return res.status(404).json({ error: 'Not found' });
  const userId = req.body.userId ? parseInt(req.body.userId) : null;
  if (!canEditPlaylist(pl, userId)) return res.status(403).json({ error: 'Forbidden' });
  if (!pl.tracks.includes(req.body.trackId)) pl.tracks.push(req.body.trackId);
  writeJSON('playlists.json', playlists);
  res.json(pl);
});

app.delete('/api/playlists/:id/tracks/:trackId', (req, res) => {
  const playlists = readJSON('playlists.json');
  const pl = playlists.find(p => p.id == req.params.id);
  if (!pl) return res.status(404).json({ error: 'Not found' });
  const userId = req.query.userId ? parseInt(req.query.userId) : null;
  if (!canEditPlaylist(pl, userId)) return res.status(403).json({ error: 'Forbidden' });
  pl.tracks = pl.tracks.filter(t => t != req.params.trackId);
  writeJSON('playlists.json', playlists);
  res.json(pl);
});

// ── USERS / AUTH ─────────────────────────────────────────────
app.get('/api/users', (req, res) => res.json(readJSON('users.json').map(u => ({ ...u, password: undefined }))));

app.post('/api/auth/register', (req, res) => {
  const users = readJSON('users.json');
  if (users.find(u => u.username === req.body.username)) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  const user = { id: Date.now(), username: req.body.username, password: req.body.password, createdAt: new Date().toISOString().split('T')[0], favoriteTracks: [], playlists: [] };
  users.push(user);
  writeJSON('users.json', users);
  res.json({ success: true, user: { ...user, password: undefined } });
});

app.post('/api/auth/login', (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.username === req.body.username && u.password === req.body.password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

// ── STATS ────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const tracks = readJSON('tracks.json');
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const addedThisWeek = tracks.filter(t => new Date(t.releaseDate) >= weekAgo).length;
  const topTracks = [...tracks].sort((a, b) => (b.favoriteTracks?.length || 0) - (a.favoriteTracks?.length || 0)).slice(0, 5);
  res.json({ total: tracks.length, addedThisWeek, topTracks });
});

// ── ARCHIVE ──────────────────────────────────────────────────
app.get('/api/archive', (req, res) => res.json(readJSON('archive.json')));

// ── SERVE PAGES ──────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/*.html', (req, res) => {
  const file = path.join(__dirname, req.path);
  if (fs.existsSync(file)) res.sendFile(file);
  else res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Zvooq server running at http://localhost:${PORT}`));
