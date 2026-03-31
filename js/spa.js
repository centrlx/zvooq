
(function () {
  window.__SPA__ = true;
  const logErr = (msg, err) => console.error('[SPA]', msg, err || '');

  
const log = () => {};
const spaPaths = new Set([
    '/index.html',
    '/playlist.html',
    '/favorite.html',
    '/stats.html',
    '/archive.html',
    '/about.html',
    '/profile.html'
  ]);

  const routeScripts = {
    '/index.html': '/js/index.js',
    '/playlist.html': '/js/playlist.js',
    '/favorite.html': '/js/favorite.js',
    '/stats.html': '/js/stats.js',
    '/archive.html': '/js/archive.js',
    '/about.html': '/js/about.js',
    '/profile.html': '/js/profile.js'
  };

  const routeInits = {
    '/index.html': 'index',
    '/playlist.html': 'playlist',
    '/favorite.html': 'favorite',
    '/stats.html': 'stats',
    '/archive.html': 'archive',
    '/about.html': 'about',
    '/profile.html': 'profile'
  };
  const routeInitFns = {
    '/index.html': 'initIndex',
    '/playlist.html': 'initPlaylist',
    '/favorite.html': 'initFavorite',
    '/stats.html': 'initStats',
    '/archive.html': 'initArchive',
    '/about.html': 'initAbout',
    '/profile.html': 'initProfile'
  };

  function normalizePath(path) {
    if (!path || path === '/') return '/index.html';
    return path;
  }

  function isSpaPath(path) {
    return spaPaths.has(normalizePath(path));
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-spa-src="${src}"]`);
      if (existing) {
        if (existing.dataset.spaLoaded === '1') { resolve(); return; }
        log('waiting existing script', src);
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      log('inject script', src);
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.spaSrc = src;
      s.onload = () => { s.dataset.spaLoaded = '1'; resolve(); };
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });
  }

  async function ensureRouteScript(path) {
    const src = routeScripts[normalizePath(path)];
    if (!src) return;
    await loadScriptOnce(src);
  }

  async function runRouteInit(path) {
    const key = routeInits[normalizePath(path)];
    const fnName = routeInitFns[normalizePath(path)];
    const inits = window.PageInits || {};
    const init = key ? inits[key] : null;
    log('init route', { path, key, fnName, hasPageInit: !!init });
    if (typeof init === 'function') {
      await init();
      return true;
    }
    if (fnName && typeof window[fnName] === 'function') {
      log('calling window init', fnName);
      await window[fnName]();
      return true;
    }
    return false;
  }

  async function runInitWithRetry(path, tries = 3) {
    for (let i = 0; i < tries; i++) {
      await new Promise(requestAnimationFrame);
      try {
        const ok = await runRouteInit(path);
        if (ok) return true;
      } catch (e) {
        logErr('route init error', e);
      }
      await new Promise(r => setTimeout(r, 50));
    }
    return false;
  }

  async function loadPage(url, push = false) {
    const u = new URL(url, location.origin);
    const path = normalizePath(u.pathname);
    if (!isSpaPath(path)) {
      if (push) window.location.href = u.pathname + u.search;
      return;
    }

    const currentMain = document.querySelector('main');
    if (currentMain) {
      currentMain.classList.add('is-fading');
      await new Promise(r => setTimeout(r, 200));
    }

    const res = await fetch(u.pathname + u.search, { headers: { 'X-SPA': '1' } });
    log('fetch', { url: u.pathname + u.search, status: res.status });
    if (!res.ok) {
      window.location.href = u.pathname + u.search;
      return;
    }
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newMain = doc.querySelector('main');
    const curMain = document.querySelector('main');
    if (!newMain || !curMain) {
      window.location.href = u.pathname + u.search;
      return;
    }

    document.title = doc.title || document.title;
    curMain.replaceWith(newMain);
    newMain.classList.add('is-fading');
    requestAnimationFrame(() => newMain.classList.remove('is-fading'));

    const key = routeInits[normalizePath(path)];
    if (typeof window.renderHeader === 'function' && key) {
      window.renderHeader(key);
    }

    await ensureRouteScript(path);
    log('script ensured for', path);
    const initOk = await runInitWithRetry(path, 5);
    if (!initOk) {
      logErr('route init failed', path);
    }

    if (push) history.pushState({}, '', u.pathname + u.search);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.dataset.noSpa) return;
    const url = new URL(a.href, location.origin);
    if (url.origin !== location.origin) return;
    const path = normalizePath(url.pathname);
    if (!isSpaPath(path)) return;
    e.preventDefault();
    log('nav click', url.pathname + url.search);
    loadPage(url.pathname + url.search, true);
  });

  window.addEventListener('popstate', () => {
    log('popstate', location.pathname + location.search);
    loadPage(location.pathname + location.search, false);
  });


  (async () => {
    const path = normalizePath(location.pathname);
    if (!isSpaPath(path)) return;
    log('bootstrap', path);
    await ensureRouteScript(path);
    const initOk = await runInitWithRetry(path, 5);
    if (!initOk) {
      logErr('bootstrap init failed', path);
    }
    const main = document.querySelector('main');
    if (main) {
      main.classList.add('is-fading');
      requestAnimationFrame(() => main.classList.remove('is-fading'));
    }
  })();
})();
