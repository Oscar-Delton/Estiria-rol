import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, collection,
  query, where, orderBy, onSnapshot, updateDoc, increment, getDocs, deleteDoc, limit, writeBatch
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
  var snap = await getDocs(collection(db, 'usuarios'));
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
  btn.disabled = true; btn.textContent = 'Entrando...'; hideError();
  try {
    await signInWithEmailAndPassword(auth, username + '@estiria.app', password);
  } catch (err) {
    showError('Usuario o contrasena incorrectos');
    btn.disabled = false; btn.textContent = 'Entrar a Estiria';
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
  btn.disabled = true; btn.textContent = 'Creando cuenta...'; hideError();
  try {
    var usernameRef = doc(db, 'usernames', username);
    var usernameSnap = await getDoc(usernameRef);
    if (usernameSnap.exists()) {
      showError('Ese nombre de usuario ya esta ocupado');
      btn.disabled = false; btn.textContent = 'Crear cuenta'; return;
    }
    var cred = await createUserWithEmailAndPassword(auth, username + '@estiria.app', password);
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      uid: cred.user.uid, username: username, whatsapp: whatsapp || '',
      rol: 'jugador', ciudad: '', creadoEn: new Date().toISOString(), saldo: 0
    });
    await setDoc(usernameRef, { uid: cred.user.uid });
  } catch (err) {
    showError('Error al crear cuenta: ' + err.message);
    btn.disabled = false; btn.textContent = 'Crear cuenta';
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
  mainContent.innerHTML = '<div class="welcome-banner"><h2>Bienvenido a Estiria</h2><p>' + (currentUser ? currentUser.username : 'Ciudadano') + '</p></div><div class="card"><h3>Anuncios</h3><p>Proximamente...</p></div><div class="card"><h3>Eventos</h3><p>Proximamente...</p></div>' + (esDev ? '<div class="card" style="border-color:var(--accent)"><h3>Panel Dev</h3><p>Acceso de desarrollador.</p></div>' : '');
}

function renderBiblioteca() {
  mainContent.innerHTML = '<div class="card"><h3>Biblioteca</h3><p>Proximamente...</p></div>';
}

function isAdminBanco() {
  if (!currentUser) return false;
  return currentUser.rol === 'dev' || currentUser.rol === 'admin_banco' || currentUser.rol === 'regidor';
}

function isDev() {
  return currentUser && currentUser.rol === 'dev';
}

function isAdminSuperior() {
  return currentUser && (currentUser.rol === 'dev' || currentUser.rol === 'admin_banco');
}

function puedeEditarUsuario(usuarioTarget) {
  if (!currentUser || !usuarioTarget) return false;
  if (isDev() || currentUser.rol === 'admin_banco') return true;
  if (currentUser.rol === 'regidor') return usuarioTarget.ciudad === currentUser.ciudad;
  return false;
}

function renderBanco() {
  var esAdmin = isAdminBanco();
  mainContent.innerHTML = '<div class="banco-saldo card"><p class="saldo-label">Saldo disponible</p><h2 class="saldo-monto">💷 <span id="saldo-valor">Cargando...</span></h2><p class="saldo-ciudad">' + (currentUser && currentUser.ciudad ? currentUser.ciudad : 'Sin ciudad asignada') + '</p></div><div class="banco-acciones"><button class="btn-banco" id="btn-transferir"><span>💸</span><span>Transferir</span></button><button class="btn-banco" id="btn-movimientos"><span>📋</span><span>Movimientos</span></button><button class="btn-banco" id="btn-impuestos"><span>📜</span><span>Impuestos</span></button><button class="btn-banco" id="btn-reporte"><span>🚨</span><span>Reportar</span></button></div><div id="banco-panel" class="card"></div>' + (esAdmin ? renderPanelAdmin() : '');
  cargarSaldo();
  document.getElementById('btn-transferir').addEventListener('click', mostrarTransferencia);
  document.getElementById('btn-movimientos').addEventListener('click', mostrarMovimientos);
  document.getElementById('btn-impuestos').addEventListener('click', mostrarImpuestos);
  document.getElementById('btn-reporte').addEventListener('click', mostrarReporte);
  if (esAdmin) {
    document.getElementById('btn-admin-ver').addEventListener('click', mostrarVerUsuario);
    document.getElementById('btn-admin-editar').addEventListener('click', mostrarEditarSaldo);
    document.getElementById('btn-admin-sumar').addEventListener('click', function() { mostrarSumarRestar('sumar'); });
    document.getElementById('btn-admin-restar').addEventListener('click', function() { mostrarSumarRestar('restar'); });
  }
}

