import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, collection,
  query, where, orderBy, onSnapshot, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const splash = document.getElementById('splash');
const appDiv = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
const loginError = document.getElementById('login-error');
const userInfo = document.getElementById('user-info');
const mainContent = document.getElementById('main-content');
const navBtns = document.querySelectorAll('.nav-btn');

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = await loadUserProfile(user);
    showApp();
  } else {
    showLogin();
  }
});

function showApp() {
  splash.classList.add('hidden');
  loginScreen.classList.add('hidden');
  appDiv.classList.remove('hidden');
  userInfo.textContent = currentUser?.username || '';
  navigateTo('inicio');
}

function showLogin() {
  splash.classList.add('hidden');
  appDiv.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('tab-login').classList.toggle('hidden', target !== 'login');
    document.getElementById('tab-register').classList.toggle('hidden', target !== 'register');
    hideError();
  });
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  if (!username || !password) return showError('Completa todos los campos');
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  hideError();
  try {
    const email = ${username}@estiria.app;
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showError('Usuario o contraseña incorrectos');
    btn.disabled = false;
    btn.textContent = 'Entrar a Estiria';
  }
});

document.getElementById('register-btn').addEventListener('click', async () => {
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const whatsapp = document.getElementById('reg-whatsapp').value.trim();

  if (!username || !password) return showError('Usuario y contraseña son obligatorios');
  if (username.length < 3) return showError('El usuario debe tener al menos 3 caracteres');
  if (password.length < 6) return showError('La contraseña debe tener al menos 6 caracteres');
  if (password !== password2) return showError('Las contraseñas no coinciden');
  if (!/^[a-z0-9_]+$/.test(username)) return showError('Solo letras, números y guión bajo');

  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.textContent = 'Creando cuenta...';
  hideError();

  try {
    const usernameRef = doc(db, 'usernames', username);
    const usernameSnap = await getDoc(usernameRef);
    if (usernameSnap.exists()) {
      showError('Ese nombre de usuario ya está ocupado');
      btn.disabled = false;
      btn.textContent = 'Crear cuenta';
      return;
    }
    const email = ${username}@estiria.app;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      uid: cred.user.uid,
      username,
      whatsapp: whatsapp || '',
      rol: 'jugador',
      ciudad: '',
      creadoEn: new Date().toISOString(),
      saldo: 0
    });
    await setDoc(usernameRef, { uid: cred.user.uid });
  } catch (err) {
    showError('Error al crear cuenta: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Crear cuenta';
  }
});

async function loadUserProfile(user) {
  const ref = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return { uid: user.uid, username: user.email?.split('@')[0], rol: 'jugador', saldo: 0 };
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    navigateTo(btn.dataset.section);
  });
});

function navigateTo(section) {
  document.getElementById('header-title').textContent =
    section.charAt(0).toUpperCase() + section.slice(1);
  switch (section) {
    case 'inicio':     renderInicio(); break;
    case 'banco':      renderBanco(); break;
    case 'biblioteca': renderBiblioteca(); break;
    case 'perfil':     renderPerfil(); break;
  }
}

function renderInicio() {
  mainContent.innerHTML = `
    <div class="welcome-banner">
      <h2>⚔️ Bienvenido a Estiria</h2>
      <p>${currentUser?.username || 'Ciudadano'}</p>
    </div>
    <div class="card">
      <h3>📢 Anuncios</h3>
      <p>Próximamente...</p>
    </div>
    <div class="card">
      <h3>📅 Eventos</h3>
      <p>Próximamente...</p>
    </div>
    ${currentUser?.rol === 'dev' ? `
    <div class="card" style="border-color: var(--accent)">
      <h3>🛡️ Panel Admin</h3>
      <p>Acceso de desarrollador.</p>
    </div>` : ''}
  `;
}

