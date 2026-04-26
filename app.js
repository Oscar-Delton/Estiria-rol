import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, collection,
  query, where, orderBy, onSnapshot, updateDoc, increment, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const splash = document.getElementById('splash');
const appDiv = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
const loginError = document.getElementById('login-error');
const userInfo = document.getElementById('user-info');
const mainContent = document.getElementById('main-content');
const navBtns = document.querySelectorAll('.nav-btn');

let currentUser = null;
let todosLosUsuarios = [];

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = await loadUserProfile(user);
    await cargarTodosLosUsuarios();
    showApp();
  } else {
    showLogin();
  }
});

async function cargarTodosLosUsuarios() {
  const snap = await getDocs(collection(db, 'usuarios'));
  todosLosUsuarios = snap.docs.map(function(d) { return d.data(); });
}

function showApp() {
  splash.classList.add('hidden');
  loginScreen.classList.add('hidden');
  appDiv.classList.remove('hidden');
  userInfo.textContent = currentUser ? currentUser.username : '';
  navigateTo('inicio');
}

function showLogin() {
  splash.classList.add('hidden');
  appDiv.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

document.querySelectorAll('.auth-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    var target = tab.dataset.tab;
    document.getElementById('tab-login').classList.toggle('hidden', target !== 'login');
    document.getElementById('tab-register').classList.toggle('hidden', target !== 'register');
    hideError();
  });
});

document.getElementById('login-btn').addEventListener('click', async function() {
  var username = document.getElementById('login-username').value.trim().toLowerCase();
  var password = document.getElementById('login-password').value;
  if (!username || !password) return showError('Completa todos los campos');
  var btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  hideError();
  try {
    await signInWithEmailAndPassword(auth, username + '@estiria.app', password);
  } catch (err) {
    showError('Usuario o contrasena incorrectos');
    btn.disabled = false;
    btn.textContent = 'Entrar a Estiria';
  }
});

document.getElementById('register-btn').addEventListener('click', async function() {
  var username = document.getElementById('reg-username').value.trim().toLowerCase();
  var password = document.getElementById('reg-password').value;
  var password2 = document.getElementById('reg-password2').value;
  var whatsapp = document.getElementById('reg-whatsapp').value.trim();
  if (!username || !password) return showError('Usuario y contrasena son obligatorios');
  if (username.length < 3) return showError('El usuario debe tener al menos 3 caracteres');
  if (password.length < 6) return showError('La contrasena debe tener al menos 6 caracteres');
  if (password !== password2) return showError('Las contrasenhas no coinciden');
  if (!/^[a-z0-9_]+$/.test(username)) return showError('Solo letras, numeros y guion bajo');
  var btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.textContent = 'Creando cuenta...';
  hideError();
  try {
    var usernameRef = doc(db, 'usernames', username);
    var usernameSnap = await getDoc(usernameRef);
    if (usernameSnap.exists()) {
      showError('Ese nombre de usuario ya esta ocupado');
      btn.disabled = false;
      btn.textContent = 'Crear cuenta';
      return;
    }
    var cred = await createUserWithEmailAndPassword(auth, username + '@estiria.app', password);
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      uid: cred.user.uid, username: username, whatsapp: whatsapp || '',
      rol: 'jugador', ciudad: '', creadoEn: new Date().toISOString(), saldo: 0
    });
    await setDoc(usernameRef, { uid: cred.user.uid });
  } catch (err) {
    showError('Error al crear cuenta: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Crear cuenta';
  }
});

async function loadUserProfile(user) {
  var ref = doc(db, 'usuarios', user.uid);
  var snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return { uid: user.uid, username: user.email.split('@')[0], rol: 'jugador', saldo: 0 };
}

navBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    navBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    navigateTo(btn.dataset.section);
  });
});

function navigateTo(section) {
  document.getElementById('header-title').textContent = section.charAt(0).toUpperCase() + section.slice(1);
  switch (section) {
    case 'inicio': renderInicio(); break;
    case 'banco': renderBanco(); break;
    case 'biblioteca': renderBiblioteca(); break;
    case 'perfil': renderPerfil(); break;
  }
}