function renderPanelAdmin() {
  return '<div class="card" style="border-color:var(--accent);margin-top:1rem"><h3>🏦 Panel Admin Banco</h3><div class="banco-acciones" style="margin-top:0.75rem"><button class="btn-banco" id="btn-admin-ver"><span>👁️</span><span>Ver usuario</span></button><button class="btn-banco" id="btn-admin-editar"><span>✏️</span><span>Editar saldo</span></button><button class="btn-banco" id="btn-admin-sumar"><span>➕</span><span>Sumar</span></button><button class="btn-banco" id="btn-admin-restar"><span>➖</span><span>Restar</span></button></div></div>';
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

function crearBuscadorUsuarios(inputId, listId, excluir, soloCiudad) {
  var input = document.getElementById(inputId);
  var lista = document.getElementById(listId);
  if (!input || !lista) return;
  input.addEventListener('input', function() {
    var valor = input.value.toLowerCase();
    var filtrados = todosLosUsuarios.filter(function(u) {
      if (excluir && u.username === excluir) return false;
      if (soloCiudad && u.ciudad !== currentUser.ciudad) return false;
      return u.username.toLowerCase().includes(valor);
    });
    if (filtrados.length === 0 || valor === '') { lista.innerHTML = ''; lista.style.display = 'none'; return; }
    lista.style.display = 'block';
    lista.innerHTML = filtrados.map(function(u) {
      return '<div class="usuario-sugerencia" data-username="' + u.username + '">' + u.username + (u.ciudad ? ' · ' + u.ciudad : '') + '</div>';
    }).join('');
    lista.querySelectorAll('.usuario-sugerencia').forEach(function(item) {
      item.addEventListener('click', function() {
        input.value = item.dataset.username;
        lista.innerHTML = ''; lista.style.display = 'none';
      });
    });
  });
}
function mostrarTransferencia() {
  var panel = document.getElementById('banco-panel');
  panel.innerHTML = '<h3>💸 Transferir dinero</h3><div style="position:relative"><input type="text" id="transfer-usuario" placeholder="Buscar usuario destino..." autocomplete="off"/><div id="transfer-lista" class="usuarios-lista"></div></div><input type="number" id="transfer-monto" placeholder="Monto en £" min="1"/><textarea id="transfer-desc" placeholder="Descripcion obligatoria"></textarea><button class="btn btn-primary btn-full" id="confirmar-transfer">Confirmar transferencia</button><div id="transfer-error" class="hidden" style="color:var(--danger);margin-top:0.5rem"></div>';
  crearBuscadorUsuarios('transfer-usuario', 'transfer-lista', currentUser.username, false);
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
  btn.disabled = true; btn.textContent = 'Procesando...';
  try {
    var usernameSnap = await getDoc(doc(db, 'usernames', usuarioDestino));
    if (!usernameSnap.exists()) { mostrarErr('Usuario no encontrado'); btn.disabled = false; btn.textContent = 'Confirmar transferencia'; return; }
    var uidDestino = usernameSnap.data().uid;
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { saldo: increment(-monto) });
    await updateDoc(doc(db, 'usuarios', uidDestino), { saldo: increment(monto) });
    await registrarTransaccion({ tipo: 'transferencia', de: currentUser.uid, deUsername: currentUser.username, para: uidDestino, paraUsername: usuarioDestino, monto: monto, descripcion: descripcion });
    document.getElementById('banco-panel').innerHTML = '<div style="text-align:center;padding:1rem"><p style="font-size:2rem">✅</p><p>Transferencia exitosa</p><p style="color:var(--text-secondary)">Enviaste £' + monto.toLocaleString('es-CO') + ' a ' + usuarioDestino + '</p></div>';
  } catch (err) {
    mostrarErr('Error: ' + err.message);
    btn.disabled = false; btn.textContent = 'Confirmar transferencia';
  }
}