function renderBiblioteca() {
  mainContent.innerHTML = `
    <div class="card">
      <h3>📚 Biblioteca</h3>
      <p>Próximamente...</p>
    </div>
  `;
}
function renderBanco() {
  const esDev = currentUser?.rol === 'dev';
  const esAdminBanco = currentUser?.rol === 'admin_banco' || esDev;

  mainContent.innerHTML = `
    <div class="banco-saldo card">
      <p class="saldo-label">Saldo disponible</p>
      <h2 class="saldo-monto">💷 <span id="saldo-valor">Cargando...</span></h2>
      <p class="saldo-ciudad">${currentUser?.ciudad || 'Sin ciudad asignada'}</p>
    </div>

    <div class="banco-acciones">
      <button class="btn-banco" id="btn-transferir">
        <span>💸</span><span>Transferir</span>
      </button>
      <button class="btn-banco" id="btn-movimientos">
        <span>📋</span><span>Movimientos</span>
      </button>
      <button class="btn-banco" id="btn-impuestos">
        <span>📜</span><span>Impuestos</span>
      </button>
      <button class="btn-banco" id="btn-reporte">
        <span>🚨</span><span>Reportar</span>
      </button>
    </div>

    <div id="banco-panel" class="card"></div>

    ${esAdminBanco ? `
    <div class="card" style="border-color: var(--accent); margin-top: 1rem;">
      <h3>🏦 Panel Banco Admin</h3>
      <button class="btn btn-primary btn-full" id="btn-admin-saldo">
        Editar saldo de usuario
      </button>
    </div>` : ''}
  `;

  cargarSaldo();

  document.getElementById('btn-transferir').addEventListener('click', mostrarTransferencia);
  document.getElementById('btn-movimientos').addEventListener('click', mostrarMovimientos);
  document.getElementById('btn-impuestos').addEventListener('click', mostrarImpuestos);
  document.getElementById('btn-reporte').addEventListener('click', mostrarReporte);

  if (esAdminBanco) {
    document.getElementById('btn-admin-saldo').addEventListener('click', mostrarEditarSaldo);
  }
}

async function cargarSaldo() {
  const ref = doc(db, 'usuarios', currentUser.uid);
  onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      currentUser.saldo = data.saldo;
      const el = document.getElementById('saldo-valor');
      if (el) el.textContent = ${data.saldo.toLocaleString('es-CO')} £;
    }
  });
}

function mostrarTransferencia() {
  const panel = document.getElementById('banco-panel');
  panel.innerHTML = `
    <h3>💸 Transferir dinero</h3>
    <input type="text" id="transfer-usuario" placeholder="Usuario destino" />
    <input type="number" id="transfer-monto" placeholder="Monto en £" min="1" />
    <textarea id="transfer-desc" placeholder="Descripción (obligatoria) — ej: Compra de espada"></textarea>
    <button class="btn btn-primary btn-full" id="confirmar-transfer">Confirmar transferencia</button>
    <div id="transfer-error" class="hidden" style="color: var(--danger); margin-top: 0.5rem;"></div>
  `;
  document.getElementById('confirmar-transfer').addEventListener('click', ejecutarTransferencia);
}

