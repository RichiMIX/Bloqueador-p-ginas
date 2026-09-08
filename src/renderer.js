const views = {
  setup: document.getElementById('view-setup'),
  login: document.getElementById('view-login'),
  dashboard: document.getElementById('view-dashboard')
};

function showView(name) {
  Object.values(views).forEach((v) => v.classList.remove('active'));
  views[name].classList.add('active');
}

async function init() {
  const state = await window.bloqueador.getState();
  if (!state.setupComplete) {
    showView('setup');
  } else {
    showView('login');
  }
}

// ---- Setup ----
document.getElementById('setup-submit').addEventListener('click', async () => {
  const pass = document.getElementById('setup-password').value;
  const confirm = document.getElementById('setup-password-confirm').value;
  const errorEl = document.getElementById('setup-error');
  errorEl.textContent = '';

  if (pass !== confirm) {
    errorEl.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  const useDefaultAdultList = document.getElementById('setup-default-list').checked;
  const result = await window.bloqueador.completeSetup({ password: pass, useDefaultAdultList });
  if (!result.ok) {
    errorEl.textContent = result.error;
    return;
  }
  await enterDashboard();
});

// ---- Login ----
document.getElementById('login-submit').addEventListener('click', async () => {
  const pass = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  const ok = await window.bloqueador.verifyPassword(pass);
  if (!ok) {
    errorEl.textContent = 'Contraseña incorrecta.';
    return;
  }
  document.getElementById('login-password').value = '';
  await enterDashboard();
});

// ---- Dashboard ----
async function enterDashboard() {
  const state = await window.bloqueador.getState();
  document.getElementById('toggle-default-list').checked = state.useDefaultAdultList;
  document.getElementById('toggle-autostart').checked = state.autostart;
  renderSiteList(state.customSites);
  showView('dashboard');
}

function renderSiteList(sites) {
  const list = document.getElementById('site-list');
  list.innerHTML = '';
  if (!sites || sites.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No hay sitios añadidos manualmente.';
    list.appendChild(li);
    return;
  }
  sites.forEach((domain) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = domain;
    const btn = document.createElement('button');
    btn.textContent = 'Quitar';
    btn.addEventListener('click', async () => {
      const result = await window.bloqueador.removeSite(domain);
      if (result.ok) renderSiteList(result.customSites);
    });
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

document.getElementById('add-site-btn').addEventListener('click', async () => {
  const input = document.getElementById('new-site');
  const errorEl = document.getElementById('dashboard-error');
  errorEl.textContent = '';
  const domain = input.value.trim();
  if (!domain) return;
  const result = await window.bloqueador.addSite(domain);
  if (!result.ok) {
    errorEl.textContent = result.error;
    return;
  }
  input.value = '';
  renderSiteList(result.customSites);
});

document.getElementById('toggle-default-list').addEventListener('change', async (e) => {
  await window.bloqueador.toggleDefaultList(e.target.checked);
});

document.getElementById('toggle-autostart').addEventListener('change', async (e) => {
  await window.bloqueador.setAutostart(e.target.checked);
});

document.getElementById('change-password-btn').addEventListener('click', async () => {
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const msgEl = document.getElementById('password-change-msg');
  msgEl.textContent = '';

  const result = await window.bloqueador.changePassword({ currentPassword, newPassword });
  if (!result.ok) {
    msgEl.textContent = result.error;
    return;
  }
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  msgEl.style.color = '#2fbf71';
  msgEl.textContent = 'Contraseña actualizada correctamente.';
});

init();
