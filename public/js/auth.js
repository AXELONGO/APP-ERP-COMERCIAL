import { fetchConfig } from './config.js';

export async function initAuth() {
  const token = localStorage.getItem('erp_jwt_token');
  const user = JSON.parse(localStorage.getItem('erp_user') || 'null');

  if (token && user) {
    // Ya está autenticado, ocultamos login y mostramos app
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    document.getElementById('user-name-display').textContent = user.name;
    document.getElementById('user-role-display').textContent = user.role;
    const avatarEl = document.getElementById('user-avatar-text');
    if (avatarEl && user.name) {
      avatarEl.textContent = user.name.substring(0, 2).toUpperCase();
    }
    // Inicializar la app original
    initLegacyApp();
  } else {
    // No está autenticado, mostramos login
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
    
    // Cargar config visual (marca blanca)
    const config = await fetchConfig();
    document.getElementById('login-logo').src = config.appLogo;
    document.getElementById('login-title').textContent = `Bienvenido a ${config.appName}`;

    // Inicializar Google Sign-In
    if (config.googleClientId) {
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: handleGoogleResponse
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        { theme: "outline", size: "large", width: 300 }
      );
    } else {
      console.warn("GOOGLE_CLIENT_ID no está definido en window.");
    }
  }
}

async function handleGoogleResponse(response) {
  const idToken = response.credential;
  try {
    const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
    const res = await fetch(`${API}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: idToken })
    });
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('erp_jwt_token', data.token);
      localStorage.setItem('erp_user', JSON.stringify(data.user));
      window.location.reload();
    } else {
      alert("Error de autenticación: " + (data.error || "No autorizado"));
    }
  } catch (error) {
    console.error('Login error', error);
    alert("Ocurrió un error al iniciar sesión.");
  }
}

window.logout = function() {
  localStorage.removeItem('erp_jwt_token');
  localStorage.removeItem('erp_user');
  window.location.reload();
};

window.loginWithEmail = async function() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
    const res = await fetch(`${API}/api/auth/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('erp_jwt_token', data.token);
      localStorage.setItem('erp_user', JSON.stringify(data.user));
      window.location.reload();
    } else {
      alert("Error: " + (data.error || "No autorizado"));
    }
  } catch (error) {
    console.error('Login error', error);
    alert("Ocurrió un error al iniciar sesión.");
  }
};