async function ejecutarTransferencia() {
  const usuarioDestino = document.getElementById('transfer-usuario').value.trim().toLowerCase();
  const monto = parseInt(document.getElementById('transfer-monto').value);
  const descripcion = document.getElementById('transfer-desc').value.trim();
  const errorEl = document.getElementById('transfer-error');

  const mostrarErrorTransfer = (msg) => {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  };

  if (!usuarioDestino) return mostrarErrorTransfer('Ingresa el usuario destino');
  if (!monto || monto <= 0) return mostrarErrorTransfer('Ingresa un monto válido');
  if (!descripcion) return mostrarErrorTransfer('La descripción es obligatoria');
  if (usuarioDestino === currentUser.username) return mostrarErrorTransfer('No puedes transferirte a ti mismo');
  if (monto > currentUser.saldo) return mostrarErrorTransfer('Saldo insuficiente');

  const btn = document.getElementById('confirmar-transfer');
  btn.disabled = true;
  btn.textContent = 'Procesando...';

  try {
    const usernameRef = doc(db, 'usernames', usuarioDestino);
    const usernameSnap = await getDoc(usernameRef);
    if (!usernameSnap.exists()) {
      mostrarErrorTransfer('Usuario no encontrado');
      btn.disabled = false;
      btn.textContent = 'Confirmar transferencia';
      return;
    }

    const uidDestino = usernameSnap.data().uid;

    await addDoc(collection(db, 'transacciones'), {
      tipo: 'transferencia',
      de: currentUser.uid,
      deUsername: currentUser.username,
      para: uidDestino,
      paraUsername: usuarioDestino,
      monto,
      descripcion,
      fecha: new Date().toISOString(),
      estado: 'completada'
    });

    await updateDoc(doc(db, 'usuarios', currentUser.uid), {
      saldo: increment(-monto)
    });
    await updateDoc(doc(db, 'usuarios', uidDestino), {
      saldo: increment(monto)
    });

    const panel = document.getElementById('banco-panel');
    panel.innerHTML = `
      <div style="text-align:center; padding: 1rem;">
        <p style="font-size: 2rem;">✅</p>
        <p>Transferencia exitosa</p>
        <p style="color: var(--text-secondary);">Se enviaron £${monto.toLocaleString('es-CO')} a ${usuarioDestino}</p>
      </div>
    `;
  } catch (err) {
    mostrarErrorTransfer('Error al transferir: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Confirmar transferencia';
  }
}
function mostrarMovimientos() {
  const panel = document.getElementById('banco-panel');
  panel.innerHTML = <h3>📋 Movimientos</h3><div id="lista-movimientos"><p style="color:var(--text-secondary)">Cargando...</p></div>;

  const q = query(
    collection(db, 'transacciones'),
    where('de', '==', currentUser.uid),
    orderBy('fecha', 'desc')
  );
  const q2 = query(
    collection(db, 'transacciones'),
    where('para', '==', currentUser.uid),
    orderBy('fecha', 'desc')
  );

  let movimientos = [];

  onSnapshot(q, (snap) => {
    snap.docs.forEach(d => {
      const data = d.data();
      if (!movimientos.find(m => m.id === d.id)) {
        movimientos.push({ id: d.id, ...data });
      }
    });
    renderMovimientos(movimientos);
  });

  onSnapshot(q2, (snap) => {
    snap.docs.forEach(d => {
      const data = d.data();
      if (!movimientos.find(m => m.id === d.id)) {
        movimientos.push({ id: d.id, ...data });
      }
    });
    renderMovimientos(movimientos);
  });
}

function renderMovimientos(movimientos) {
  const lista = document.getElementById('lista-movimientos');
  if (!lista) return;

  if (movimientos.length === 0) {
    lista.innerHTML = <p style="color:var(--text-secondary)">Sin movimientos aún</p>;
    return;
  }

  movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  lista.innerHTML = movimientos.map(m => {
    const esEnvio = m.de === currentUser.uid;
    const fecha = new Date(m.fecha).toLocaleString('es-CO');
    const signo = esEnvio ? '-' : '+';
    const color = esEnvio ? 'var(--danger)' : 'var(--success)';
    const contraparte = esEnvio ? → ${m.paraUsername} : ← ${m.deUsername};
    return `
      <div class="movimiento-item">
        <div class="movimiento-info">
          <p class="movimiento-desc">${m.descripcion}</p>
          <p class="movimiento-meta">${contraparte} · ${fecha}</p>
        </div>
        <p class="movimiento-monto" style="color:${color}">${signo}£${m.monto.toLocaleString('es-CO')}</p>
      </div>
    `;
  }).join('');
}

function mostrarImpuestos() {
  const panel = document.getElementById('banco-panel');
  panel.innerHTML = `
    <h3>📜 Impuestos</h3>
    <div id="lista-impuestos"><p style="color:var(--text-secondary)">Cargando...</p></div>
  `;

  const q = query(
    collection(db, 'impuestos'),
    where('uid', '==', currentUser.uid),
    orderBy('fecha', 'desc')
  );

  onSnapshot(q, (snap) => {
    const lista = document.getElementById('lista-impuestos');
    if (!lista) return;
    if (snap.empty) {
      lista.innerHTML = <p style="color:var(--success)">Sin impuestos pendientes ✅</p>;
      return;
    }
    lista.innerHTML = snap.docs.map(d => {
      const m = d.data();
      const fecha = new Date(m.fecha).toLocaleString('es-CO');
      const pagado = m.pagado;
      return `
        <div class="movimiento-item">
          <div class="movimiento-info">
            <p class="movimiento-desc">${m.concepto}</p>
            <p class="movimiento-meta">${fecha}</p>
          </div>
          <div style="text-align:right">
            <p class="movimiento-monto" style="color:var(--danger)">£${m.monto.toLocaleString('es-CO')}</p>
            ${!pagado ? <button class="btn btn-primary" style="font-size:0.75rem; padding:0.3rem 0.6rem; margin-top:0.3rem" data-id="${d.id}" data-monto="${m.monto}">Pagar</button> : <p style="color:var(--success); font-size:0.8rem">Pagado ✅</p>}
          </div>
        </div>
      `;
    }).join('');

    lista.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const monto = parseInt(btn.dataset.monto);
        if (monto > currentUser.saldo) {
          alert('Saldo insuficiente para pagar este impuesto');
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Pagando...';
        await updateDoc(doc(db, 'impuestos', id), { pagado: true });
        await updateDoc(doc(db, 'usuarios', currentUser.uid), { saldo: increment(-monto) });
        await addDoc(collection(db, 'transacciones'), {
          tipo: 'impuesto',
          de: currentUser.uid,
          deUsername: currentUser.username,
          para: 'sistema',
          paraUsername: 'Estiria',
          monto,
          descripcion: 'Pago de impuesto',
          fecha: new Date().toISOString(),
          estado: 'completada'
        });
      });
    });
  });
}

