// about.js — About page
async function initAbout() {
  window.ZLog?.('about', 'initAbout');
  renderHeader('about');
}

window.PageInits = window.PageInits || {};
window.PageInits.about = initAbout;
window.initAbout = initAbout;

if (!window.__SPA__) {
  document.addEventListener('DOMContentLoaded', initAbout);
}