async function registrarTransaccion(datos) {
  var fecha = new Date().toISOString();
  await addDoc(collection(db, 'transacciones'), Object.assign({ fecha: fecha, estado: 'completada' }, datos));
  await limpiarHistorialAntiguo(datos.de);
  if (datos.para && datos.para !== 'sistema') await limpiarHistorialAntiguo(datos.para);
}

async function limpiarHistorialAntiguo(uid) {
  if (!uid || uid === 'sistema') return;
  var qEnvios = query(collection(db, 'transacciones'), where('de', '==', uid), orderBy('fecha', 'desc'));
  var qRecibos = query(collection(db, 'transacciones'), where('para', '==', uid), orderBy('fecha', 'desc'));
  var snapEnvios = await getDocs(qEnvios);
  var snapRecibos = await getDocs(qRecibos);
  var todos = {};
  snapEnvios.docs.forEach(function(d) { todos[d.id] = d; });
  snapRecibos.docs.forEach(function(d) { todos[d.id] = d; });
  var arr = Object.values(todos).sort(function(a, b) { return new Date(b.data().fecha) - new Date(a.data().fecha); });
  if (arr.length > 40) {
    var aEliminar = arr.slice(40);
    for (var i = 0; i < aEliminar.length; i++) {
      await deleteDoc(aEliminar[i].ref);
    }
  }
}

function mostrarMovimientos() {
  var panel = document.getElementById('banco-panel');
  panel.innerHTML = '<h3>📋 Movimientos</h3><div id="lista-movimientos"><p style="color:var(--text-secondary)">Cargando...</p></div>';
  cargarMovimientosUsuario(currentUser.uid, 'lista-movimientos', currentUser.uid);
}

function cargarMovimientosUsuario(uid, contenedorId, uidActual) {
  var movimientos = {};
  function renderizar() {
    var lista = document.getElementById(contenedorId);
    if (!lista) return;
    var arr = Object.values(movimientos);
    if (arr.length === 0) { lista.innerHTML = '<p style="color:var(--text-secondary)">Sin movimientos aun</p>'; return; }
    arr.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    lista.innerHTML = arr.map(function(m) {
      var esEnvio = m.de === uidActual;
      var fecha = new Date(m.fecha).toLocaleString('es-CO');
      var signo = esEnvio ? '-' : '+';
      var color = esEnvio ? 'var(--danger)' : 'var(--success)';
      var contraparte = m.tipo === 'ajuste_admin' ? 'Ajuste por: ' + m.deUsername : (esEnvio ? 'Para: ' + m.paraUsername : 'De: ' + m.deUsername);
      return '<div class="movimiento-item"><div class="movimiento-info"><p class="movimiento-desc">' + m.descripcion + '</p><p class="movimiento-meta">' + contraparte + ' · ' + fecha + '</p></div><p class="movimiento-monto" style="color:' + color + '">' + signo + '£' + m.monto.toLocaleString('es-CO') + '</p></div>';
    }).join('');
  }
  onSnapshot(query(collection(db, 'transacciones'), where('de', '==', uid), orderBy('fecha', 'desc')), function(snap) {
    snap.docs.forEach(function(d) { movimientos[d.id] = Object.assign({ id: d.id }, d.data()); });
    renderizar();
  });
  onSnapshot(query(collection(db, 'transacciones'), where('para', '==', uid), orderBy('fecha', 'desc')), function(snap) {
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
    if (snap.empty) { lista.innerHTML = '<p style="color:var(--success)">Sin impuestos pendientes</p>'; return; }
    lista.innerHTML = snap.docs.map(function(d) {
      var m = d.data(); var fecha = new Date(m.fecha).toLocaleString('es-CO');
      return '<div class="movimiento-item"><div class="movimiento-info"><p class="movimiento-desc">' + m.concepto + '</p><p class="movimiento-meta">' + fecha + '</p></div><div style="text-align:right"><p class="movimiento-monto" style="color:var(--danger)">£' + m.monto.toLocaleString('es-CO') + '</p>' + (!m.pagado ? '<button class="btn btn-primary" style="font-size:0.75rem;padding:0.3rem 0.6rem;margin-top:0.3rem" data-id="' + d.id + '" data-monto="' + m.monto + '">Pagar</button>' : '<p style="color:var(--success);font-size:0.8rem">Pagado</p>') + '</div></div>';
    }).join('');
    lista.querySelectorAll('button[data-id]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var id = btn.dataset.id; var monto = parseInt(btn.dataset.monto);
        if (monto > currentUser.saldo) { alert('Saldo insuficiente'); return; }
        btn.disabled = true; btn.textContent = 'Pagando...';
        await updateDoc(doc(db, 'impuestos', id), { pagado: true });
        await updateDoc(doc(db, 'usuarios', currentUser.uid), { saldo: increment(-monto) });
        await registrarTransaccion({ tipo: 'impuesto', de: currentUser.uid, deUsername: currentUser.username, para: 'sistema', paraUsername: 'Estiria', monto: monto, descripcion: 'Pago de impuesto' });
      });
    });
  });
}