function mostrarReporte() {
  const panel = document.getElementById('banco-panel');
  panel.innerHTML = `
    <h3>🚨 Reportar problema</h3>
    <input type="text" id="reporte-asunto" placeholder="Asunto del reporte" />
    <textarea id="reporte-desc" placeholder="Describe el problema con detalle..."></textarea>
    <button class="btn btn-primary btn-full" id="enviar-reporte">Enviar reporte</button>
    <div id="reporte-error" class="hidden" style="color:var(--danger); margin-top:0.5rem"></div>
  `;

  document.getElementById('enviar-reporte').addEventListener('click', async () => {
    const asunto = document.getElementById('reporte-asunto').value.trim();
    const descripcion = document.getElementById('reporte-desc').value.trim();
    const errorEl = document.getElementById('reporte-error');

    if (!asunto || !descripcion) {
      errorEl.textContent = 'Completa todos los campos';
      errorEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('enviar-reporte');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    await addDoc(collection(db, 'reportes'), {
      uid: currentUser.uid,
      username: currentUser.username,
      asunto,
      descripcion,
      fecha: new Date().toISOString(),
      estado: 'pendiente'
    });

    panel.innerHTML = `
      <div style="text-align:center; padding:1rem">
        <p style="font-size:2rem">✅</p>
        <p>Reporte enviado</p>
        <p style="color:var(--text-secondary)">Un administrador lo revisará pronto</p>
      </div>
    `;
  });
}

async function mostrarEditarSaldo() {
  const panel = document.getElementById('banco-panel');
  panel.innerHTML = `
    <h3>✏️ Editar saldo de usuario</h3>
    <input type="text" id="admin-usuario" placeholder="Nombre de usuario" />
    <input type="number" id="admin-saldo" placeholder="Nuevo saldo en £" min="0" />
    <button class="btn btn-primary btn-full" id="confirmar-editar-saldo">Aplicar cambio</button>
    <div id="admin-error" class="hidden" style="color:var(--danger); margin-top:0.5rem"></div>
  `;

  document.getElementById('confirmar-editar-saldo').addEventListener('click', async () => {
    const username = document.getElementById('admin-usuario').value.trim().toLowerCase();
    const nuevoSaldo = parseInt(document.getElementById('admin-saldo').value);
    const errorEl = document.getElementById('admin-error');

    const mostrarErr = (msg) => { errorEl.textContent = msg; errorEl.classList.remove('hidden'); };

    if (!username) return mostrarErr('Ingresa el usuario');
    if (isNaN(nuevoSaldo) || nuevoSaldo < 0) return mostrarErr('Ingresa un saldo válido');

    const btn = document.getElementById('confirmar-editar-saldo');
    btn.disabled = true;
    btn.textContent = 'Aplicando...';

    const usernameSnap = await getDoc(doc(db, 'usernames', username));
    if (!usernameSnap.exists()) {
      mostrarErr('Usuario no encontrado');
      btn.disabled = false;
      btn.textContent = 'Aplicar cambio';
      return;
    }

    const uid = usernameSnap.data().uid;
    await updateDoc(doc(db, 'usuarios', uid), { saldo: nuevoSaldo });
    await addDoc(collection(db, 'transacciones'), {
      tipo: 'ajuste_admin',
      de: currentUser.uid,
      deUsername: currentUser.username,
      para: uid,
      paraUsername: username,
      monto: nuevoSaldo,
      descripcion: 'Ajuste de saldo por administrador',
      fecha: new Date().toISOString(),
      estado: 'completada'
    });

    panel.innerHTML = `
      <div style="text-align:center; padding:1rem">
        <p style="font-size:2rem">✅</p>
        <p>Saldo actualizado</p>
        <p style="color:var(--text-secondary)">${username} ahora tiene £${nuevoSaldo.toLocaleString('es-CO')}</p>
      </div>
    `;
  });
}

function renderPerfil() {
  mainContent.innerHTML = `
    <div class="card">
      <h3>👤 Mi Perfil</h3>
      <p><strong>Usuario:</strong> ${currentUser?.username || ''}</p>
      <p><strong>Rol:</strong> ${currentUser?.rol || 'jugador'}</p>
      <p><strong>Ciudad:</strong> ${currentUser?.ciudad || 'Sin asignar'}</p>
      <p><strong>WhatsApp:</strong> ${currentUser?.whatsapp || 'No registrado'}</p>
    </div>
    <button class="btn btn-secondary btn-full" id="logout-btn">
      Cerrar sesión
    </button>
  `;
  document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
}

function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
}