function renderInicio() {
  var esDev = currentUser && currentUser.rol === 'dev';
  mainContent.innerHTML = '<div class="welcome-banner"><h2>Bienvenido a Estiria</h2><p>' + (currentUser ? currentUser.username : 'Ciudadano') + '</p></div><div class="card"><h3>Anuncios</h3><p>Proximamente...</p></div><div class="card"><h3>Eventos</h3><p>Proximamente...</p></div>' + (esDev ? '<div class="card" style="border-color:var(--accent)"><h3>Panel Admin</h3><p>Acceso de desarrollador.</p></div>' : '');
}

function renderBiblioteca() {
  mainContent.innerHTML = '<div class="card"><h3>Biblioteca</h3><p>Proximamente...</p></div>';
}

function renderBanco() {
  var esDev = currentUser && currentUser.rol === 'dev';
  var esAdminBanco = currentUser && (currentUser.rol === 'admin_banco' || esDev);
  mainContent.innerHTML = '<div class="banco-saldo card"><p class="saldo-label">Saldo disponible</p><h2 class="saldo-monto">💷 <span id="saldo-valor">Cargando...</span></h2><p class="saldo-ciudad">' + (currentUser && currentUser.ciudad ? currentUser.ciudad : 'Sin ciudad asignada') + '</p></div><div class="banco-acciones"><button class="btn-banco" id="btn-transferir"><span>💸</span><span>Transferir</span></button><button class="btn-banco" id="btn-movimientos"><span>📋</span><span>Movimientos</span></button><button class="btn-banco" id="btn-impuestos"><span>📜</span><span>Impuestos</span></button><button class="btn-banco" id="btn-reporte"><span>🚨</span><span>Reportar</span></button></div><div id="banco-panel" class="card"></div>' + (esAdminBanco ? '<div class="card" style="border-color:var(--accent);margin-top:1rem"><h3>Panel Banco Admin</h3><button class="btn btn-primary btn-full" id="btn-admin-saldo">Editar saldo de usuario</button></div>' : '');
  cargarSaldo();
  document.getElementById('btn-transferir').addEventListener('click', mostrarTransferencia);
  document.getElementById('btn-movimientos').addEventListener('click', mostrarMovimientos);
  document.getElementById('btn-impuestos').addEventListener('click', mostrarImpuestos);
  document.getElementById('btn-reporte').addEventListener('click', mostrarReporte);
  if (esAdminBanco) document.getElementById('btn-admin-saldo').addEventListener('click', mostrarEditarSaldo);
}

function cargarSaldo() {
  onSnapshot(doc(db, 'usuarios', currentUser.uid), function(snap) {
    if (snap.exists()) {
      currentUser.saldo = snap.data().saldo;
      var el = document.getElementById('saldo-valor');
      if (el) el.textContent = snap.data().saldo.toLocaleString('es-CO') + ' £';
    }
  });
}
function crearBuscadorUsuarios(inputId, listId, excluir) {
  var input = document.getElementById(inputId);
  var lista = document.getElementById(listId);
  input.addEventListener('input', function() {
    var valor = input.value.toLowerCase();
    var filtrados = todosLosUsuarios.filter(function(u) {
      return u.username !== excluir && u.username.toLowerCase().includes(valor);
    });
    if (filtrados.length === 0 || valor === '') {
      lista.innerHTML = '';
      lista.style.display = 'none';
      return;
    }
    lista.style.display = 'block';
    lista.innerHTML = filtrados.map(function(u) {
      return '<div class="usuario-sugerencia" data-username="' + u.username + '">' + u.username + '</div>';
    }).join('');
    lista.querySelectorAll('.usuario-sugerencia').forEach(function(item) {
      item.addEventListener('click', function() {
        input.value = item.dataset.username;
        lista.innerHTML = '';
        lista.style.display = 'none';
      });
    });
  });
}

function mostrarTransferencia() {
  var panel = document.getElementById('banco-panel');
  panel.innerHTML = '<h3>💸 Transferir dinero</h3><div style="position:relative"><input type="text" id="transfer-usuario" placeholder="Buscar usuario destino..." autocomplete="off"/><div id="transfer-lista" class="usuarios-lista"></div></div><input type="number" id="transfer-monto" placeholder="Monto en £" min="1"/><textarea id="transfer-desc" placeholder="Descripcion obligatoria — ej: Compra de espada"></textarea><button class="btn btn-primary btn-full" id="confirmar-transfer">Confirmar transferencia</button><div id="transfer-error" class="hidden" style="color:var(--danger);margin-top:0.5rem"></div>';
  crearBuscadorUsuarios('transfer-usuario', 'transfer-lista', currentUser.username);
  document.getElementById('confirmar-transfer').addEventListener('click', ejecutarTransferencia);
}

