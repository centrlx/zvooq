

document.addEventListener('DOMContentLoaded', () => {
  renderHeader('');


  if (Auth.isLoggedIn()) { log('already logged in → redirect'); window.location.href = '/index.html'; return; }

  document.getElementById('to-register').addEventListener('click', (e) => {
    e.preventDefault();
    log('switch to register');
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
  });
  document.getElementById('to-login').addEventListener('click', (e) => {
    e.preventDefault();
    log('switch to login');
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
  });

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('register-btn').addEventListener('click', handleRegister);


  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('reg-password2').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleRegister();
  });
});

async function handleLogin() {
  const logErr = () => {};
  
const log = () => {};log('handleLogin');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { alert('Введите имя пользователя и пароль'); return; }

  try {
    const result = await API.post('/api/auth/login', { username, password });
    Auth.setUser(result.user);
    showToast(`Добро пожаловать, ${result.user.username}!`, 'success', 3000, 'waving_hand');
    setTimeout(() => window.location.href = '/index.html', 800);
  } catch {
    showToast('Неверный логин или пароль', 'error');
    logErr('handleLogin error', 'login failed');
  }
}

async function handleRegister() {
  const logErr = () => {};
  log('handleRegister');
  const username  = document.getElementById('reg-username').value.trim();
  const password  = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;

  if (!username) { alert('Введите имя пользователя'); return; }
  if (password.length < 6) { alert('Пароль должен быть не менее 6 символов'); return; }
  if (password !== password2) { alert('Пароли не совпадают'); return; }

  try {
    const result = await API.post('/api/auth/register', { username, password });
    Auth.setUser(result.user);
    showToast('Аккаунт создан! Добро пожаловать', 'success', 3000, 'music_note');
    setTimeout(() => window.location.href = '/index.html', 800);
  } catch {
    showToast('Это имя пользователя уже занято', 'error');
    logErr('handleRegister error', 'register failed');
  }
}