function mostrarReporte() {
  var panel = document.getElementById('banco-panel');
  panel.innerHTML = '<h3>🚨 Reportar problema</h3><input type="text" id="reporte-asunto" placeholder="Asunto"/><textarea id="reporte-desc" placeholder="Describe el problema..."></textarea><button class="btn btn-primary btn-full" id="enviar-reporte">Enviar reporte</button><div id="reporte-error" class="hidden" style="color:var(--danger);margin-top:0.5rem"></div>';
  document.getElementById('enviar-reporte').addEventListener('click', async function() {
    var asunto = document.getElementById('reporte-asunto').value.trim();
    var descripcion = document.getElementById('reporte-desc').value.trim();
    var errorEl = document.getElementById('reporte-error');
    if (!asunto || !descripcion) { errorEl.textContent = 'Completa todos los campos'; errorEl.classList.remove('hidden'); return; }
    var btn = document.getElementById('enviar-reporte');
    btn.disabled = true; btn.textContent = 'Enviando...';
    await addDoc(collection(db, 'reportes'), { uid: currentUser.uid, username: currentUser.username, asunto: asunto, descripcion: descripcion, fecha: new Date().toISOString(), estado: 'pendiente' });
    document.getElementById('banco-panel').innerHTML = '<div style="text-align:center;padding:1rem"><p style="font-size:2rem">✅</p><p>Reporte enviado</p></div>';
  });
}