async function ejecutarTransferencia() {
  var usuarioDestino = document.getElementById('transfer-usuario').value.trim().toLowerCase();
  var monto = parseInt(document.getElementById('transfer-monto').value);
  var descripcion = document.getElementById('transfer-desc').value.trim();
  var errorEl = document.getElementById('transfer-error');
  function mostrarErr(msg) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
  if (!usuarioDestino) return mostrarErr('Ingresa el usuario destino');
  if (!monto || monto <= 0) return mostrarErr('Ingresa un monto valido');
  if (!descripcion) return mostrarErr('La descripcion es obligatoria');
  if (usuarioDestino === currentUser.username) return mostrarErr('No puedes transferirte a ti mismo');
  if (monto > currentUser.saldo) return mostrarErr('Saldo insuficiente');
  var btn = document.getElementById('confirmar-transfer');
  btn.disabled = true;
  btn.textContent = 'Procesando...';
  try {
    var usernameSnap = await getDoc(doc(db, 'usernames', usuarioDestino));
    if (!usernameSnap.exists()) { mostrarErr('Usuario no encontrado'); btn.disabled = false; btn.textContent = 'Confirmar transferencia'; return; }
    var uidDestino = usernameSnap.data().uid;
    var fecha = new Date().toISOString();
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { saldo: increment(-monto) });
    await updateDoc(doc(db, 'usuarios', uidDestino), { saldo: increment(monto) });
    await addDoc(collection(db, 'transacciones'), {
      tipo: 'transferencia', de: currentUser.uid, deUsername: currentUser.username,
      para: uidDestino, paraUsername: usuarioDestino, monto: monto,
      descripcion: descripcion, fecha: fecha, estado: 'completada'
    });
    document.getElementById('banco-panel').innerHTML = '<div style="text-align:center;padding:1rem"><p style="font-size:2rem">✅</p><p>Transferencia exitosa</p><p style="color:var(--text-secondary)">Enviaste £' + monto.toLocaleString('es-CO') + ' a ' + usuarioDestino + '</p></div>';
  } catch (err) {
    mostrarErr('Error: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Confirmar transferencia';
  }
}

function mostrarMovimientos() {
  var panel = document.getElementById('banco-panel');
  panel.innerHTML = '<h3>📋 Movimientos</h3><div id="lista-movimientos"><p style="color:var(--text-secondary)">Cargando...</p></div>';
  var movimientos = {};
  function renderizar() {
    var lista = document.getElementById('lista-movimientos');
    if (!lista) return;
    var arr = Object.values(movimientos);
    if (arr.length === 0) { lista.innerHTML = '<p style="color:var(--text-secondary)">Sin movimientos aun</p>'; return; }
    arr.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    lista.innerHTML = arr.map(function(m) {
      var esEnvio = m.de === currentUser.uid;
      var fecha = new Date(m.fecha).toLocaleString('es-CO');
      var signo = esEnvio ? '-' : '+';
      var color = esEnvio ? 'var(--danger)' : 'var(--success)';
      var contraparte = '';
      if (m.tipo === 'ajuste_admin') {
        contraparte = 'Ajuste por admin';
      } else if (esEnvio) {
        contraparte = 'Para: ' + m.paraUsername;
      } else {
        contraparte = 'De: ' + m.deUsername;
      }
      return '<div class="movimiento-item"><div class="movimiento-info"><p class="movimiento-desc">' + m.descripcion + '</p><p class="movimiento-meta">' + contraparte + ' · ' + fecha + '</p></div><p class="movimiento-monto" style="color:' + color + '">' + signo + '£' + m.monto.toLocaleString('es-CO') + '</p></div>';
    }).join('');
  }
  onSnapshot(query(collection(db, 'transacciones'), where('de', '==', currentUser.uid), orderBy('fecha', 'desc')), function(snap) {
    snap.docs.forEach(function(d) { movimientos[d.id] = Object.assign({ id: d.id }, d.data()); });
    renderizar();
  });
  onSnapshot(query(collection(db, 'transacciones'), where('para', '==', currentUser.uid), orderBy('fecha', 'desc')), function(snap) {
    snap.docs.forEach(function(d) { movimientos[d.id] = Object.assign({ id: d.id }, d.data()); });
    renderizar();
  });
}

function mostrarImpuestos() {
  var panel = document.getElementById('banco-panel');
  panel.innerHTML = '<h3>📜 Impuestos</h3><div id="lista-impuestos"><p style="color:var(--text-secondary)">Cargando...</p></div>';
  onSnapshot(query(collection(db, 'impuestos'), where('uid', '==', currentUser.uid), orderBy('fecha', 'desc')), function(snap) {
    var lista = document.getElementById('lista-impuestos');
    if (!lista) return;
    if (snap.empty) { lista.innerHTML = '<p style="color:var(--success)">Sin impuestos pendientes ✅</p>'; return; }
    lista.innerHTML = snap.docs.map(function(d) {
      var m = d.data();
      var fecha = new Date(m.fecha).toLocaleString('es-CO');
      return '<div class="movimiento-item"><div class="movimiento-info"><p class="movimiento-desc">' + m.concepto + '</p><p class="movimiento-meta">' + fecha + '</p></div><div style="text-align:right"><p class="movimiento-monto" style="color:var(--danger)">£' + m.monto.toLocaleString('es-CO') + '</p>' + (!m.pagado ? '<button class="btn btn-primary" style="font-size:0.75rem;padding:0.3rem 0.6rem;margin-top:0.3rem" data-id="' + d.id + '" data-monto="' + m.monto + '">Pagar</button>' : '<p style="color:var(--success);font-size:0.8rem">Pagado ✅</p>') + '</div></div>';
    }).join('');
    lista.querySelectorAll('button[data-id]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var id = btn.dataset.id;
        var monto = parseInt(btn.dataset.monto);
        if (monto > currentUser.saldo) { alert('Saldo insuficiente'); return; }
        btn.disabled = true; btn.textContent = 'Pagando...';
        await updateDoc(doc(db, 'impuestos', id), { pagado: true });
        await updateDoc(doc(db, 'usuarios', currentUser.uid), { saldo: increment(-monto) });
        await addDoc(collection(db, 'transacciones'), { tipo: 'impuesto', de: currentUser.uid, deUsername: currentUser.username, para: 'sistema', paraUsername: 'Estiria', monto: monto, descripcion: 'Pago de impuesto', fecha: new Date().toISOString(), estado: 'completada' });
      });
    });
  });
}

function mostrarReporte() {
  var panel = document.getElementById('banco-panel');
  panel.innerHTML = '<h3>🚨 Reportar problema</h3><input type="text" id="reporte-asunto" placeholder="Asunto del reporte"/><textarea id="reporte-desc" placeholder="Describe el problema con detalle..."></textarea><button class="btn btn-primary btn-full" id="enviar-reporte">Enviar reporte</button><div id="reporte-error" class="hidden" style="color:var(--danger);margin-top:0.5rem"></div>';
  document.getElementById('enviar-reporte').addEventListener('click', async function() {
    var asunto = document.getElementById('reporte-asunto').value.trim();
    var descripcion = document.getElementById('reporte-desc').value.trim();
    var errorEl = document.getElementById('reporte-error');
    if (!asunto || !descripcion) { errorEl.textContent = 'Completa todos los campos'; errorEl.classList.remove('hidden'); return; }
    var btn = document.getElementById('enviar-reporte');
    btn.disabled = true; btn.textContent = 'Enviando...';
    await addDoc(collection(db, 'reportes'), { uid: currentUser.uid, username: currentUser.username, asunto: asunto, descripcion: descripcion, fecha: new Date().toISOString(), estado: 'pendiente' });
    document.getElementById('banco-panel').innerHTML = '<div style="text-align:center;padding:1rem"><p style="font-size:2rem">✅</p><p>Reporte enviado</p><p style="color:var(--text-secondary)">Un administrador lo revisara pronto</p></div>';
  });
}