function mostrarVerUsuario() {
  var panel = document.getElementById('banco-panel');
  var soloCiudad = currentUser.rol === 'regidor';
  panel.innerHTML = '<h3>👁️ Ver informacion de usuario</h3><div style="position:relative"><input type="text" id="ver-usuario-input" placeholder="Buscar usuario..." autocomplete="off"/><div id="ver-usuario-lista" class="usuarios-lista"></div></div><button class="btn btn-primary btn-full" id="btn-ver-confirmar" style="margin-top:0.5rem">Ver cuenta</button><div id="ver-usuario-panel"></div>';
  crearBuscadorUsuarios('ver-usuario-input', 'ver-usuario-lista', null, soloCiudad);
  document.getElementById('btn-ver-confirmar').addEventListener('click', async function() {
    var username = document.getElementById('ver-usuario-input').value.trim().toLowerCase();
    if (!username) return;
    var usernameSnap = await getDoc(doc(db, 'usernames', username));
    if (!usernameSnap.exists()) { document.getElementById('ver-usuario-panel').innerHTML = '<p style="color:var(--danger)">Usuario no encontrado</p>'; return; }
    var uid = usernameSnap.data().uid;
    var userSnap = await getDoc(doc(db, 'usuarios', uid));
    if (!userSnap.exists()) return;
    var userData = userSnap.data();
    if (soloCiudad && userData.ciudad !== currentUser.ciudad) { document.getElementById('ver-usuario-panel').innerHTML = '<p style="color:var(--danger)">No tienes permiso para ver usuarios de otra ciudad</p>'; return; }
    var puedeEliminarHistorial = isAdminSuperior();
    document.getElementById('ver-usuario-panel').innerHTML = '<div class="card" style="margin-top:1rem"><div style="display:flex;justify-content:space-between;align-items:center"><h3>' + userData.username + '</h3><button class="btn btn-secondary" id="btn-cerrar-ver" style="padding:0.3rem 0.75rem;font-size:0.8rem">Cerrar</button></div><p style="color:var(--text-secondary)">Ciudad: ' + (userData.ciudad || 'Sin asignar') + '</p><p style="color:var(--text-secondary)">Rol: ' + userData.rol + '</p><p style="font-size:1.2rem;font-weight:700;margin:0.75rem 0">💷 ' + userData.saldo.toLocaleString('es-CO') + ' £</p>' + (puedeEliminarHistorial ? '<button class="btn btn-secondary btn-full" id="btn-borrar-historial" data-uid="' + uid + '" data-username="' + userData.username + '" style="margin-bottom:0.75rem;border-color:var(--danger);color:var(--danger)">🗑️ Borrar historial</button>' : '') + '<h4 style="margin-bottom:0.5rem">Movimientos</h4><div id="movimientos-admin-' + uid + '"><p style="color:var(--text-secondary)">Cargando...</p></div></div>';
    cargarMovimientosUsuario(uid, 'movimientos-admin-' + uid, uid);
    document.getElementById('btn-cerrar-ver').addEventListener('click', function() {
      document.getElementById('ver-usuario-panel').innerHTML = '';
    });
    if (puedeEliminarHistorial) {
      document.getElementById('btn-borrar-historial').addEventListener('click', async function() {
        var targetUid = this.dataset.uid;
        var targetUsername = this.dataset.username;
        if (!confirm('Borrar todo el historial de ' + targetUsername + '?')) return;
        this.disabled = true; this.textContent = 'Borrando...';
        var q1 = await getDocs(query(collection(db, 'transacciones'), where('de', '==', targetUid)));
        var q2 = await getDocs(query(collection(db, 'transacciones'), where('para', '==', targetUid)));
        var todos = {};
        q1.docs.forEach(function(d) { todos[d.id] = d.ref; });
        q2.docs.forEach(function(d) { todos[d.id] = d.ref; });
        for (var id in todos) { await deleteDoc(todos[id]); }
        document.getElementById('ver-usuario-panel').innerHTML = '<p style="color:var(--success);margin-top:1rem">Historial de ' + targetUsername + ' eliminado</p>';
      });
    }
  });
}
function mostrarEditarSaldo() {
  var panel = document.getElementById('banco-panel');
  var soloCiudad = currentUser.rol === 'regidor';
  panel.innerHTML = '<h3>✏️ Editar saldo</h3><div style="position:relative"><input type="text" id="admin-usuario" placeholder="Buscar usuario..." autocomplete="off"/><div id="admin-lista" class="usuarios-lista"></div></div><div id="admin-saldo-actual" style="color:var(--text-secondary);margin:0.5rem 0;font-size:0.9rem"></div><input type="number" id="admin-saldo-nuevo" placeholder="Nuevo saldo en £" min="0"/><input type="text" id="admin-motivo" placeholder="Motivo del cambio (obligatorio)"/><button class="btn btn-primary btn-full" id="confirmar-editar-saldo">Aplicar cambio</button><div id="admin-error" class="hidden" style="color:var(--danger);margin-top:0.5rem"></div>';
  crearBuscadorUsuarios('admin-usuario', 'admin-lista', null, soloCiudad);
  document.getElementById('admin-usuario').addEventListener('input', async function() {
    var username = this.value.trim().toLowerCase();
    var snap = await getDoc(doc(db, 'usernames', username));
    if (snap.exists()) {
      var uid = snap.data().uid;
      var userSnap = await getDoc(doc(db, 'usuarios', uid));
      if (userSnap.exists()) document.getElementById('admin-saldo-actual').textContent = 'Saldo actual: £' + userSnap.data().saldo.toLocaleString('es-CO');
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
    var userData = userSnap.data();
    if (soloCiudad && userData.ciudad !== currentUser.ciudad) { mostrarErr('No tienes permiso sobre usuarios de otra ciudad'); btn.disabled = false; btn.textContent = 'Aplicar cambio'; return; }
    var saldoAnterior = userData.saldo || 0;
    await updateDoc(doc(db, 'usuarios', uid), { saldo: nuevoSaldo });
    await registrarTransaccion({ tipo: 'ajuste_admin', de: currentUser.uid, deUsername: currentUser.username, para: uid, paraUsername: username, monto: nuevoSaldo, descripcion: 'Saldo editado de £' + saldoAnterior.toLocaleString('es-CO') + ' a £' + nuevoSaldo.toLocaleString('es-CO') + ' por ' + currentUser.username + '. Motivo: ' + motivo, saldoAnterior: saldoAnterior });
    document.getElementById('banco-panel').innerHTML = '<div style="text-align:center;padding:1rem"><p style="font-size:2rem">✅</p><p>Saldo actualizado</p><p style="color:var(--text-secondary)">' + username + ': £' + saldoAnterior.toLocaleString('es-CO') + ' → £' + nuevoSaldo.toLocaleString('es-CO') + '</p><p style="color:var(--text-secondary)">Por: ' + currentUser.username + ' · Motivo: ' + motivo + '</p></div>';
  });
}

function mostrarSumarRestar(tipo) {
  var panel = document.getElementById('banco-panel');
  var soloCiudad = currentUser.rol === 'regidor';
  var titulo = tipo === 'sumar' ? '➕ Sumar dinero' : '➖ Restar dinero';
  panel.innerHTML = '<h3>' + titulo + '</h3><p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.75rem">Puedes seleccionar varios usuarios</p><div style="position:relative"><input type="text" id="sr-usuario-input" placeholder="Buscar y agregar usuario..." autocomplete="off"/><div id="sr-usuario-lista" class="usuarios-lista"></div></div><div id="sr-usuarios-seleccionados" style="margin:0.5rem 0"></div><input type="number" id="sr-monto" placeholder="Monto en £" min="1"/><input type="text" id="sr-motivo" placeholder="Motivo (obligatorio)"/><button class="btn btn-primary btn-full" id="btn-sr-confirmar">Confirmar</button><div id="sr-error" class="hidden" style="color:var(--danger);margin-top:0.5rem"></div>';
  var seleccionados = [];
  crearBuscadorUsuarios('sr-usuario-input', 'sr-usuario-lista', currentUser.username, soloCiudad);
  document.getElementById('sr-usuario-input').addEventListener('change', function() {
    var username = this.value.trim().toLowerCase();
    if (username && !seleccionados.includes(username)) {
      seleccionados.push(username);
      actualizarSeleccionados();
      this.value = '';
    }
  });
  document.querySelectorAll('.usuario-sugerencia').forEach(function(item) {
    item.addEventListener('click', function() {
      var username = item.dataset.username;
      if (!seleccionados.includes(username)) { seleccionados.push(username); actualizarSeleccionados(); }
    });
  });
  function actualizarSeleccionados() {
    var cont = document.getElementById('sr-usuarios-seleccionados');
    if (seleccionados.length === 0) { cont.innerHTML = ''; return; }
    cont.innerHTML = '<p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem">Seleccionados:</p>' + seleccionados.map(function(u) {
      return '<span class="tag-usuario" data-u="' + u + '">' + u + ' ✕</span>';
    }).join('');
    cont.querySelectorAll('.tag-usuario').forEach(function(tag) {
      tag.addEventListener('click', function() {
        seleccionados = seleccionados.filter(function(u) { return u !== tag.dataset.u; });
        actualizarSeleccionados();
      });
    });
  }
  document.getElementById('btn-sr-confirmar').addEventListener('click', async function() {
    var monto = parseInt(document.getElementById('sr-monto').value);
    var motivo = document.getElementById('sr-motivo').value.trim();
    var errorEl = document.getElementById('sr-error');
    function mostrarErr(msg) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
    if (seleccionados.length === 0) return mostrarErr('Agrega al menos un usuario');
    if (!monto || monto <= 0) return mostrarErr('Ingresa un monto valido');
    if (!motivo) return mostrarErr('El motivo es obligatorio');
    var btn = document.getElementById('btn-sr-confirmar');
    btn.disabled = true; btn.textContent = 'Procesando...';
    var cambio = tipo === 'sumar' ? monto : -monto;
    var exitosos = [];
    for (var i = 0; i < seleccionados.length; i++) {
      var username = seleccionados[i];
      var usernameSnap = await getDoc(doc(db, 'usernames', username));
      if (!usernameSnap.exists()) continue;
      var uid = usernameSnap.data().uid;
      var userSnap = await getDoc(doc(db, 'usuarios', uid));
      var userData = userSnap.data();
      if (soloCiudad && userData.ciudad !== currentUser.ciudad) continue;
      await updateDoc(doc(db, 'usuarios', uid), { saldo: increment(cambio) });
      await registrarTransaccion({ tipo: 'ajuste_admin', de: currentUser.uid, deUsername: currentUser.username, para: uid, paraUsername: username, monto: monto, descripcion: (tipo === 'sumar' ? 'Se sumaron' : 'Se restaron') + ' £' + monto.toLocaleString('es-CO') + ' por ' + currentUser.username + '. Motivo: ' + motivo });
      exitosos.push(username);
    }
    document.getElementById('banco-panel').innerHTML = '<div style="text-align:center;padding:1rem"><p style="font-size:2rem">✅</p><p>' + (tipo === 'sumar' ? 'Dinero sumado' : 'Dinero restado') + '</p><p style="color:var(--text-secondary)">£' + monto.toLocaleString('es-CO') + ' ' + (tipo === 'sumar' ? 'sumadas a' : 'restadas de') + ': ' + exitosos.join(', ') + '</p><p style="color:var(--text-secondary)">Por: ' + currentUser.username + ' · Motivo: ' + motivo + '</p></div>';
  });
}

function renderPerfil() {
  var esRegidor = currentUser && currentUser.rol === 'regidor';
  var ciudades = ['Ryazan', 'Ryla', 'Kemerov', 'Navarra'];
  mainContent.innerHTML = '<div class="card"><h3>👤 Mi Perfil</h3><p><strong>Usuario:</strong> ' + (currentUser ? currentUser.username : '') + '</p><p><strong>Rol:</strong> ' + (currentUser ? currentUser.rol : 'jugador') + '</p><p><strong>Ciudad:</strong> ' + (currentUser && currentUser.ciudad ? currentUser.ciudad : 'Sin asignar') + '</p><p><strong>WhatsApp:</strong> ' + (currentUser && currentUser.whatsapp ? currentUser.whatsapp : 'No registrado') + '</p></div>' +

  (!esRegidor ? '<div class="card"><h3>🏙️ Cambiar ciudad</h3><select id="perfil-ciudad"><option value="">Selecciona tu ciudad</option>' + ciudades.map(function(c) { return '<option value="' + c + '"' + (currentUser && currentUser.ciudad === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select><button class="btn btn-primary btn-full" id="btn-guardar-ciudad" style="margin-top:0.75rem">Guardar ciudad</button><div id="ciudad-msg" style="margin-top:0.5rem"></div></div>' : '<div class="card"><h3>🏙️ Ciudad</h3><p style="color:var(--text-secondary)">Los regidores no pueden cambiar su ciudad. Contacta a un administrador.</p></div>') +

  '<div class="card"><h3>📱 Actualizar WhatsApp</h3><input type="tel" id="perfil-whatsapp" placeholder="Numero de WhatsApp" value="' + (currentUser && currentUser.whatsapp ? currentUser.whatsapp : '') + '"/><button class="btn btn-primary btn-full" id="btn-guardar-whatsapp" style="margin-top:0.75rem">Guardar WhatsApp</button><div id="whatsapp-msg" style="margin-top:0.5rem"></div></div>' +

  '<div class="card"><h3>🔑 Cambiar contrasena</h3><input type="password" id="perfil-pass-nueva" placeholder="Nueva contrasena (min 6 caracteres)"/><input type="password" id="perfil-pass-confirmar" placeholder="Confirmar nueva contrasena" style="margin-top:0.5rem"/><button class="btn btn-primary btn-full" id="btn-cambiar-pass" style="margin-top:0.75rem">Cambiar contrasena</button><div id="pass-msg" style="margin-top:0.5rem"></div></div>' +

  '<button class="btn btn-secondary btn-full" id="logout-btn" style="margin-top:0.5rem">Cerrar sesion</button>';

  if (!esRegidor) {
    document.getElementById('btn-guardar-ciudad').addEventListener('click', async function() {
      var ciudad = document.getElementById('perfil-ciudad').value;
      var msg = document.getElementById('ciudad-msg');
      if (!ciudad) { msg.textContent = 'Selecciona una ciudad'; msg.style.color = 'var(--danger)'; return; }
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { ciudad: ciudad });
      currentUser.ciudad = ciudad;
      msg.textContent = 'Ciudad actualizada a ' + ciudad;
      msg.style.color = 'var(--success)';
    });
  }

  document.getElementById('btn-guardar-whatsapp').addEventListener('click', async function() {
    var whatsapp = document.getElementById('perfil-whatsapp').value.trim();
    var msg = document.getElementById('whatsapp-msg');
    if (!whatsapp) { msg.textContent = 'Ingresa un numero'; msg.style.color = 'var(--danger)'; return; }
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { whatsapp: whatsapp });
    currentUser.whatsapp = whatsapp;
    msg.textContent = 'WhatsApp actualizado';
    msg.style.color = 'var(--success)';
  });

  document.getElementById('btn-cambiar-pass').addEventListener('click', async function() {
    var nueva = document.getElementById('perfil-pass-nueva').value;
    var confirmar = document.getElementById('perfil-pass-confirmar').value;
    var msg = document.getElementById('pass-msg');
    if (!nueva || nueva.length < 6) { msg.textContent = 'La contrasena debe tener al menos 6 caracteres'; msg.style.color = 'var(--danger)'; return; }
    if (nueva !== confirmar) { msg.textContent = 'Las contrasenhas no coinciden'; msg.style.color = 'var(--danger)'; return; }
    var btn = document.getElementById('btn-cambiar-pass');
    btn.disabled = true; btn.textContent = 'Cambiando...';
    try {
      var { updatePassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await updatePassword(auth.currentUser, nueva);
      msg.textContent = 'Contrasena cambiada exitosamente';
      msg.style.color = 'var(--success)';
      document.getElementById('perfil-pass-nueva').value = '';
      document.getElementById('perfil-pass-confirmar').value = '';
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
      msg.style.color = 'var(--danger)';
    }
    btn.disabled = false; btn.textContent = 'Cambiar contrasena';
  });

  document.getElementById('logout-btn').addEventListener('click', function() { signOut(auth); });
}

function showError(msg) { loginError.textContent = msg; loginError.classList.remove('hidden'); }
function hideError() { loginError.classList.add('hidden'); }