function mostrarEditarSaldo() {
  var panel = document.getElementById('banco-panel');
  panel.innerHTML = '<h3>✏️ Editar saldo de usuario</h3><div style="position:relative"><input type="text" id="admin-usuario" placeholder="Buscar usuario..." autocomplete="off"/><div id="admin-lista" class="usuarios-lista"></div></div><div id="admin-saldo-actual" style="color:var(--text-secondary);margin-bottom:0.75rem;font-size:0.9rem"></div><input type="number" id="admin-saldo-nuevo" placeholder="Nuevo saldo en £" min="0"/><input type="text" id="admin-motivo" placeholder="Motivo del cambio (obligatorio)"/><button class="btn btn-primary btn-full" id="confirmar-editar-saldo">Aplicar cambio</button><div id="admin-error" class="hidden" style="color:var(--danger);margin-top:0.5rem"></div>';
  crearBuscadorUsuarios('admin-usuario', 'admin-lista', null);
  document.getElementById('admin-usuario').addEventListener('change', async function() {
    var username = this.value.trim().toLowerCase();
    var snap = await getDoc(doc(db, 'usernames', username));
    if (snap.exists()) {
      var uid = snap.data().uid;
      var userSnap = await getDoc(doc(db, 'usuarios', uid));
      if (userSnap.exists()) {
        document.getElementById('admin-saldo-actual').textContent = 'Saldo actual: £' + userSnap.data().saldo.toLocaleString('es-CO');
      }
    }
  });
  document.getElementById('confirmar-editar-saldo').addEventListener('click', async function() {
    var username = document.getElementById('admin-usuario').value.trim().toLowerCase();
    var nuevoSaldo = parseInt(document.getElementById('admin-saldo-nuevo').value);
    var motivo = document.getElementById('admin-motivo').value.trim();
    var errorEl = document.getElementById('admin-error');
    function mostrarErr(msg) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
    if (!username) return mostrarErr('Ingresa el usuario');
    if (isNaN(nuevoSaldo) || nuevoSaldo < 0) return mostrarErr('Ingresa un saldo valido');
    if (!motivo) return mostrarErr('El motivo es obligatorio');
    var btn = document.getElementById('confirmar-editar-saldo');
    btn.disabled = true; btn.textContent = 'Aplicando...';
    var usernameSnap = await getDoc(doc(db, 'usernames', username));
    if (!usernameSnap.exists()) { mostrarErr('Usuario no encontrado'); btn.disabled = false; btn.textContent = 'Aplicar cambio'; return; }
    var uid = usernameSnap.data().uid;
    var userSnap = await getDoc(doc(db, 'usuarios', uid));
    var saldoAnterior = userSnap.exists() ? userSnap.data().saldo : 0;
    await updateDoc(doc(db, 'usuarios', uid), { saldo: nuevoSaldo });
    await addDoc(collection(db, 'transacciones'), {
      tipo: 'ajuste_admin', de: currentUser.uid, deUsername: currentUser.username,
      para: uid, paraUsername: username, monto: nuevoSaldo,
      descripcion: 'Saldo cambiado de £' + saldoAnterior.toLocaleString('es-CO') + ' a £' + nuevoSaldo.toLocaleString('es-CO') + '. Motivo: ' + motivo,
      fecha: new Date().toISOString(), estado: 'completada', saldoAnterior: saldoAnterior
    });
    document.getElementById('banco-panel').innerHTML = '<div style="text-align:center;padding:1rem"><p style="font-size:2rem">✅</p><p>Saldo actualizado</p><p style="color:var(--text-secondary)">' + username + ': £' + saldoAnterior.toLocaleString('es-CO') + ' → £' + nuevoSaldo.toLocaleString('es-CO') + '</p><p style="color:var(--text-secondary)">Motivo: ' + motivo + '</p></div>';
  });
}

function renderPerfil() {
  mainContent.innerHTML = '<div class="card"><h3>👤 Mi Perfil</h3><p><strong>Usuario:</strong> ' + (currentUser ? currentUser.username : '') + '</p><p><strong>Rol:</strong> ' + (currentUser ? currentUser.rol : 'jugador') + '</p><p><strong>Ciudad:</strong> ' + (currentUser && currentUser.ciudad ? currentUser.ciudad : 'Sin asignar') + '</p><p><strong>WhatsApp:</strong> ' + (currentUser && currentUser.whatsapp ? currentUser.whatsapp : 'No registrado') + '</p></div><button class="btn btn-secondary btn-full" id="logout-btn">Cerrar sesion</button>';
  document.getElementById('logout-btn').addEventListener('click', function() { signOut(auth); });
}

function showError(msg) { loginError.textContent = msg; loginError.classList.remove('hidden'); }
function hideError() { loginError.classList.add('hidden'); }