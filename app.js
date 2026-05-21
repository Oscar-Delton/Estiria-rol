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

const GROQ_API_KEY = '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';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function llamarGroq(mensajes, maxTokens = 1200) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + GROQ_API_KEY
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: mensajes
    })
  });
  if (!response.ok) throw new Error('Error Groq: ' + response.status);
  const data = await response.json();
  return data.choices[0].message.content;
}

const SISTEMA_MISIONES = `Eres el Narrador Supremo de Estiria. Generas misiones épicas y gestionas eventos aleatorios.

════════════════════════════════════
ESCALA DE PRECIOS DEL MUNDO (referencia económica):
════════════════════════════════════
COMIDA:
- Pan: £3-4 | Hamburguesa: £6-8 | Ramen: £8 | Pizza: £12
- Cena de lujo: £30-50

ALOJAMIENTO (compra):
- Departamento pequeño: £1.600-9.600
- Casa pequeña: £11.200-19.200
- Casa grande: £32.000-64.000
- Mansión: £560.000+
- Castillo: £2.400.000+

TERRENOS:
- Terreno básico Estiria: £8.000-13.500
- Terreno premium: £17.000-20.000

MATERIALES:
- Metal Nv1: £13-20/kg
- Metal Nv3: £265-280/kg
- Metal Nv5: £1.800/kg
- Metal Nv6: £20.000-44.000/kg
- Diamante: £2.200-3.200/quilate

SALARIOS DE REFERENCIA (para anclar la economía):
- Barrer calles: £5/tarea
- Guardia: £20 cada 3 días (~£7/día)
- Juez: £30/hora
- Caza animal grande: £8/animal
- Entrega entre ciudades: £20-30/paquete
- Minería de metal raro: £20-40/unidad

════════════════════════════════════
SISTEMA DE NIVELES Y PODER:
════════════════════════════════════
- Nv 1-10: Novato. Fuerza ~17k-26k kg. Subsónico.
- Nv 11-50: Aficionado. ~27k-67k kg. Sónico bajo.
- Nv 51-100: Intermedio bajo. ~68k-116k kg. Sónico medio.
- Nv 101-300: Intermedio. ~116k-310k kg. Hipersónico.
- Nv 301-600: Avanzado. ~310k-590k kg. Mach 200-500.
- Nv 601-1000: Élite. ~590k-980k kg. Mach 500-800.
- Nv 1001-1500: Superior. ~1-1.5M ton. Mach 800-1200.
- Nv 1501-2000: Trascendente. ~1.5-2M ton. Mach 1200-1600.
- Nv 2001-3000: Cósmico bajo. ~2-3M ton. Mach 1600-2400.
- Nv 3001-4500: Cósmico medio. ~3-4.4M ton. Mach 2400-3600.
- Nv 4501-6000: Cósmico alto. ~4.4-5.8M ton. Mach 3600-4900.
- Nv 6001-8000: Primordial. ~5.8-7.7M ton. Mach 4900-6350.
- Nv 8000+: Incalculable.

AURAS Y HABILIDADES: Las stats base son punto de partida. Auras y técnicas activas pueden multiplicar estos valores enormemente. Siempre considéralas al evaluar el poder real del personaje.

════════════════════════════════════
SISTEMA DE RECOMPENSAS — APLICAR SIEMPRE:
════════════════════════════════════

⚠️ TOPE ABSOLUTO E INQUEBRANTABLE: £2.500
⚠️ MÍNIMO ABSOLUTO: £10
Estos límites NO se pueden superar bajo ninguna circunstancia, nivel o dificultad.

─────────────────────────────────────
PASO 1 — RECOMPENSA BASE por dificultad:
─────────────────────────────────────
  Fácil:     £50
  Mediana:   £200
  Difícil:   £600
  Extrema:   £1.200
  Imposible: £2.000

─────────────────────────────────────
PASO 2 — RATIO DE NIVEL:
─────────────────────────────────────
  ratio = nivelMision ÷ nivelPersonaje

  Si nivelMision > nivelPersonaje → ratio = 1.0 (misión más difícil, pago completo)
  Si nivelMision = nivelPersonaje → ratio = 1.0
  Si nivelMision < nivelPersonaje → ratio = nivelMision ÷ nivelPersonaje (fracción)

  Ejemplos:
  · Nv100 hace misión Nv100  → 100÷100 = 1.00 (100% del pago)
  · Nv500 hace misión Nv250  → 250÷500 = 0.50 (50% del pago)
  · Nv3000 hace misión Nv100 → 100÷3000 = 0.033 (3.3% del pago, misión trivial)
  · Nv200 hace misión Nv300  → ratio = 1.0 (misión más dura, pago completo)

─────────────────────────────────────
PASO 3 — MULTIPLICADOR DE LÍNEAS:
─────────────────────────────────────
  Base: 10 líneas = ×1.0
  Cada línea adicional sobre 10 suma +0.1 al multiplicador.

  10 líneas → ×1.0
  15 líneas → ×1.5
  20 líneas → ×2.0
  25 líneas → ×2.5
  30 líneas → ×3.0

─────────────────────────────────────
PASO 4 — FÓRMULA FINAL:
─────────────────────────────────────
  recompensa = BASE × RATIO_NIVEL × MULT_LINEAS
  
  Si resultado > £2.500 → usar £2.500 (TOPE)
  Si resultado < £10    → usar £10   (MÍNIMO)
  Redondear siempre al número entero más cercano.

─────────────────────────────────────
EJEMPLOS OBLIGATORIOS DE REFERENCIA:
─────────────────────────────────────

Nv3000 hace misión Nv100, Difícil, 10 líneas:
  £600 × 0.033 × 1.0 = £19.8 → £20 ✓ (misión trivial, paga miserable)

Nv100 hace misión Nv100, Mediana, 10 líneas:
  £200 × 1.0 × 1.0 = £200 ✓

Nv100 hace misión Nv100, Extrema, 20 líneas:
  £1.200 × 1.0 × 2.0 = £2.400 ✓

Nv500 hace misión Nv250, Difícil, 15 líneas:
  £600 × 0.50 × 1.5 = £450 ✓

Nv1000 hace misión Nv1000, Imposible, 30 líneas:
  £2.000 × 1.0 × 3.0 = £6.000 → TOPE → £2.500 ✓

Nv3000 hace misión Nv2500, Extrema, 20 líneas:
  £1.200 × 0.83 × 2.0 = £1.992 ✓

─────────────────────────────────────
SENTIDO COMÚN ECONÓMICO (ancla de realidad):
─────────────────────────────────────
- Un guardia gana £7/día. Una misión difícil debería valer semanas de trabajo, no años.
- Con £2.500 se puede comprar un terreno básico pequeño. Eso ya es mucho.
- Con £200 se come bien una semana. Con £600 se paga un mes de gastos normales.
- Nunca una misión debe hacer rico a alguien de un golpe. La riqueza se acumula con trabajo.
- Si la recompensa calculada te parece "poca" para el nivel del personaje, recuerda: el personaje poderoso ELIGE misiones de su nivel para ganar bien, no misiones fáciles.

════════════════════════════════════
DIFICULTADES (relativas al poder del personaje):
════════════════════════════════════
- Fácil: Muy por debajo del poder del personaje. Victoria casi automática.
- Mediana: Iguala o supera levemente el poder base. Requiere algo de estrategia.
- Difícil: Supera el poder base. Hay que usar todo el arsenal.
- Extrema: Supera incluso las habilidades avanzadas. Alta probabilidad de derrota parcial.
- Imposible: Solo superable con estrategia perfecta, sacrificios o condiciones muy específicas.

════════════════════════════════════
REGLAS DE MISIONES:
════════════════════════════════════
- Cada misión tiene: título épico, descripción narrativa inmersiva, objetivo claro, recompensa calculada según el sistema anterior, y requisitos de posts y líneas.
- El evento especial ocurre entre el post 60% y 80% del total de posts.
- Los eventos especiales se resuelven con una tirada de D20.
- La narrativa debe reflejar la escala de poder: un Nv3000 no lucha contra bandidos comunes, enfrenta amenazas estelares. Un Nv50 puede enfrentarse a monstruos de aldea.
- El nivelMision es el nivel que el jugador indicó como "nivel de la misión deseada", no su nivel personal.

════════════════════════════════════
FORMATO DE RESPUESTA — SOLO JSON, SIN TEXTO EXTRA:
════════════════════════════════════
{
  "titulo": "...",
  "descripcion": "...",
  "objetivo": "...",
  "dificultadReal": "Fácil/Mediana/Difícil/Extrema/Imposible",
  "recompensaDinero": número (entero, entre 10 y 2500),
  "recompensaObjeto": "...",
  "minMensajes": número,
  "minLineas": número,
  "postEventoEspecial": número,
  "descripcionEventoBase": "En el post [N], algo cambia en la misión...",
  "tablaDice": {
    "critico_fallo": "1-2: ...",
    "fallo": "3-7: ...",
    "neutro": "8-12: ...",
    "exito": "13-18: ...",
    "critico_exito": "19-20: ..."
  }
}`;



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
  var titulos = {
    inicio: 'Inicio', banco: 'Banco', biblioteca: 'Biblioteca',
    perfil: 'Perfil', patrimonio: 'Patrimonio',
    tienda: 'Tienda', casino: 'Casino', citas: 'Citas', misiones: 'Misiones'
  };
  document.getElementById('header-title').textContent = titulos[section] || section;
  switch (section) {
    case 'inicio': renderInicio(); break;
    case 'banco': renderBanco(); break;
    case 'biblioteca': renderBiblioteca(); break;
    case 'perfil': renderPerfil(); break;
    case 'patrimonio': renderPatrimonio(); break;
    case 'tienda': renderTienda(); break;
    case 'casino': renderCasino(); break;
    case 'citas': renderCitas(); break;
    case 'misiones': renderMisiones(); break;
  }
}

function renderInicio() {
  mainContent.innerHTML =
    '<div class="welcome-banner"><h2>Bienvenido a Estiria</h2><p>' + (currentUser ? currentUser.username : 'Ciudadano') + '</p></div>' +
    '<div class="inicio-grid">' +
      '<button class="inicio-card" id="inicio-tienda"><span class="inicio-icon">🛒</span><span class="inicio-label">Tienda</span></button>' +
      '<button class="inicio-card" id="inicio-casino"><span class="inicio-icon">🎰</span><span class="inicio-label">Casino</span></button>' +
      '<button class="inicio-card" id="inicio-citas"><span class="inicio-icon">💘</span><span class="inicio-label">Citas</span></button>' +
      '<button class="inicio-card" id="inicio-misiones"><span class="inicio-icon">⚔️</span><span class="inicio-label">Misiones</span></button>' +
    '</div>' +
    '<div class="card"><h3>📢 Anuncios</h3><p>Proximamente...</p></div>' +
    '<div class="card"><h3>📅 Eventos</h3><p>Proximamente...</p></div>';

  document.getElementById('inicio-tienda').addEventListener('click', function() { navigateTo('tienda'); });
  document.getElementById('inicio-casino').addEventListener('click', function() { navigateTo('casino'); });
  document.getElementById('inicio-citas').addEventListener('click', function() { navigateTo('citas'); });
  document.getElementById('inicio-misiones').addEventListener('click', function() { navigateTo('misiones'); });
}

function setNav(section) {
  navBtns.forEach(function(b) { b.classList.remove('active'); });
  var btn = document.querySelector('.nav-btn[data-section="' + section + '"]');
  if (btn) btn.classList.add('active');
}

function renderBiblioteca() {
  var userRol = (currentUser && currentUser.rol) ? currentUser.rol.toLowerCase() : '';
  
  var esBibliotecario = userRol === 'dev' || userRol === 'lider_suprema' || userRol === 'bibliotecario';
  var esSuperior = userRol === 'dev' || userRol === 'lider_suprema';

  mainContent.innerHTML =
    '<div class="card biblioteca-header">' +
      '<h3>📚 Biblioteca de Estiria</h3>' +
      '<p style="color:var(--text-secondary);font-size:0.85rem">Selecciona una categoría</p>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-cat="Historia"><span>📜</span><span>Historia</span></button>' +
      '<button class="categoria-btn" data-cat="Bestiarios"><span>🐉</span><span>Bestiarios</span></button>' +
      '<button class="categoria-btn" data-cat="Divulgación Científica"><span>🔬</span><span>Divulgación Científica</span></button>' +
      '<button class="categoria-btn" data-cat="Leyes"><span>⚖️</span><span>Leyes</span></button>' +
    '</div>' +
    '<div id="biblioteca-panel"></div>';

  mainContent.querySelectorAll('.categoria-btn[data-cat]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      renderBibliotecaCategoria(btn.dataset.cat, esBibliotecario, esSuperior);
    });
  });
}

function renderBibliotecaCategoria(categoria, esBibliotecario, esSuperior) {
  var panel = document.getElementById('biblioteca-panel');
  var iconos = {
    'Historia': '📜', 'Bestiarios': '🐉',
    'Divulgación Científica': '🔬', 'Leyes': '⚖️'
  };

  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-biblioteca">← Biblioteca</button>' +
      '<h3>' + (iconos[categoria] || '📚') + ' ' + categoria + '</h3>' +
    '</div>' +
    '<div id="subcats-lista"><p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">Cargando...</p></div>' +
    (esBibliotecario
      ? '<button class="btn btn-secondary btn-full" id="btn-nueva-subcat" style="margin-top:0.75rem">+ Nueva subcategoría</button>'
      : '') +
    '<div id="biblioteca-form"></div>';

  document.getElementById('back-biblioteca').addEventListener('click', function() {
    panel.innerHTML = '';
  });

  cargarSubcategorias(categoria, esBibliotecario, esSuperior);

  var btnNueva = document.getElementById('btn-nueva-subcat');
  if (btnNueva) {
    btnNueva.addEventListener('click', function() {
      mostrarFormNuevaSubcat(categoria, esSuperior);
    });
  }
}

function cargarSubcategorias(categoria, esBibliotecario, esSuperior) {
  var lista = document.getElementById('subcats-lista');
  if (!lista) return;

  onSnapshot(
    query(
      collection(db, 'biblioteca_subcats'), 
      where('categoria', '==', categoria), 
      orderBy('creadoEn', 'desc')
    ),
    function(snap) {
      if (snap.empty) { 
        lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">No hay subcategorías aún.</p>'; 
        return; 
      }

      lista.innerHTML = snap.docs.map(function(d) {
        var subcat = d.data();
        var imagenHTML = subcat.imagen 
          ? '<img src="' + subcat.imagen + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover" />'
          : '<span style="font-size:1.5rem">📂</span>';

        return '<div class="doc-item" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:var(--bg-card);border-radius:10px;margin-bottom:0.5rem">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex:1">' +
            imagenHTML +
            '<div>' +
              '<p class="doc-titulo" style="font-weight:600;margin:0;font-size:0.9rem">' + subcat.titulo + '</p>' +
              '<p class="doc-meta" style="font-size:0.75rem;color:var(--text-secondary);margin:0">' + subcat.descripcion + '</p>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:0.4rem;align-items:center">' +
            '<button class="btn-subcat-entrar btn" data-id="' + d.id + '" data-titulo="' + subcat.titulo + '" style="padding:0.4rem 0.8rem;font-size:0.8rem">Entrar</button>' +
            (esSuperior ? '<button class="btn-subcat-borrar" data-id="' + d.id + '" style="background:none;border:none;color:var(--danger);font-size:1.1rem;cursor:pointer;padding:0.2rem">🗑️</button>' : '') +
          '</div>' +
        '</div>';
      }).join('');

      lista.querySelectorAll('.btn-subcat-entrar').forEach(function(btn) {
        btn.addEventListener('click', function() {
          renderContenidoSubcat(btn.dataset.id, btn.dataset.titulo, categoria, esBibliotecario, esSuperior);
        });
      });

      if (esSuperior) {
        lista.querySelectorAll('.btn-subcat-borrar').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            if (!confirm('¿Borrar esta subcategoría y todo su contenido?')) return;
            await deleteDoc(doc(db, 'biblioteca_subcats', btn.dataset.id));
          });
        });
      }
    },
    function(error) {
      console.error("Error al cargar subcategorías:", error);
      lista.innerHTML = '<p style="color:var(--danger);font-size:0.85rem;text-align:center;padding:1rem">Error al cargar datos.</p>';
    }
  );
}

function mostrarFormNuevaSubcat(categoria, esSuperior) {
  var form = document.getElementById('biblioteca-form');
  form.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.75rem">Nueva subcategoría</h3>' +
      '<input type="text" id="nueva-subcat-titulo" placeholder="Título de la subcategoría" />' +
      '<textarea id="nueva-subcat-desc" placeholder="Breve descripción..." style="margin-top:0.5rem;min-height:80px;resize:vertical"></textarea>' +
      '<input type="url" id="nueva-subcat-img" placeholder="URL de imagen (opcional)" style="margin-top:0.5rem" />' +
      '<button class="btn btn-primary btn-full" id="btn-guardar-subcat" style="margin-top:0.75rem">Guardar subcategoría</button>' +
      '<div id="subcat-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  form.querySelectorAll('input, textarea').forEach(function(el) {
    el.style.cssText = 'width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block';
  });

  document.getElementById('btn-guardar-subcat').addEventListener('click', async function() {
    var titulo = document.getElementById('nueva-subcat-titulo').value.trim();
    var desc = document.getElementById('nueva-subcat-desc').value.trim();
    var img = document.getElementById('nueva-subcat-img').value.trim();
    var msg = document.getElementById('subcat-msg');
    if (!titulo) { msg.textContent = 'El título es obligatorio'; msg.style.color = 'var(--danger)'; return; }
    if (!desc) { msg.textContent = 'La descripción es obligatoria'; msg.style.color = 'var(--danger)'; return; }

    var btn = document.getElementById('btn-guardar-subcat');
    btn.disabled = true; btn.textContent = 'Guardando...';

    try {
      var existSnap = await getDocs(query(collection(db, 'biblioteca_subcats'), where('categoria', '==', categoria), where('titulo', '==', titulo)));
      if (!existSnap.empty) { 
        msg.textContent = 'Ya existe una subcategoría con ese nombre'; 
        msg.style.color = 'var(--danger)'; 
        btn.disabled = false; 
        btn.textContent = 'Guardar subcategoría'; 
        return; 
      }

      await addDoc(collection(db, 'biblioteca_subcats'), {
        categoria: categoria,
        titulo: titulo,
        descripcion: desc,
        imagen: img || '',
        creadoEn: new Date().toISOString(),
        creadoPor: currentUser.username
      });

      msg.textContent = '✓ Subcategoría creada'; msg.style.color = 'var(--success)';
      document.getElementById('nueva-subcat-titulo').value = '';
      document.getElementById('nueva-subcat-desc').value = '';
      document.getElementById('nueva-subcat-img').value = '';
      btn.disabled = false; btn.textContent = 'Guardar subcategoría';

      setTimeout(function() {
        var userRol = (currentUser && currentUser.rol) ? currentUser.rol.toLowerCase() : '';
        var esBibliotecario = userRol === 'dev' || userRol === 'lider_suprema' || userRol === 'bibliotecario';
        var esSuperior = userRol === 'dev' || userRol === 'lider_suprema';

        form.innerHTML = '';
        renderBibliotecaCategoria(categoria, esBibliotecario, esSuperior);
      }, 1500);

    } catch (error) {
      console.error("Error en Firestore:", error);
      msg.textContent = 'Error: ' + error.message;
      msg.style.color = 'var(--danger)';
      btn.disabled = false; 
      btn.textContent = 'Guardar subcategoría';
    }
  });
}

function renderContenidoSubcat(subcatId, subcatTitulo, categoria, esBibliotecario, esSuperior) {
  var panel = document.getElementById('biblioteca-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-subcat-lista">← ' + categoria + '</button>' +
      '<h3>📂 ' + subcatTitulo + '</h3>' +
    '</div>' +
    '<div id="docs-lista"><p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">Cargando...</p></div>' +
    (esBibliotecario
      ? '<div class="categorias-grid" style="margin-top:0.75rem; grid-template-columns: 1fr 1fr; gap: 0.5rem;">' +
          '<button class="btn btn-primary" id="btn-subir-pdf-doc" style="font-size:0.85rem; padding:0.6rem 0.5rem;">📄 Enlazar PDF</button>' +
          '<button class="btn btn-primary" id="btn-escribir-libro-doc" style="font-size:0.85rem; padding:0.6rem 0.5rem;">📖 Escribir Libro</button>' +
        '</div>'
      : '') +
    '<div id="doc-form"></div>';

  document.getElementById('back-subcat-lista').addEventListener('click', function() {
    renderBibliotecaCategoria(categoria, esBibliotecario, esSuperior);
  });

  cargarDocumentosSubcat(subcatId, esBibliotecario, esSuperior);

  if (esBibliotecario) {
    // Opción 1: Enlazar un PDF de Drive a esta subcategoría
    document.getElementById('btn-subir-pdf-doc').addEventListener('click', function() {
      mostrarFormSubirDocumento(subcatId, subcatTitulo, categoria, esBibliotecario, esSuperior);
    });

    // Opción 2: Abrir el editor manual para redactar un libro en esta subcategoría
    document.getElementById('btn-escribir-libro-doc').addEventListener('click', function() {
      // Le pasamos el subcatId para saber a dónde pertenece el nuevo libro
      mostrarEditorLibro(null, null, subcatId); 
    });
  }
}

function cargarDocumentosSubcat(subcatId, esBibliotecario, esSuperior) {
  var lista = document.getElementById('docs-lista');
  onSnapshot(
    query(collection(db, 'biblioteca_docs'), where('subcatId', '==', subcatId), orderBy('creadoEn', 'desc')),
    function(snap) {
      if (!lista) return;
      if (snap.empty) {
        lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">No hay documentos aún.</p>';
        return;
      }
      lista.innerHTML = snap.docs.map(function(d) {
        var doc2 = d.data();
        return '<div class="doc-item">' +
          '<div class="doc-info">' +
            '<p class="doc-titulo">📄 ' + doc2.titulo + '</p>' +
            '<p class="doc-meta">Por ' + doc2.autor + ' · ' + new Date(doc2.creadoEn).toLocaleDateString('es-CO') + '</p>' +
          '</div>' +
          '<button class="btn-doc-ver" data-id="' + d.id + '">Ver</button>' +
        '</div>';
      }).join('');

      lista.querySelectorAll('.btn-doc-ver').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var snap2 = await getDoc(doc(db, 'biblioteca_docs', btn.dataset.id));
          if (snap2.exists()) mostrarDocumento(snap2.data(), btn.dataset.id, esBibliotecario, esSuperior);
        });
      });
    }
  );
}

function mostrarFormSubirDocumento(subcatId, subcatTitulo, categoria, esBibliotecario, esSuperior) {
  var form = document.getElementById('doc-form');
  form.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.75rem">Subir documento</h3>' +
      '<input type="text" id="doc-titulo" placeholder="Título del documento" />' +
      '<input type="url" id="doc-pdf-url" placeholder="URL del PDF (Google Drive)" style="margin-top:0.5rem" />' +
      '<p style="color:var(--text-secondary);font-size:0.78rem;margin:0.3rem 0 0.75rem">Comparte el PDF en Drive como público y pega el enlace aquí</p>' +
      '<button class="btn btn-primary btn-full" id="btn-guardar-doc">Subir documento</button>' +
      '<div id="doc-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  form.querySelectorAll('input').forEach(function(el) {
    el.style.cssText = 'width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block';
  });

  document.getElementById('btn-guardar-doc').addEventListener('click', async function() {
    var titulo = document.getElementById('doc-titulo').value.trim();
    var url = document.getElementById('doc-pdf-url').value.trim();
    var msg = document.getElementById('doc-msg');
    if (!titulo) { msg.textContent = 'El título es obligatorio'; msg.style.color = 'var(--danger)'; return; }
    if (!url) { msg.textContent = 'La URL es obligatoria'; msg.style.color = 'var(--danger)'; return; }
    var btn = document.getElementById('btn-guardar-doc');
    btn.disabled = true; btn.textContent = 'Subiendo...';
    await addDoc(collection(db, 'biblioteca_docs'), {
      subcatId: subcatId,
      titulo: titulo,
      url: url,
      tipo: 'pdf',
      autor: currentUser.username,
      autorUid: currentUser.uid,
      creadoEn: new Date().toISOString()
    });
    msg.textContent = '✓ Documento subido'; msg.style.color = 'var(--success)';
    btn.disabled = false; btn.textContent = 'Subir documento';
    form.innerHTML = '';
  });
}

function mostrarDocumento(datos, docId, esBibliotecario, esSuperior) {
  var puedeEditar = esSuperior || datos.autorUid === currentUser.uid;
  var panel = document.getElementById('biblioteca-panel');

  // Convertir URL de Drive a embed
  var embedUrl = datos.url;
  if (embedUrl && embedUrl.includes('drive.google.com')) {
    var fileId = embedUrl.match(/[-\w]{25,}/);
    if (fileId) embedUrl = 'https://drive.google.com/file/d/' + fileId[0] + '/preview';
  }

  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-doc">← Atrás</button>' +
      '<h3>📄 ' + datos.titulo + '</h3>' +
    '</div>' +
    '<p style="color:var(--text-secondary);font-size:0.78rem;margin-bottom:0.75rem">Por ' + datos.autor + '</p>' +
    (datos.tipo === 'pdf'
      ? '<iframe src="' + embedUrl + '" class="biblioteca-iframe"></iframe>'
      : '<div class="libro-render">' + renderizarTextoLibro(datos.contenido || '') + '</div>'
    ) +
    (puedeEditar
      ? '<button class="btn btn-secondary btn-full" id="btn-borrar-doc" style="margin-top:1rem;border-color:var(--danger);color:var(--danger)">🗑️ Eliminar documento</button>'
      : '');

  document.getElementById('back-doc').addEventListener('click', function() {
    history.back();
    renderBiblioteca();
  });

  if (puedeEditar) {
    document.getElementById('btn-borrar-doc').addEventListener('click', async function() {
      if (!confirm('¿Eliminar este documento?')) return;
      await deleteDoc(doc(db, 'biblioteca_docs', docId));
      renderBiblioteca();
    });
  }
}

function cargarPDFs(esBibliotecario, esSuperior) {
  var lista = document.getElementById('subcats-lista');
  onSnapshot(
    query(collection(db, 'biblioteca_docs'), where('tipo', '==', 'pdf'), where('subcatId', '==', 'general'), orderBy('creadoEn', 'desc')),
    function(snap) {
      if (!lista) return;
      if (snap.empty) { lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">No hay PDFs aún.</p>'; return; }
      lista.innerHTML = snap.docs.map(function(d) {
        var doc2 = d.data();
        return '<div class="doc-item"><div class="doc-info"><p class="doc-titulo">📄 ' + doc2.titulo + '</p><p class="doc-meta">Por ' + doc2.autor + '</p></div><button class="btn-doc-ver" data-id="' + d.id + '">Ver</button></div>';
      }).join('');
      lista.querySelectorAll('.btn-doc-ver').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var snap2 = await getDoc(doc(db, 'biblioteca_docs', btn.dataset.id));
          if (snap2.exists()) mostrarDocumento(snap2.data(), btn.dataset.id, esBibliotecario, esSuperior);
        });
      });
    }
  );
}

function mostrarFormSubirPDF() {
  var form = document.getElementById('biblioteca-form');
  form.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.75rem">Subir PDF general</h3>' +
      '<input type="text" id="pdf-titulo" placeholder="Título del PDF" />' +
      '<input type="url" id="pdf-url" placeholder="URL del PDF (Google Drive)" style="margin-top:0.5rem" />' +
      '<button class="btn btn-primary btn-full" id="btn-guardar-pdf" style="margin-top:0.75rem">Subir PDF</button>' +
      '<div id="pdf-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  form.querySelectorAll('input').forEach(function(el) {
    el.style.cssText = 'width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block';
  });

  document.getElementById('btn-guardar-pdf').addEventListener('click', async function() {
    var titulo = document.getElementById('pdf-titulo').value.trim();
    var url = document.getElementById('pdf-url').value.trim();
    var msg = document.getElementById('pdf-msg');
    if (!titulo || !url) { msg.textContent = 'Completa todos los campos'; msg.style.color = 'var(--danger)'; return; }
    var btn = document.getElementById('btn-guardar-pdf');
    btn.disabled = true; btn.textContent = 'Subiendo...';
    await addDoc(collection(db, 'biblioteca_docs'), {
      subcatId: 'general', titulo: titulo, url: url, tipo: 'pdf',
      autor: currentUser.username, autorUid: currentUser.uid, creadoEn: new Date().toISOString()
    });
    msg.textContent = '✓ PDF subido'; msg.style.color = 'var(--success)';
    btn.disabled = false; btn.textContent = 'Subir PDF';
    form.innerHTML = '';
  });
}

function cargarLibros(esBibliotecario, esSuperior) {
  var lista = document.getElementById('subcats-lista');
  onSnapshot(
    query(collection(db, 'biblioteca_docs'), where('tipo', '==', 'libro'), orderBy('creadoEn', 'desc')),
    function(snap) {
      if (!lista) return;
      if (snap.empty) { lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">No hay libros aún.</p>'; return; }
      lista.innerHTML = snap.docs.map(function(d) {
        var doc2 = d.data();
        return '<div class="doc-item"><div class="doc-info"><p class="doc-titulo">📖 ' + doc2.titulo + '</p><p class="doc-meta">Por ' + doc2.autor + '</p></div><button class="btn-doc-ver" data-id="' + d.id + '">Leer</button></div>';
      }).join('');
      lista.querySelectorAll('.btn-doc-ver').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var snap2 = await getDoc(doc(db, 'biblioteca_docs', btn.dataset.id));
          if (snap2.exists()) mostrarDocumento(snap2.data(), btn.dataset.id, esBibliotecario, esSuperior);
        });
      });
    }
  );
}

function mostrarEditorLibro(docId, datosExistentes, subcatId) {
  var panel = document.getElementById('biblioteca-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-editor">← Biblioteca</button>' +
      '<h3>✍️ ' + (docId ? 'Editar libro' : 'Nuevo libro') + '</h3>' +
    '</div>' +
    '<input type="text" id="libro-titulo" placeholder="Título del libro" value="' + (datosExistentes ? datosExistentes.titulo : '') + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;margin-bottom:0.5rem" />' +
    '<div class="editor-toolbar">' +
      '<button class="editor-btn" data-formato="**">B</button>' +
      '<button class="editor-btn" data-formato="_"><i>I</i></button>' +
      '<button class="editor-btn" data-formato="">⌨️</button>' +
      '<button class="editor-btn" data-formato="#" data-tipo="titulo">#T</button>' +
      '<button class="editor-btn" data-formato=">">❝</button>' +
      '<button class="editor-btn" data-tipo="imagen">🖼️</button>' +
    '</div>' +
    '<textarea id="libro-contenido" placeholder="Escribe aquí tu libro...\n\n*negrita* _cursiva_ #título# \`\`\`monoespacio\`\`\` > cita" style="width:100%;min-height:300px;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;resize:vertical;margin-top:0.5rem">' + (datosExistentes ? datosExistentes.contenido : '') + '</textarea>' +
    '<div class="editor-preview-wrap">' +
      '<p style="font-size:0.78rem;color:var(--text-secondary);margin:0.75rem 0 0.3rem">Vista previa:</p>' +
      '<div id="libro-preview" class="libro-render"></div>' +
    '</div>' +
    '<button class="btn btn-primary btn-full" id="btn-publicar-libro" style="margin-top:0.75rem">' + (docId ? '💾 Guardar cambios' : '📖 Publicar libro') + '</button>' +
    '<div id="libro-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>';

  document.getElementById('back-editor').addEventListener('click', function() { renderBiblioteca(); });

  // Preview en tiempo real
  document.getElementById('libro-contenido').addEventListener('input', function() {
    document.getElementById('libro-preview').innerHTML = renderizarTextoLibro(this.value);
  });

  if (datosExistentes) {
    document.getElementById('libro-preview').innerHTML = renderizarTextoLibro(datosExistentes.contenido || '');
  }

  // Botones de formato
  document.querySelectorAll('.editor-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var textarea = document.getElementById('libro-contenido');
      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      var seleccion = textarea.value.substring(start, end);
      var formato = btn.dataset.formato;
      var tipo = btn.dataset.tipo;
      var insertar = '';

      if (tipo === 'imagen') {
        var url = prompt('URL de la imagen:');
        if (!url) return;
        // CORREGIDO: Usamos comillas invertidas (Template Literals) para saltos de línea
        insertar = `
![imagen](${url})
`;
        textarea.value = textarea.value.substring(0, start) + insertar + textarea.value.substring(end);
      } else if (tipo === 'titulo') {
        insertar = '#' + (seleccion || 'Título') + '#';
        textarea.value = textarea.value.substring(0, start) + insertar + textarea.value.substring(end);
      } else if (formato === '') {
        insertar = '' + (seleccion || 'código') + '';
        textarea.value = textarea.value.substring(0, start) + insertar + textarea.value.substring(end);
      } else if (formato === '>') {
        insertar = '> ' + (seleccion || 'cita');
        textarea.value = textarea.value.substring(0, start) + insertar + textarea.value.substring(end);
      } else {
        insertar = formato + (seleccion || 'texto') + formato;
        textarea.value = textarea.value.substring(0, start) + insertar + textarea.value.substring(end);
      }
      document.getElementById('libro-preview').innerHTML = renderizarTextoLibro(textarea.value);
    });
  });

  document.getElementById('btn-publicar-libro').addEventListener('click', async function() {
    var titulo = document.getElementById('libro-titulo').value.trim();
    var contenido = document.getElementById('libro-contenido').value.trim();
    var msg = document.getElementById('libro-msg');
    if (!titulo) { msg.textContent = 'El título es obligatorio'; msg.style.color = 'var(--danger)'; return; }
    if (!contenido) { msg.textContent = 'El contenido no puede estar vacío'; msg.style.color = 'var(--danger)'; return; }
    var btn = document.getElementById('btn-publicar-libro');
    btn.disabled = true; btn.textContent = 'Publicando...';
    if (docId) {
      await updateDoc(doc(db, 'biblioteca_docs', docId), { titulo: titulo, contenido: contenido, editadoEn: new Date().toISOString() });
    } else {
      await addDoc(collection(db, 'biblioteca_docs'), {
        subcatId: subcatId || 'general',
        titulo: titulo, 
        contenido: contenido, 
        tipo: 'libro',
        autor: currentUser.username, 
        autorUid: currentUser.uid, 
        creadoEn: new Date().toISOString()
      });
    }
    msg.textContent = '✓ ' + (docId ? 'Cambios guardados' : 'Libro publicado');
    msg.style.color = 'var(--success)';
    btn.disabled = false; btn.textContent = docId ? '💾 Guardar cambios' : '📖 Publicar libro';
  });
}

function renderizarTextoLibro(texto) {
  if (!texto) return '';
  var lineas = texto.split('\n');
  var html = lineas.map(function(linea) {
    // Cita (> al inicio)
    if (linea.startsWith('> ')) {
      var contenidoCita = linea.substring(2);
      contenidoCita = aplicarFormatos(contenidoCita);
      return '<div class="libro-cita">' + contenidoCita + '</div>';
    }
    linea = aplicarFormatos(linea);
    return '<p class="libro-parrafo">' + linea + '</p>';
  }).join('');
  return html;
}

function aplicarFormatos(texto) {
  texto = texto.replace(/#([^#]+)#/g, '<span class="libro-titulo">$1</span>');
  texto = texto.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  texto = texto.replace(/_([^_]+)_/g, '<em>$1</em>');
  texto = texto.replace(/`([^`]+)`/g, '<code class="libro-code">$1</code>');
  texto = texto.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" class="libro-img" alt="$1" />');
  return texto;
}

// ===== TIENDA =====
var carrito = [];

function renderTienda() {
  mainContent.innerHTML =
    '<div class="tienda-header card">' +
      '<h3>🛒 Tienda de Estiria</h3>' +
      '<p style="color:var(--text-secondary);font-size:0.85rem">Selecciona una nación o la sección de viajes</p>' +
    '</div>' +
    '<div class="tienda-naciones">' +
      '<button class="tienda-nacion-btn" id="tn-estiria"><span>🏛️</span><span>Estiria</span></button>' +
      '<button class="tienda-nacion-btn" id="tn-irkustk"><span>🕌</span><span>Irkustk</span></button>' +
      '<button class="tienda-nacion-btn" id="tn-gresit"><span>🏦</span><span>Gresit</span></button>'+
      '<button class="tienda-nacion-btn proximamente-btn"><span>🌙</span><span>Odrekao</span><span class="prox-tag">Próx.</span></button>' +
    '</div>' +
    '<button class="btn-viajes" id="btn-viajes">✈️ Viajes</button>' +
    '<div id="tienda-panel"></div>' +
    '<div id="carrito-flotante" class="carrito-flotante hidden">' +
      '<button id="btn-ver-carrito">🛒 Ver carrito (<span id="carrito-count">0</span>)</button>' +
    '</div>';

  document.getElementById('tn-estiria').addEventListener('click', function() { renderCategoriasEstiria(); });
  document.getElementById('tn-gresit').addEventListener('click', function() { renderCategoriasGresit(); });
  document.getElementById('tn-irkustk').addEventListener('click', function() { renderCategoriasIrkustk(); });
  document.getElementById('btn-viajes').addEventListener('click', function() { renderViajes(); });
}

function renderCategoriasEstiria() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-naciones">← Naciones</button>' +
      '<h3>🏛️ Estiria</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" id="cat-comida"><span>🍽️</span><span>Comida</span></button>' +
      '<button class="categoria-btn" id="cat-terrenos"><span>🏔️</span><span>Terrenos</span></button>' +
      '<button class="categoria-btn" id="cat-construcciones"><span>🏠</span><span>Construcciones</span></button>' +
      '<button class="categoria-btn" id="cat-armas"><span>⚔️</span><span>Mat. Armas</span></button>' +
    '</div>';

  document.getElementById('back-naciones').addEventListener('click', function() {
    document.getElementById('tienda-panel').innerHTML = '';
  });
  document.getElementById('cat-comida').addEventListener('click', function() { renderSubcategoriasComida(); });
  document.getElementById('cat-terrenos').addEventListener('click', function() { renderTerrenos(); });
  document.getElementById('cat-construcciones').addEventListener('click', function() { renderSubcategoriasConst(); });
  document.getElementById('cat-armas').addEventListener('click', function() { renderSubcategoriasArmas(); });
}

function renderSubcategoriasComida() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-estiria-comida">← Estiria</button>' +
      '<h3>🍽️ Comida</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="lacteos"><span>🥛</span><span>Lácteos</span></button>' +
      '<button class="categoria-btn" data-sub="varios"><span>🧂</span><span>Varios</span></button>' +
      '<button class="categoria-btn" data-sub="preparados"><span>🍔</span><span>Preparados</span></button>' +
      '<button class="categoria-btn" data-sub="bebidas"><span>🧃</span><span>Bebidas</span></button>' +
      '<button class="categoria-btn" data-sub="frutas"><span>🍎</span><span>Frutas</span></button>' +
      '<button class="categoria-btn" data-sub="panaderia"><span>🍞</span><span>Panadería</span></button>' +
      '<button class="categoria-btn" data-sub="postres"><span>🍰</span><span>Postres</span></button>' +
    '</div>';

  document.getElementById('back-estiria-comida').addEventListener('click', function() { renderCategoriasEstiria(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('comida', btn.dataset.sub); });
  });
}

function renderSubcategoriasConst() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-estiria-const">← Estiria</button>' +
      '<h3>🏠 Construcciones</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="casas"><span>🏡</span><span>Casas</span></button>' +
      '<button class="categoria-btn" data-sub="materiales"><span>🧱</span><span>Materiales</span></button>' +
    '</div>';

  document.getElementById('back-estiria-const').addEventListener('click', function() { renderCategoriasEstiria(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('construcciones', btn.dataset.sub); });
  });
}
function renderSubcategoriasArmas() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-estiria-armas">← Estiria</button>' +
      '<h3>⚔️ Materiales para Armas</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="metales_armas"><span>🔩</span><span>Metales</span></button>' +
      '<button class="categoria-btn" data-sub="preciosos"><span>💎</span><span>Preciosos</span></button>' +
    '</div>';

  document.getElementById('back-estiria-armas').addEventListener('click', function() { renderCategoriasEstiria(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('armas', btn.dataset.sub); });
  });
}

function renderProductos(categoria, subcategoria) {
  var productos = getCatalogo(categoria, subcategoria);
  var panel = document.getElementById('tienda-panel');

  var nombreSub = {
    lacteos: '🥛 Lácteos', varios: '🧂 Varios', preparados: '🍔 Preparados',
    bebidas: '🧃 Bebidas', frutas: '🍎 Frutas', panaderia: '🍞 Panadería',
    postres: '🍰 Postres', casas: '🏡 Casas', materiales: '🧱 Materiales',
    metales_armas: '🔩 Metales', preciosos: '💎 Preciosos'
  };

  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-subcat">← Atrás</button>' +
      '<h3>' + (nombreSub[subcategoria] || subcategoria) + '</h3>' +
    '</div>' +
    '<div class="productos-lista" id="productos-lista">' +
      productos.map(function(p, i) {
        return '<div class="producto-item">' +
          '<div class="producto-info">' +
            '<p class="producto-nombre">' + p.emoji + ' ' + p.nombre + '</p>' +
            '<p class="producto-precio">£' + p.precio.toLocaleString('es-CO') + (p.unidad ? ' / ' + p.unidad : '') + '</p>' +
          '</div>' +
          '<div class="producto-cantidad">' +
            '<button class="btn-cantidad" data-i="' + i + '" data-action="minus">−</button>' +
            '<span class="cantidad-valor" id="qty-' + i + '">0</span>' +
            '<button class="btn-cantidad" data-i="' + i + '" data-action="plus">+</button>' +
          '</div>' +
          '<button class="btn-agregar" data-i="' + i + '">Añadir</button>' +
        '</div>';
      }).join('') +
    '</div>';

  document.getElementById('back-subcat').addEventListener('click', function() {
    if (categoria === 'comida') renderSubcategoriasComida();
    else if (categoria === 'construcciones') renderSubcategoriasConst();
    else if (categoria === 'armas') renderSubcategoriasArmas();
    else if (categoria === 'gresit') renderSubcategoriasComidaGresit();
    else if (categoria === 'irkustk') renderSubcategoriasComidaIrkustk();
  });

  panel.querySelectorAll('.btn-cantidad').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var i = parseInt(btn.dataset.i);
      var el = document.getElementById('qty-' + i);
      var val = parseInt(el.textContent);
      if (btn.dataset.action === 'plus') el.textContent = val + 1;
      else if (val > 0) el.textContent = val - 1;
    });
  });

  panel.querySelectorAll('.btn-agregar').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var i = parseInt(btn.dataset.i);
      var qty = parseInt(document.getElementById('qty-' + i).textContent);
      if (qty === 0) return;
      var p = productos[i];
      var existe = carrito.findIndex(function(c) { return c.nombre === p.nombre && c.categoria === subcategoria; });
      if (existe >= 0) carrito[existe].cantidad += qty;
      else carrito.push({ nombre: p.nombre, emoji: p.emoji, precio: p.precio, cantidad: qty, categoria: subcategoria, unidad: p.unidad || '' });
      document.getElementById('qty-' + i).textContent = '0';
      actualizarCarritoFlotante();
      btn.textContent = '✓';
      setTimeout(function() { btn.textContent = 'Añadir'; }, 1000);
    });
  });
}

function renderTerrenos() {
  var panel = document.getElementById('tienda-panel');
  var tamanos = [
    { m2: '300', precio: 8000 }, { m2: '500', precio: 10000 },
    { m2: '700', precio: 11500 }, { m2: '1.000', precio: 13500 },
    { m2: '2.000', precio: 14500 }, { m2: '3.500', precio: 17000 },
    { m2: '7.000', precio: 18500 }, { m2: '10.000', precio: 20000 }
  ];
  var zonas = {
    'Ryla': ['Canteras oscuras', 'Cerca de los bosques espinosos', 'Estepa de Ryla', 'Llanuras frías de Ryla'],
    'Ryazan': ['Bosque omni', 'Playas costeras', 'Meseta', 'La gran Taiga de Ryazan'],
    'Kemerov': ['Llanuras fértiles de Kemerov', 'Estepa de Kemerov', 'Zona comercial: Noxus', 'Zona costera: Kattegat'],
    'Navarra': ['Navarra terreno 1', 'Navarra terreno 2', 'Navarra terreno 3', 'Navarra terreno 4']
  };

  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-terrenos">← Estiria</button>' +
      '<h3>🏔️ Terrenos</h3>' +
    '</div>' +
    '<p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:0.75rem">Selecciona tamaño, zona y cantidad. Puedes añadir varios.</p>' +
    '<div id="terrenos-form">' +
      '<label class="form-label">Tamaño del terreno</label>' +
      '<select id="terreno-tamano" class="tienda-select">' +
        '<option value="">Selecciona tamaño...</option>' +
        tamanos.map(function(t) { return '<option value="' + t.precio + '" data-m2="' + t.m2 + '">' + t.m2 + ' m² — £' + t.precio.toLocaleString('es-CO') + '</option>'; }).join('') +
      '</select>' +
      '<label class="form-label" style="margin-top:0.75rem">Ciudad</label>' +
      '<select id="terreno-ciudad" class="tienda-select">' +
        '<option value="">Selecciona ciudad...</option>' +
        Object.keys(zonas).map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') +
      '</select>' +
      '<label class="form-label" style="margin-top:0.75rem">Zona</label>' +
      '<select id="terreno-zona" class="tienda-select">' +
        '<option value="">Selecciona ciudad primero...</option>' +
      '</select>' +
      '<label class="form-label" style="margin-top:0.75rem">Cantidad</label>' +
      '<div class="producto-cantidad" style="justify-content:flex-start;gap:1rem">' +
        '<button class="btn-cantidad" id="terreno-minus">−</button>' +
        '<span class="cantidad-valor" id="terreno-qty">1</span>' +
        '<button class="btn-cantidad" id="terreno-plus">+</button>' +
      '</div>' +
      '<div id="terreno-precio-preview" style="margin-top:0.75rem;color:var(--accent);font-weight:700;font-size:1rem"></div>' +
      '<button class="btn btn-primary btn-full" id="btn-agregar-terreno" style="margin-top:0.75rem">Añadir al carrito</button>' +
      '<div id="terreno-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  document.getElementById('back-terrenos').addEventListener('click', function() { renderCategoriasEstiria(); });

  document.getElementById('terreno-ciudad').addEventListener('change', function() {
    var ciudad = this.value;
    var zonaSelect = document.getElementById('terreno-zona');
    if (!ciudad) { zonaSelect.innerHTML = '<option value="">Selecciona ciudad primero...</option>'; return; }
    zonaSelect.innerHTML = '<option value="">Selecciona zona...</option>' +
      zonas[ciudad].map(function(z) { return '<option value="' + z + '">' + z + '</option>'; }).join('');
    actualizarPreviewTerreno();
  });

  ['terreno-tamano', 'terreno-zona'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', actualizarPreviewTerreno);
  });

  document.getElementById('terreno-minus').addEventListener('click', function() {
    var el = document.getElementById('terreno-qty');
    if (parseInt(el.textContent) > 1) { el.textContent = parseInt(el.textContent) - 1; actualizarPreviewTerreno(); }
  });
  document.getElementById('terreno-plus').addEventListener('click', function() {
    var el = document.getElementById('terreno-qty');
    el.textContent = parseInt(el.textContent) + 1; actualizarPreviewTerreno();
  });
  document.getElementById('btn-agregar-terreno').addEventListener('click', function() {
    var tamanoSelect = document.getElementById('terreno-tamano');
    var precio = parseInt(tamanoSelect.value);
    var m2 = tamanoSelect.options[tamanoSelect.selectedIndex].dataset.m2;
    var ciudad = document.getElementById('terreno-ciudad').value;
    var zona = document.getElementById('terreno-zona').value;
    var qty = parseInt(document.getElementById('terreno-qty').textContent);
    var msg = document.getElementById('terreno-msg');
    if (!precio || !ciudad || !zona) { msg.textContent = 'Completa todos los campos'; msg.style.color = 'var(--danger)'; return; }
    carrito.push({ nombre: 'Terreno ' + m2 + 'm² — ' + zona + ' (' + ciudad + ')', emoji: '🏔️', precio: precio, cantidad: qty, categoria: 'terrenos', unidad: '' });
    actualizarCarritoFlotante();
    msg.textContent = '✓ Añadido al carrito'; msg.style.color = 'var(--success)';
    setTimeout(function() { msg.textContent = ''; }, 1500);
  });
}

function renderCategoriasGresit() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-naciones-gresit">← Naciones</button>' +
      '<h3>🏔️ Gresit</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" id="cat-gresit-comida"><span>🍽️</span><span>Comida</span></button>' +
      '<button class="categoria-btn" id="cat-gresit-terrenos"><span>🏔️</span><span>Terrenos</span></button>' +
      '<button class="categoria-btn" id="cat-gresit-construcciones"><span>🏠</span><span>Construcciones</span></button>' +
      '<button class="categoria-btn" id="cat-gresit-armas"><span>⚔️</span><span>Mat. Armas</span></button>' +
    '</div>';

  document.getElementById('back-naciones-gresit').addEventListener('click', function() {
    document.getElementById('tienda-panel').innerHTML = '';
  });
  document.getElementById('cat-gresit-comida').addEventListener('click', function() { renderSubcategoriasComidaGresit(); });
  document.getElementById('cat-gresit-terrenos').addEventListener('click', function() { renderTerrenosGresit(); });
  document.getElementById('cat-gresit-construcciones').addEventListener('click', function() { renderConstruccionesGresit(); });
  document.getElementById('cat-gresit-armas').addEventListener('click', function() { renderSubcategoriasArmasGresit(); });
}

function renderSubcategoriasComidaGresit() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-gresit-comida">← Gresit</button>' +
      '<h3>🍽️ Comida — Gresit</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="g_carnes"><span>🥩</span><span>Carnes</span></button>' +
      '<button class="categoria-btn" data-sub="g_verduras"><span>🥬</span><span>Verduras</span></button>' +
      '<button class="categoria-btn" data-sub="g_frutas"><span>🍎</span><span>Frutas</span></button>' +
      '<button class="categoria-btn" data-sub="g_lacteos"><span>🥛</span><span>Lácteos</span></button>' +
      '<button class="categoria-btn" data-sub="g_panaderia"><span>🍞</span><span>Panadería</span></button>' +
      '<button class="categoria-btn" data-sub="g_postres"><span>🍰</span><span>Postres</span></button>' +
      '<button class="categoria-btn" data-sub="g_preparados"><span>🍔</span><span>Preparados</span></button>' +
      '<button class="categoria-btn" data-sub="g_condimentos"><span>🧂</span><span>Condimentos</span></button>' +
      '<button class="categoria-btn" data-sub="g_preelaborados"><span>🛍️</span><span>Preelaborados</span></button>' +
      '<button class="categoria-btn" data-sub="g_bebidas"><span>🧃</span><span>Bebidas</span></button>' +
    '</div>';

  document.getElementById('back-gresit-comida').addEventListener('click', function() { renderCategoriasGresit(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('gresit', btn.dataset.sub); });
  });
}

function renderSubcategoriasArmasGresit() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-gresit-armas">← Gresit</button>' +
      '<h3>⚔️ Materiales para Armas — Gresit</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="metales_armas"><span>🔩</span><span>Metales</span></button>' +
      '<button class="categoria-btn" data-sub="preciosos"><span>💎</span><span>Preciosos</span></button>' +
    '</div>';

  document.getElementById('back-gresit-armas').addEventListener('click', function() { renderCategoriasGresit(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('armas', btn.dataset.sub); });
  });
}

function renderTerrenosGresit() {
  var panel = document.getElementById('tienda-panel');
  var zonas = {
    'Populares (Roshan, Rojo Branwen, Sharqly Tuman exterior)': [
      { m2: '70', precio: 1800 }, { m2: '90', precio: 2400 },
      { m2: '110', precio: 3100 }, { m2: '125', precio: 4200 },
      { m2: '150', precio: 4600 }, { m2: '160', precio: 4800 },
      { m2: '180', precio: 5600 }, { m2: '200', precio: 6800 },
      { m2: '240', precio: 7900 }
    ],
    'Urbana Central (Edhellond, Sharqly Tuman, Von Maxwell bajo)': [
      { m2: '300', precio: 8900 }, { m2: '450', precio: 11500 },
      { m2: '500', precio: 13000 }, { m2: '630', precio: 15000 },
      { m2: '750', precio: 17200 }, { m2: '800', precio: 18500 },
      { m2: '900', precio: 20500 }, { m2: '1.000', precio: 23000 },
      { m2: '1.200', precio: 26000 }
    ],
    'Distritos Nobles (Von Maxwell alto, Oro Blanco, Riveras del río)': [
      { m2: '1.500', precio: 30000 }, { m2: '2.000', precio: 38000 },
      { m2: '3.000', precio: 52000 }, { m2: '4.800', precio: 65000 },
      { m2: '6.000', precio: 78000 }, { m2: '8.000', precio: 95000 },
      { m2: '10.000', precio: 115000 }, { m2: '15.000', precio: 170000 }
    ],
    'Rural y Agrícola (Campos del Este y periferia)': [
      { m2: '2.000', precio: 14000 }, { m2: '5.000', precio: 28000 },
      { m2: '10.000', precio: 48000 }, { m2: '25.000', precio: 95000 },
      { m2: '50.000', precio: 160000 }
    ]
  };

  var zonasKeys = Object.keys(zonas);

  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-gresit-terrenos">← Gresit</button>' +
      '<h3>🏔️ Terrenos — Gresit</h3>' +
    '</div>' +
    '<p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:0.75rem">Selecciona zona, tamaño y cantidad.</p>' +
    '<label class="form-label">Zona</label>' +
    '<select id="gresit-terreno-zona" class="tienda-select">' +
      '<option value="">Selecciona zona...</option>' +
      zonasKeys.map(function(z) { return '<option value="' + z + '">' + z + '</option>'; }).join('') +
    '</select>' +
    '<label class="form-label" style="margin-top:0.75rem">Tamaño</label>' +
    '<select id="gresit-terreno-tamano" class="tienda-select">' +
      '<option value="">Selecciona zona primero...</option>' +
    '</select>' +
    '<label class="form-label" style="margin-top:0.75rem">Cantidad</label>' +
    '<div class="producto-cantidad" style="justify-content:flex-start;gap:1rem">' +
      '<button class="btn-cantidad" id="gresit-terreno-minus">−</button>' +
      '<span class="cantidad-valor" id="gresit-terreno-qty">1</span>' +
      '<button class="btn-cantidad" id="gresit-terreno-plus">+</button>' +
    '</div>' +
    '<div id="gresit-terreno-preview" style="margin-top:0.75rem;color:var(--accent);font-weight:700;font-size:1rem"></div>' +
    '<button class="btn btn-primary btn-full" id="btn-agregar-gresit-terreno" style="margin-top:0.75rem">Añadir al carrito</button>' +
    '<div id="gresit-terreno-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>';

  document.getElementById('back-gresit-terrenos').addEventListener('click', function() { renderCategoriasGresit(); });

  document.getElementById('gresit-terreno-zona').addEventListener('change', function() {
    var zona = this.value;
    var tamSelect = document.getElementById('gresit-terreno-tamano');
    if (!zona) { tamSelect.innerHTML = '<option value="">Selecciona zona primero...</option>'; return; }
    tamSelect.innerHTML = '<option value="">Selecciona tamaño...</option>' +
      zonas[zona].map(function(t) {
        return '<option value="' + t.precio + '" data-m2="' + t.m2 + '">' + t.m2 + ' m² — £' + t.precio.toLocaleString('es-CO') + '</option>';
      }).join('');
    actualizarPreviewGresitTerreno();
  });

  document.getElementById('gresit-terreno-tamano').addEventListener('change', function() { actualizarPreviewGresitTerreno(); });

  document.getElementById('gresit-terreno-minus').addEventListener('click', function() {
    var el = document.getElementById('gresit-terreno-qty');
    if (parseInt(el.textContent) > 1) { el.textContent = parseInt(el.textContent) - 1; actualizarPreviewGresitTerreno(); }
  });
  document.getElementById('gresit-terreno-plus').addEventListener('click', function() {
    var el = document.getElementById('gresit-terreno-qty');
    el.textContent = parseInt(el.textContent) + 1; actualizarPreviewGresitTerreno();
  });

  document.getElementById('btn-agregar-gresit-terreno').addEventListener('click', function() {
    var zona = document.getElementById('gresit-terreno-zona').value;
    var tamSelect = document.getElementById('gresit-terreno-tamano');
    var precio = parseInt(tamSelect.value);
    var m2 = tamSelect.options[tamSelect.selectedIndex].dataset.m2;
    var qty = parseInt(document.getElementById('gresit-terreno-qty').textContent);
    var msg = document.getElementById('gresit-terreno-msg');
    if (!zona || !precio) { msg.textContent = 'Completa todos los campos'; msg.style.color = 'var(--danger)'; return; }
    carrito.push({ nombre: 'Terreno ' + m2 + 'm² — ' + zona + ' (Gresit)', emoji: '🏔️', precio: precio, cantidad: qty, categoria: 'terrenos', unidad: '' });
    actualizarCarritoFlotante();
    msg.textContent = '✓ Añadido al carrito'; msg.style.color = 'var(--success)';
    setTimeout(function() { msg.textContent = ''; }, 1500);
  });
}

function actualizarPreviewGresitTerreno() {
  var tamSelect = document.getElementById('gresit-terreno-tamano');
  var precio = parseInt(tamSelect.value);
  var qty = parseInt(document.getElementById('gresit-terreno-qty').textContent);
  var preview = document.getElementById('gresit-terreno-preview');
  if (precio && qty) preview.textContent = 'Total: £' + (precio * qty).toLocaleString('es-CO');
  else preview.textContent = '';
}

function renderConstruccionesGresit() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-gresit-const">← Gresit</button>' +
      '<h3>🏠 Construcciones — Gresit</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="g_casas"><span>🏠</span><span>Propiedades</span></button>' +
    '</div>';

  document.getElementById('back-gresit-const').addEventListener('click', function() { renderCategoriasGresit(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('gresit', btn.dataset.sub); });
  });
}

function renderCategoriasIrkustk() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-naciones-irkustk">← Naciones</button>' +
      '<h3>🕌 Irkustk</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" id="cat-irkustk-comida"><span>🍽️</span><span>Comida</span></button>' +
      '<button class="categoria-btn" id="cat-irkustk-terrenos"><span>🏜️</span><span>Terrenos</span></button>' +
      '<button class="categoria-btn" id="cat-irkustk-construcciones"><span>🏠</span><span>Construcciones</span></button>' +
      '<button class="categoria-btn" id="cat-irkustk-armas"><span>⚔️</span><span>Mat. Armas</span></button>' +
    '</div>';

  document.getElementById('back-naciones-irkustk').addEventListener('click', function() {
    document.getElementById('tienda-panel').innerHTML = '';
  });
  document.getElementById('cat-irkustk-comida').addEventListener('click', function() { renderSubcategoriasComidaIrkustk(); });
  document.getElementById('cat-irkustk-terrenos').addEventListener('click', function() { renderTerrenosIrkustk(); });
  document.getElementById('cat-irkustk-construcciones').addEventListener('click', function() { renderConstruccionesIrkustk(); });
  document.getElementById('cat-irkustk-armas').addEventListener('click', function() { renderSubcategoriasArmasIrkustk(); });
}

function renderSubcategoriasComidaIrkustk() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-irkustk-comida">← Irkustk</button>' +
      '<h3>🍽️ Comida — Irkustk</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="g_carnes"><span>🥩</span><span>Carnes</span></button>' +
      '<button class="categoria-btn" data-sub="g_verduras"><span>🥬</span><span>Verduras</span></button>' +
      '<button class="categoria-btn" data-sub="g_frutas"><span>🍎</span><span>Frutas</span></button>' +
      '<button class="categoria-btn" data-sub="g_lacteos"><span>🥛</span><span>Lácteos</span></button>' +
      '<button class="categoria-btn" data-sub="g_panaderia"><span>🍞</span><span>Panadería</span></button>' +
      '<button class="categoria-btn" data-sub="g_postres"><span>🍰</span><span>Postres</span></button>' +
      '<button class="categoria-btn" data-sub="g_preparados"><span>🍔</span><span>Preparados</span></button>' +
      '<button class="categoria-btn" data-sub="g_condimentos"><span>🧂</span><span>Condimentos</span></button>' +
      '<button class="categoria-btn" data-sub="g_preelaborados"><span>🛍️</span><span>Preelaborados</span></button>' +
      '<button class="categoria-btn" data-sub="g_bebidas"><span>🧃</span><span>Bebidas</span></button>' +
    '</div>';

  document.getElementById('back-irkustk-comida').addEventListener('click', function() { renderCategoriasIrkustk(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('gresit', btn.dataset.sub); });
  });
}

function renderSubcategoriasArmasIrkustk() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-irkustk-armas">← Irkustk</button>' +
      '<h3>⚔️ Materiales para Armas — Irkustk</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="metales_armas"><span>🔩</span><span>Metales</span></button>' +
      '<button class="categoria-btn" data-sub="preciosos"><span>💎</span><span>Preciosos</span></button>' +
    '</div>';

  document.getElementById('back-irkustk-armas').addEventListener('click', function() { renderCategoriasIrkustk(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('armas', btn.dataset.sub); });
  });
}

function renderTerrenosIrkustk() {
  var panel = document.getElementById('tienda-panel');
  var zonas = {
    'Pequeños (Oasis Obama, Saddan Hussein, The Hall, Lawrence, Rustem, Almagro, Bagdad, Saladino, Tortuga, Ruta de las Arenas)': [
      { m2: '90', precio: 2000 },
      { m2: '125', precio: 3800 },
      { m2: '160', precio: 4200 },
      { m2: '180', precio: 5000 },
      { m2: '200', precio: 6000 }
    ],
    'Medianos (Oasis Obama, Saddan Hussein, Lawrence, Rustem, Almagro, Bagdad, Saladino, Tortuga, Ruta de las Arenas)': [
      { m2: '450', precio: 10000 },
      { m2: '500', precio: 11800 },
      { m2: '630', precio: 13500 },
      { m2: '800', precio: 16000 },
      { m2: '1.000', precio: 20000 }
    ],
    'Grandes (Oasis Obama, Almagro, Bagdad, Saladino, Tortuga, Ruta de las Arenas, Territorios no explorados)': [
      { m2: '1.500', precio: 25000 },
      { m2: '3.000', precio: 45000 },
      { m2: '4.800', precio: 57000 },
      { m2: '10.000', precio: 100000 },
      { m2: '15.000', precio: 150000 }
    ]
  };

  var zonasKeys = Object.keys(zonas);

  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-irkustk-terrenos">← Irkustk</button>' +
      '<h3>🏜️ Terrenos — Irkustk</h3>' +
    '</div>' +
    '<p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:0.75rem">Selecciona zona, tamaño y cantidad.</p>' +
    '<label class="form-label">Zona</label>' +
    '<select id="irkustk-terreno-zona" class="tienda-select">' +
      '<option value="">Selecciona zona...</option>' +
      zonasKeys.map(function(z) { return '<option value="' + z + '">' + z + '</option>'; }).join('') +
    '</select>' +
    '<label class="form-label" style="margin-top:0.75rem">Tamaño</label>' +
    '<select id="irkustk-terreno-tamano" class="tienda-select">' +
      '<option value="">Selecciona zona primero...</option>' +
    '</select>' +
    '<label class="form-label" style="margin-top:0.75rem">Cantidad</label>' +
    '<div class="producto-cantidad" style="justify-content:flex-start;gap:1rem">' +
      '<button class="btn-cantidad" id="irkustk-terreno-minus">−</button>' +
      '<span class="cantidad-valor" id="irkustk-terreno-qty">1</span>' +
      '<button class="btn-cantidad" id="irkustk-terreno-plus">+</button>' +
    '</div>' +
    '<div id="irkustk-terreno-preview" style="margin-top:0.75rem;color:var(--accent);font-weight:700;font-size:1rem"></div>' +
    '<button class="btn btn-primary btn-full" id="btn-agregar-irkustk-terreno" style="margin-top:0.75rem">Añadir al carrito</button>' +
    '<div id="irkustk-terreno-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>';

  document.getElementById('back-irkustk-terrenos').addEventListener('click', function() { renderCategoriasIrkustk(); });

  document.getElementById('irkustk-terreno-zona').addEventListener('change', function() {
    var zona = this.value;
    var tamSelect = document.getElementById('irkustk-terreno-tamano');
    if (!zona) { tamSelect.innerHTML = '<option value="">Selecciona zona primero...</option>'; return; }
    tamSelect.innerHTML = '<option value="">Selecciona tamaño...</option>' +
      zonas[zona].map(function(t) {
        return '<option value="' + t.precio + '" data-m2="' + t.m2 + '">' + t.m2 + ' m² — £' + t.precio.toLocaleString('es-CO') + '</option>';
      }).join('');
    actualizarPreviewIrkustkTerreno();
  });

  document.getElementById('irkustk-terreno-tamano').addEventListener('change', function() { actualizarPreviewIrkustkTerreno(); });

  document.getElementById('irkustk-terreno-minus').addEventListener('click', function() {
    var el = document.getElementById('irkustk-terreno-qty');
    if (parseInt(el.textContent) > 1) { el.textContent = parseInt(el.textContent) - 1; actualizarPreviewIrkustkTerreno(); }
  });
  document.getElementById('irkustk-terreno-plus').addEventListener('click', function() {
    var el = document.getElementById('irkustk-terreno-qty');
    el.textContent = parseInt(el.textContent) + 1; actualizarPreviewIrkustkTerreno();
  });

  document.getElementById('btn-agregar-irkustk-terreno').addEventListener('click', function() {
    var zona = document.getElementById('irkustk-terreno-zona').value;
    var tamSelect = document.getElementById('irkustk-terreno-tamano');
    var precio = parseInt(tamSelect.value);
    var m2 = tamSelect.options[tamSelect.selectedIndex].dataset.m2;
    var qty = parseInt(document.getElementById('irkustk-terreno-qty').textContent);
    var msg = document.getElementById('irkustk-terreno-msg');
    if (!zona || !precio) { msg.textContent = 'Completa todos los campos'; msg.style.color = 'var(--danger)'; return; }
    carrito.push({ nombre: 'Terreno ' + m2 + 'm² — ' + zona + ' (Irkustk)', emoji: '🏜️', precio: precio, cantidad: qty, categoria: 'terrenos', unidad: '' });
    actualizarCarritoFlotante();
    msg.textContent = '✓ Añadido al carrito'; msg.style.color = 'var(--success)';
    setTimeout(function() { msg.textContent = ''; }, 1500);
  });
}

function actualizarPreviewIrkustkTerreno() {
  var tamSelect = document.getElementById('irkustk-terreno-tamano');
  var precio = parseInt(tamSelect.value);
  var qty = parseInt(document.getElementById('irkustk-terreno-qty').textContent);
  var preview = document.getElementById('irkustk-terreno-preview');
  if (precio && qty) preview.textContent = 'Total: £' + (precio * qty).toLocaleString('es-CO');
  else preview.textContent = '';
}

function renderConstruccionesIrkustk() {
  var panel = document.getElementById('tienda-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-irkustk-const">← Irkustk</button>' +
      '<h3>🏠 Construcciones — Irkustk</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" data-sub="irkustk_casas"><span>🏠</span><span>Propiedades</span></button>' +
    '</div>';

  document.getElementById('back-irkustk-const').addEventListener('click', function() { renderCategoriasIrkustk(); });
  panel.querySelectorAll('.categoria-btn[data-sub]').forEach(function(btn) {
    btn.addEventListener('click', function() { renderProductos('irkustk', btn.dataset.sub); });
  });
}

function renderCarrito() {
  var total = carrito.reduce(function(s, i) { return s + (i.precio * i.cantidad); }, 0);
  mainContent.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-carrito">← Tienda</button>' +
      '<h3>🛒 Carrito</h3>' +
    '</div>' +
    '<div id="lista-carrito">' +
      (carrito.length === 0
        ? '<p style="color:var(--text-secondary);text-align:center;padding:2rem">El carrito está vacío</p>'
        : carrito.map(function(item, i) {
            return '<div class="carrito-item" id="carrito-item-' + i + '">' +
              '<div class="producto-info">' +
                '<p class="producto-nombre">' + item.emoji + ' ' + item.nombre + '</p>' +
                '<p class="producto-precio">£' + item.precio.toLocaleString('es-CO') + (item.unidad ? ' / ' + item.unidad : '') + ' × ' + item.cantidad + ' = £' + (item.precio * item.cantidad).toLocaleString('es-CO') + '</p>' +
              '</div>' +
              '<button class="btn-eliminar-carrito" data-i="' + i + '">🗑️</button>' +
            '</div>';
          }).join('')
      ) +
    '</div>' +
    '<div class="carrito-total card" style="margin-top:1rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<p style="font-size:0.9rem;color:var(--text-secondary)">Total a pagar</p>' +
        '<p style="font-size:1.3rem;font-weight:700;color:var(--accent)">£' + total.toLocaleString('es-CO') + '</p>' +
      '</div>' +
      '<p style="font-size:0.82rem;color:var(--text-secondary);margin-top:0.3rem">Saldo disponible: £<span id="saldo-carrito">' + (currentUser.saldo || 0).toLocaleString('es-CO') + '</span></p>' +
    '</div>' +
    '<div id="carrito-error" class="hidden" style="color:var(--danger);font-size:0.85rem;margin-top:0.5rem;text-align:center"></div>' +
    '<button class="btn btn-primary btn-full" id="btn-confirmar-compra" style="margin-top:0.75rem"' + (carrito.length === 0 ? ' disabled' : '') + '>✅ Confirmar compra</button>' +
    '<button class="btn btn-secondary btn-full" id="btn-vaciar-carrito" style="margin-top:0.5rem;border-color:var(--danger);color:var(--danger)">🗑️ Vaciar carrito</button>';

  document.getElementById('back-carrito').addEventListener('click', function() { renderTienda(); });

  document.querySelectorAll('.btn-eliminar-carrito').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var i = parseInt(btn.dataset.i);
      carrito.splice(i, 1);
      actualizarCarritoFlotante();
      renderCarrito();
    });
  });

  document.getElementById('btn-vaciar-carrito').addEventListener('click', function() {
    if (!confirm('¿Vaciar el carrito?')) return;
    carrito = [];
    actualizarCarritoFlotante();
    renderCarrito();
  });

  document.getElementById('btn-confirmar-compra').addEventListener('click', async function() {
    if (carrito.length === 0) return;
    var total = carrito.reduce(function(s, i) { return s + (i.precio * i.cantidad); }, 0);
    var errorEl = document.getElementById('carrito-error');
    var btn = this;

    // Recargar saldo actual desde Firebase
    var userSnap = await getDoc(doc(db, 'usuarios', currentUser.uid));
    var saldoActual = userSnap.data().saldo || 0;

    if (total > saldoActual) {
      errorEl.textContent = 'Saldo insuficiente. Tienes £' + saldoActual.toLocaleString('es-CO') + ' y necesitas £' + total.toLocaleString('es-CO');
      errorEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
      var saldoFinal = saldoActual - total;
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { saldo: increment(-total) });
      await registrarTransaccion({
        tipo: 'compra',
        de: currentUser.uid,
        deUsername: currentUser.username,
        para: 'sistema',
        paraUsername: 'Tienda Estiria',
        monto: total,
        descripcion: 'Compra en Tienda Estiria: ' + carrito.map(function(i) { return i.cantidad + 'x ' + i.nombre; }).join(', ')
      });

      currentUser.saldo = saldoFinal;
      var itemsComprados = carrito.slice();
      carrito = [];
      actualizarCarritoFlotante();
      // Registrar en patrimonio automáticamente
var mapaCategorias = {
  'lacteos': 'comida', 'varios': 'comida', 'preparados': 'comida',
  'bebidas': 'comida', 'frutas': 'comida', 'panaderia': 'comida', 'postres': 'comida',
  'g_carnes': 'comida', 'g_verduras': 'comida', 'g_frutas': 'comida',
  'g_lacteos': 'comida', 'g_panaderia': 'comida', 'g_postres': 'comida',
  'g_preparados': 'comida', 'g_condimentos': 'comida', 'g_preelaborados': 'comida', 'g_bebidas': 'comida',
  'terrenos': 'terrenos',
  'casas': 'casas',
  'materiales': 'materiales_construccion',
  'metales_armas': 'materiales_armas', 'preciosos': 'metales_preciosos',
  'g_casas': 'casas', 'irkustk_casas': 'casas'
};
for (var pi = 0; pi < itemsComprados.length; pi++) {
  var item = itemsComprados[pi];
  var catPatrimonio = mapaCategorias[item.categoria];
  if (catPatrimonio && item.categoria !== 'viajes') {
    await addDoc(collection(db, 'patrimonio'), {
      uid: currentUser.uid, username: currentUser.username,
      categoria: catPatrimonio, nombre: item.nombre,
      cantidad: item.cantidad, descripcion: 'Comprado en tienda',
      precioCompra: item.precio, precioMercado: item.precio,
      imagen: '', activo: true, creadoEn: new Date().toISOString(),
      creadoPor: currentUser.username
    });
    await addDoc(collection(db, 'patrimonio_historial'), {
      uid: currentUser.uid, username: currentUser.username,
      tipo: 'añadido', itemNombre: item.nombre, categoria: catPatrimonio,
      descripcion: 'Comprado en tienda de Estiria', fecha: new Date().toISOString()
    });
  }
}
      renderRecibo(itemsComprados, saldoActual, saldoFinal, total);

    } catch (err) {
      errorEl.textContent = 'Error al procesar: ' + err.message;
      errorEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = '✅ Confirmar compra';
    }
  });
}

function renderRecibo(items, saldoInicial, saldoFinal, total) {
  var listaItems = items.map(function(item) {
    if (item.categoria === 'viajes') {
      return '<div class="recibo-item"><p>' + item.emoji + ' ' + item.nombre + '</p><p style="color:var(--danger)">-£' + (item.precio * item.cantidad).toLocaleString('es-CO') + '</p></div>';
    }
    return '<div class="recibo-item"><p>' + item.emoji + ' ' + item.cantidad + 'x ' + item.nombre + '</p><p style="color:var(--danger)">-£' + (item.precio * item.cantidad).toLocaleString('es-CO') + '</p></div>';
  }).join('');

  var textoWhatsApp = generarTextoRecibo(items, saldoInicial, saldoFinal, total);

  mainContent.innerHTML =
    '<div class="recibo-card card">' +
      '<div style="text-align:center;margin-bottom:1rem">' +
        '<p style="font-size:1.5rem">🎴</p>' +
        '<h2 style="color:var(--accent);font-size:1rem">República de Estiria LATAM</h2>' +
        '<p style="color:var(--text-secondary);font-size:0.85rem">✒️ Boleta de compra/pago ✒️</p>' +
        '<p style="color:var(--text-secondary);font-size:0.82rem">Extracto Bancario de ' + currentUser.username + '</p>' +
      '</div>' +
      '<div class="recibo-saldo-row">' +
        '<p>💷 Saldo inicial</p>' +
        '<p>£' + saldoInicial.toLocaleString('es-CO') + '</p>' +
      '</div>' +
      '<div style="margin:0.75rem 0">' +
        '<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.5rem">• Lo que se compra:</p>' +
        listaItems +
      '</div>' +
      '<div class="recibo-saldo-row" style="border-top:1px solid var(--bg-card);padding-top:0.75rem">' +
        '<p style="color:var(--danger);font-weight:700">Total gastado</p>' +
        '<p style="color:var(--danger);font-weight:700">-£' + total.toLocaleString('es-CO') + '</p>' +
      '</div>' +
      '<div class="recibo-saldo-row" style="margin-top:0.5rem">' +
        '<p>💷 Saldo final</p>' +
        '<p style="color:var(--success);font-weight:700">£' + saldoFinal.toLocaleString('es-CO') + '</p>' +
      '</div>' +
      '<button class="btn btn-secondary btn-full" id="btn-copiar-recibo" style="margin-top:1rem">📋 Copiar recibo para WhatsApp</button>' +
      '<button class="btn btn-primary btn-full" id="btn-volver-tienda" style="margin-top:0.5rem">🛒 Seguir comprando</button>' +
    '</div>';

  document.getElementById('btn-copiar-recibo').addEventListener('click', function() {
    navigator.clipboard.writeText(textoWhatsApp).then(function() {
      var btn = document.getElementById('btn-copiar-recibo');
      btn.textContent = '✅ ¡Copiado!';
      setTimeout(function() { btn.textContent = '📋 Copiar recibo para WhatsApp'; }, 2000);
    });
  });

  document.getElementById('btn-volver-tienda').addEventListener('click', function() { renderTienda(); });
}

function generarTextoRecibo(items, saldoInicial, saldoFinal, total) {
  var lineas = [];
  lineas.push('🏴󠁧󠁢󠁷󠁬󠁳󠁿🎴 República de Estiria LATAM 🎴');
  lineas.push('');
  lineas.push('✒️ Boleta de compra/pago ✒️');
  lineas.push('');
  lineas.push('-Extracto Bancario de ' + currentUser.username + '-');
  lineas.push('');
  lineas.push('💷 Saldo inicial: £' + saldoInicial.toLocaleString('es-CO') + ' 💷');
  lineas.push('');
  lineas.push('• Lo que se compra:');

  items.forEach(function(item) {
    if (item.categoria === 'viajes') {
      lineas.push(item.emoji + ' ' + item.nombre);
    } else {
      lineas.push(item.emoji + ' ' + item.cantidad + 'x ' + item.nombre + ' — £' + (item.precio * item.cantidad).toLocaleString('es-CO'));
    }
  });

  lineas.push('');
  lineas.push('- £' + total.toLocaleString('es-CO') + ' (total gastado)');
  lineas.push('');
  lineas.push('💷 Saldo final: £' + saldoFinal.toLocaleString('es-CO') + ' 💷');

  return lineas.join('\n');
}

function actualizarPreviewTerreno() {
  var tamanoSelect = document.getElementById('terreno-tamano');
  var precio = parseInt(tamanoSelect.value);
  var qty = parseInt(document.getElementById('terreno-qty').textContent);
  var preview = document.getElementById('terreno-precio-preview');
  if (precio && qty) preview.textContent = 'Total: £' + (precio * qty).toLocaleString('es-CO');
  else preview.textContent = '';
}

function renderViajes() {
  var panel = document.getElementById('tienda-panel');
  var ciudadesEstiria = ['Ryazan (Estiria)', 'Ryla (Estiria)', 'Kemerov (Estiria)', 'Navarra (Estiria)'];
  var precios = {};

  ciudadesEstiria.forEach(function(c) {
    precios[c] = {};
    ciudadesEstiria.forEach(function(d) {
      if (c !== d) precios[c][d] = 150;
    });
    precios[c]['Irkustk'] = 250;
    precios[c]['Gresit'] = 350;
    precios[c]['Odrekao'] = 940;
  });

  precios['Irkustk'] = {};
  precios['Gresit'] = {};
  precios['Odrekao'] = {};

  ciudadesEstiria.forEach(function(c) {
    precios['Irkustk'][c] = 250;
    precios['Gresit'][c] = 350;
    precios['Odrekao'][c] = 940;
  });

  precios['Irkustk']['Gresit'] = 420;
  precios['Irkustk']['Odrekao'] = 940;
  precios['Gresit']['Irkustk'] = 420;
  precios['Gresit']['Odrekao'] = 940;
  precios['Odrekao']['Irkustk'] = 940;
  precios['Odrekao']['Gresit'] = 940;

  var todasLasNaciones = ciudadesEstiria.concat(['Irkustk', 'Gresit', 'Odrekao']);

  panel.innerHTML =
    '<div class="tienda-seccion-header">' +
      '<button class="btn-back" id="back-viajes">← Tienda</button>' +
      '<h3>✈️ Viajes</h3>' +
    '</div>' +
    '<p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:0.75rem">Precio por persona por día (24h)</p>' +
    '<label class="form-label">Origen</label>' +
    '<select id="viaje-origen" class="tienda-select">' +
      '<option value="">Selecciona origen...</option>' +
      todasLasNaciones.map(function(n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') +
    '</select>' +
    '<label class="form-label" style="margin-top:0.75rem">Destino</label>' +
    '<select id="viaje-destino" class="tienda-select">' +
      '<option value="">Selecciona origen primero...</option>' +
    '</select>' +
    '<label class="form-label" style="margin-top:0.75rem">Días de viaje</label>' +
    '<div class="producto-cantidad" style="justify-content:flex-start;gap:1rem">' +
      '<button class="btn-cantidad" id="viaje-minus">−</button>' +
      '<span class="cantidad-valor" id="viaje-dias">1</span>' +
      '<button class="btn-cantidad" id="viaje-plus">+</button>' +
    '</div>' +
    '<label class="form-label" style="margin-top:0.75rem">Acompañantes</label>' +
    '<div id="acompanantes-lista"></div>' +
    '<button class="btn btn-secondary btn-full" id="btn-add-acomp" style="margin-top:0.5rem">+ Añadir acompañante</button>' +
    '<div id="viaje-precio-preview" style="margin-top:0.75rem;color:var(--accent);font-weight:700;font-size:1rem"></div>' +
    '<button class="btn btn-primary btn-full" id="btn-agregar-viaje" style="margin-top:0.75rem">Añadir al carrito</button>' +
    '<div id="viaje-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>';

  document.getElementById('back-viajes').addEventListener('click', function() {
    document.getElementById('tienda-panel').innerHTML = '';
  });

  document.getElementById('viaje-origen').addEventListener('change', function() {
    var origen = this.value;
    var destinoSelect = document.getElementById('viaje-destino');
    if (!origen || !precios[origen]) {
      destinoSelect.innerHTML = '<option value="">Selecciona origen primero...</option>';
      return;
    }
    var destinos = Object.keys(precios[origen]);
    destinoSelect.innerHTML = '<option value="">Selecciona destino...</option>' +
      destinos.map(function(d) {
        return '<option value="' + d + '">' + d + ' — £' + precios[origen][d] + '/día por persona</option>';
      }).join('');
    actualizarPreviewViaje(precios);
  });

  document.getElementById('viaje-destino').addEventListener('change', function() {
    actualizarPreviewViaje(precios);
  });

  document.getElementById('viaje-minus').addEventListener('click', function() {
    var el = document.getElementById('viaje-dias');
    if (parseInt(el.textContent) > 1) {
      el.textContent = parseInt(el.textContent) - 1;
      actualizarPreviewViaje(precios);
    }
  });

  document.getElementById('viaje-plus').addEventListener('click', function() {
    var el = document.getElementById('viaje-dias');
    el.textContent = parseInt(el.textContent) + 1;
    actualizarPreviewViaje(precios);
  });

  var acompanantes = 0;
  document.getElementById('btn-add-acomp').addEventListener('click', function() {
    acompanantes++;
    var lista = document.getElementById('acompanantes-lista');
    var div = document.createElement('div');
    div.className = 'acomp-row';
    div.id = 'acomp-' + acompanantes;
    div.innerHTML = '<input type="text" placeholder="Nombre del acompañante..." class="acomp-input"/><button class="acomp-remove" data-id="' + acompanantes + '">✕</button>';
    lista.appendChild(div);
    div.querySelector('.acomp-remove').addEventListener('click', function() {
      document.getElementById('acomp-' + this.dataset.id).remove();
      actualizarPreviewViaje(precios);
    });
    actualizarPreviewViaje(precios);
  });

  document.getElementById('btn-agregar-viaje').addEventListener('click', function() {
    var origen = document.getElementById('viaje-origen').value;
    var destino = document.getElementById('viaje-destino').value;
    var dias = parseInt(document.getElementById('viaje-dias').textContent);
    var msg = document.getElementById('viaje-msg');
    if (!origen || !destino) {
      msg.textContent = 'Selecciona origen y destino';
      msg.style.color = 'var(--danger)';
      return;
    }
    var precioPorDia = precios[origen][destino];
    var personas = 1 + document.querySelectorAll('.acomp-input').length;
    var total = precioPorDia * dias * personas;
    var acomps = Array.from(document.querySelectorAll('.acomp-input')).map(function(i) { return i.value || 'Acompañante'; });
    var desc = origen + ' → ' + destino + ' · ' + dias + ' día(s) · ' + personas + ' persona(s)' + (acomps.length ? ' (' + acomps.join(', ') + ')' : '');
    carrito.push({ nombre: 'Viaje: ' + desc, emoji: '✈️', precio: total, cantidad: 1, categoria: 'viajes', unidad: '' });
    actualizarCarritoFlotante();
    msg.textContent = '✓ Viaje añadido al carrito';
    msg.style.color = 'var(--success)';
    setTimeout(function() { msg.textContent = ''; }, 1500);
  });
}

function actualizarPreviewViaje(precios) {
  var origen = document.getElementById('viaje-origen') ? document.getElementById('viaje-origen').value : '';
  var destino = document.getElementById('viaje-destino') ? document.getElementById('viaje-destino').value : '';
  var dias = parseInt(document.getElementById('viaje-dias') ? document.getElementById('viaje-dias').textContent : 1);
  var personas = 1 + document.querySelectorAll('.acomp-input').length;
  var preview = document.getElementById('viaje-precio-preview');
  if (!preview) return;
  if (origen && destino && precios[origen] && precios[origen][destino]) {
    var total = precios[origen][destino] * dias * personas;
    preview.textContent = '£' + precios[origen][destino] + '/día × ' + dias + ' día(s) × ' + personas + ' persona(s) = £' + total.toLocaleString('es-CO');
  } else {
    preview.textContent = '';
  }
}

function actualizarCarritoFlotante() {
  var flotante = document.getElementById('carrito-flotante');
  var count = document.getElementById('carrito-count');
  if (!flotante || !count) return;
  var total = carrito.reduce(function(s, i) { return s + i.cantidad; }, 0);
  if (total > 0) {
    flotante.classList.remove('hidden');
    count.textContent = total;
    if (!document.getElementById('btn-ver-carrito')._listener) {
      document.getElementById('btn-ver-carrito').addEventListener('click', renderCarrito);
      document.getElementById('btn-ver-carrito')._listener = true;
    }
  } else {
    flotante.classList.add('hidden');
  }
}

function getCatalogo(categoria, subcategoria) {
  var catalogos = {

    comida: {
      lacteos: [
        { emoji: '🥛', nombre: '1 Litro de Leche', precio: 2 },
        { emoji: '🧀', nombre: '1 Libra de Queso costeño', precio: 3 },
        { emoji: '🧀', nombre: '1 Libra de Quesillo', precio: 4 },
        { emoji: '🧀', nombre: '1 Libra de Queso cheddar', precio: 4 },
        { emoji: '🧀', nombre: '1 Libra de Queso parmesano', precio: 4 },
        { emoji: '🧀', nombre: '1 Libra de Cuajada', precio: 3 },
        { emoji: '🧈', nombre: '1 Mantequilla', precio: 2 },
        { emoji: '🥛', nombre: '1 Crema de leche', precio: 1 },
        { emoji: '🍦', nombre: '1 Helado personal', precio: 2 },
        { emoji: '🍨', nombre: '1 Bote de helado', precio: 5 },
        { emoji: '🥛', nombre: '1 Yogurt personal', precio: 2 },
        { emoji: '🥛', nombre: '1 Litro de yogurt', precio: 4 },
        { emoji: '🥛', nombre: '1 Bolsa de Leche en polvo', precio: 5 },
        { emoji: '🥛', nombre: '1 Leche condensada', precio: 3 },
        { emoji: '🥛', nombre: '1 Suero de leche', precio: 2 }
      ],
      varios: [
        { emoji: '🐔', nombre: '6 Huevos', precio: 2 },
        { emoji: '🧂', nombre: '1 Sal y pimienta', precio: 2 },
        { emoji: '🍷', nombre: '1 Vino rojo y blanco', precio: 5 },
        { emoji: '🫙', nombre: '1 Aceite de girasol/oliva', precio: 3 },
        { emoji: '🍯', nombre: '1 Miel', precio: 2 },
        { emoji: '🍲', nombre: '1 Salsa de soja', precio: 3 },
        { emoji: '🍋', nombre: '1 Jugo de limón', precio: 1 },
        { emoji: '🌾', nombre: '1 Harina', precio: 3 },
        { emoji: '🧂', nombre: '1 Azúcar', precio: 2 },
        { emoji: '🫙', nombre: '1 Polvo de hornear', precio: 2 },
        { emoji: '🫙', nombre: '1 Bicarbonato de sodio', precio: 3 },
        { emoji: '🍅', nombre: '1 Lata de Pasta de tomate', precio: 3 },
        { emoji: '🫙', nombre: '1 Esencia de vainilla', precio: 2 },
        { emoji: '🧂', nombre: '1 Especias varias', precio: 2 },
        { emoji: '🫙', nombre: '1 Humo líquido', precio: 1 }
      ],
      preparados: [
        { emoji: '🫔', nombre: '1 Tamal oaxacateño', precio: 3 },
        { emoji: '🫔', nombre: '1 Tamal de chaya', precio: 3 },
        { emoji: '🫔', nombre: '1 Tamal de dulce', precio: 3 },
        { emoji: '🫔', nombre: '1 Tamal veracruzano', precio: 3 },
        { emoji: '🫔', nombre: '1 Tamal colombiano', precio: 3 },
        { emoji: '🍱', nombre: '1 Bandeja de sushi', precio: 4 },
        { emoji: '🫕', nombre: '1 Fondue', precio: 4 },
        { emoji: '🍿', nombre: '1 Palomitas de maíz', precio: 2 },
        { emoji: '🍿', nombre: '1 Palomitas de maíz dulces', precio: 3 },
        { emoji: '🍳', nombre: '1 Huevo frito', precio: 2 },
        { emoji: '🥞', nombre: '4 Panqueques', precio: 4 },
        { emoji: '🧇', nombre: '4 Wafles', precio: 4 },
        { emoji: '🌭', nombre: '1 Hot dog', precio: 5 },
        { emoji: '🍔', nombre: '1 Hamburguesa vegetariana', precio: 8 },
        { emoji: '🍔', nombre: '1 Hamburguesa', precio: 6 },
        { emoji: '🍔', nombre: '1 Hamburguesa de pollo', precio: 6 },
        { emoji: '🍟', nombre: '1 Papas fritas', precio: 3 },
        { emoji: '🍕', nombre: '1 Porción de pizza', precio: 4 },
        { emoji: '🍕', nombre: '1 Caja de pizza', precio: 12 },
        { emoji: '🥪', nombre: '1 Sándwich', precio: 5 },
        { emoji: '🥙', nombre: '1 Taco vegetariano', precio: 7 },
        { emoji: '🧆', nombre: '5 Albóndigas', precio: 5 },
        { emoji: '🌮', nombre: '2 Tacos', precio: 8 },
        { emoji: '🌯', nombre: '1 Burrito', precio: 6 },
        { emoji: '🥗', nombre: '1 Ensalada de verduras', precio: 4 },
        { emoji: '🥗', nombre: '1 Ensalada dulce', precio: 4 },
        { emoji: '🥗', nombre: '1 Ensalada agridulce', precio: 4 },
        { emoji: '🥘', nombre: '1 Estofado', precio: 6 },
        { emoji: '🍝', nombre: '1 Plato de espaguetis', precio: 6 },
        { emoji: '🍜', nombre: '1 Ramen', precio: 8 },
        { emoji: '🍲', nombre: '1 Sõmen', precio: 8 },
        { emoji: '🍛', nombre: '1 Udon', precio: 6 },
        { emoji: '🍣', nombre: '2 Sushis', precio: 4 },
        { emoji: '🥟', nombre: '1 Empanada vegana', precio: 4 },
        { emoji: '🥟', nombre: '1 Empanada de carne', precio: 3 },
        { emoji: '🥟', nombre: '1 Empanada de pollo', precio: 3 },
        { emoji: '🥟', nombre: '1 Empanada mixta', precio: 4 },
        { emoji: '🥟', nombre: '1 Empanada de queso', precio: 2 },
        { emoji: '🍙', nombre: '1 Onigiri', precio: 2 },
        { emoji: '🍚', nombre: '1 Plato de arroz', precio: 3 },
        { emoji: '🍚', nombre: '1 Plato de Arroz con carnes', precio: 4 },
        { emoji: '🍚', nombre: '1 Plato de Frijoles con arroz', precio: 4 },
        { emoji: '🍚', nombre: '1 Plato de Lentejas con arroz', precio: 4 },
        { emoji: '🍚', nombre: '1 Plato de Arroz atollado', precio: 5 },
        { emoji: '🍚', nombre: '1 Plato de Arroz con pollo', precio: 5 },
        { emoji: '🧀', nombre: '5 Dedos de queso', precio: 7 },
        { emoji: '🍗', nombre: '10 Nuggets', precio: 12 },
        { emoji: '🍢', nombre: '1 Banderilla', precio: 4 },
        { emoji: '🍟', nombre: '1 Salchipapa', precio: 8 },
        { emoji: '🥩', nombre: '1 Milanesa de carne', precio: 10 },
        { emoji: '🍗', nombre: '1 Milanesa de pollo', precio: 10 },
        { emoji: '🌭', nombre: '1 Choripan', precio: 3 },
        { emoji: '🫓', nombre: '1 Arepa de queso con mantequilla', precio: 4 },
        { emoji: '🫓', nombre: '1 Arepa rellena de pollo', precio: 5 },
        { emoji: '🫓', nombre: '1 Arepa rellena de chicharrón y maduro', precio: 5 },
        { emoji: '🫓', nombre: '1 Arepa mixta', precio: 6 },
        { emoji: '🍽️', nombre: '5 Sarmale', precio: 10 },
        { emoji: '🍽️', nombre: '1 Haggi', precio: 12 },
        { emoji: '🫘', nombre: '6 Porotos', precio: 8 }
      ],
      bebidas: [
        { emoji: '🧃', nombre: '1 Jugo natural en agua', precio: 2 },
        { emoji: '🧃', nombre: '1 Jugo natural en leche', precio: 3 },
        { emoji: '🍋', nombre: '1 Limonada natural', precio: 2 },
        { emoji: '🍋', nombre: '1 Limonada cerezada', precio: 4 },
        { emoji: '🥥', nombre: '1 Limonada de coco', precio: 4 },
        { emoji: '🥤', nombre: '1 Litro de Gaseosa', precio: 5 },
        { emoji: '🥤', nombre: '1 Gaseosa personal', precio: 2 },
        { emoji: '☕', nombre: '1 Granizado de café', precio: 3 },
        { emoji: '🥤', nombre: '1 Licuado sencillo', precio: 2 },
        { emoji: '🥤', nombre: '1 Licuado de Frutos rojos', precio: 4 },
        { emoji: '🥤', nombre: '1 Licuado de Fresa y chicle', precio: 3 },
        { emoji: '🥤', nombre: '1 Licuado de Fresa y plátano', precio: 3 },
        { emoji: '🥤', nombre: '1 Licuado de Arándanos', precio: 2 },
        { emoji: '🥤', nombre: '1 Licuado de Mango y fruta', precio: 3 },
        { emoji: '🥤', nombre: '1 Licuado de Kiwi y plátano', precio: 3 },
        { emoji: '🥤', nombre: '1 Licuado de Arándano y manzana', precio: 3 },
        { emoji: '🥤', nombre: '1 Licuado de Fresa y fruta passion', precio: 3 },
        { emoji: '🥤', nombre: '1 Licuado de Spicy fresa', precio: 4 },
        { emoji: '🥤', nombre: '1 Licuado de Cereza', precio: 2 },
        { emoji: '🥤', nombre: '1 Licuado Milkshake', precio: 4 },
        { emoji: '🥤', nombre: '1 Licuado Pantera rosa', precio: 4 },
        { emoji: '🥤', nombre: '1 Licuado Kinder', precio: 4 },
        { emoji: '🥤', nombre: '1 Licuado de Donut', precio: 4 },
        { emoji: '🥤', nombre: '1 Licuado de Oreo', precio: 4 },
        { emoji: '🥤', nombre: '1 Licuado de Limón', precio: 2 },
        { emoji: '🥤', nombre: '1 Licuado de Fresa', precio: 2 },
        { emoji: '🥤', nombre: '1 Licuado de Fruta passion', precio: 2 },
        { emoji: '🥤', nombre: '1 Licuado de Manzana verde', precio: 2 },
        { emoji: '🥤', nombre: '1 Licuado misterioso', precio: 2 },
        { emoji: '🧋', nombre: '1 Batido de vainilla', precio: 3 },
        { emoji: '🧋', nombre: '1 Batido de oreo', precio: 4 },
        { emoji: '🧋', nombre: '1 Batido de mango', precio: 3 },
        { emoji: '🧋', nombre: '1 Batido Macarons', precio: 4 },
        { emoji: '🧋', nombre: '1 Batido Moka', precio: 3 },
        { emoji: '🧋', nombre: '1 Batido Nutella', precio: 4 },
        { emoji: '🧋', nombre: '1 Batido de fresa', precio: 3 },
        { emoji: '🧋', nombre: '1 Batido de mora', precio: 3 },
        { emoji: '🧋', nombre: '1 Batido saludable', precio: 3 },
        { emoji: '☕', nombre: '1 Café sencillo', precio: 2 },
        { emoji: '☕', nombre: '1 Capuccino', precio: 3 },
        { emoji: '☕', nombre: '1 Latte machiato', precio: 3 },
        { emoji: '☕', nombre: '1 Mokaccino', precio: 3 },
        { emoji: '☕', nombre: '1 Moka cacao', precio: 4 },
        { emoji: '☕', nombre: '1 Latte', precio: 3 },
        { emoji: '☕', nombre: '1 Filtrado', precio: 2 },
        { emoji: '☕', nombre: '1 Espresso', precio: 3 },
        { emoji: '🍫', nombre: '1 Chocolate caliente', precio: 2 },
        { emoji: '🫖', nombre: '1 Infusión', precio: 2 },
        { emoji: '🍵', nombre: '1 Té Chai', precio: 2 },
        { emoji: '🍵', nombre: '1 Agua de panela', precio: 2 },
        { emoji: '🍵', nombre: '1 Té verde', precio: 2 },
        { emoji: '🍵', nombre: '1 Té rojo', precio: 3 },
        { emoji: '🍵', nombre: '1 Té negro', precio: 3 },
        { emoji: '🍵', nombre: '1 Té rojo en leche', precio: 4 },
        { emoji: '🧉', nombre: '1 Mate', precio: 3 }
      ],
      frutas: [
        { emoji: '🥑', nombre: '1 Aguacate', precio: 1 },
        { emoji: '🍑', nombre: '1 Albaricoque', precio: 2 },
        { emoji: '🫐', nombre: '24 Arándanos', precio: 2 },
        { emoji: '🍌', nombre: '6 Bananos', precio: 6 },
        { emoji: '🌿', nombre: '1 Breva', precio: 1 },
        { emoji: '🍊', nombre: '1 Caqui', precio: 1 },
        { emoji: '⭐', nombre: '1 Carambola', precio: 1 },
        { emoji: '🍒', nombre: '24 Cerezas', precio: 6 },
        { emoji: '🌿', nombre: '1 Chirimoya', precio: 1 },
        { emoji: '🍑', nombre: '1 Ciruela', precio: 1 },
        { emoji: '🍑', nombre: '1 Ciruela pasa', precio: 1 },
        { emoji: '🥥', nombre: '1 Coco', precio: 2 },
        { emoji: '🌿', nombre: '1 Dátil', precio: 1 },
        { emoji: '🌿', nombre: '30 Endrinas', precio: 1 },
        { emoji: '🍓', nombre: '12 Frambuesas', precio: 10 },
        { emoji: '🍓', nombre: '12 Fresas', precio: 2 },
        { emoji: '🌿', nombre: '1 Granada', precio: 2 },
        { emoji: '🍇', nombre: '24 Grosellas', precio: 8 },
        { emoji: '🌿', nombre: '1 Guayaba', precio: 1 },
        { emoji: '🌿', nombre: '1 Higo', precio: 1 },
        { emoji: '🌿', nombre: '1 Higo seco', precio: 1 },
        { emoji: '🥝', nombre: '12 Kiwis', precio: 10 },
        { emoji: '🍋', nombre: '12 Limas', precio: 2 },
        { emoji: '🍋', nombre: '12 Limones', precio: 2 },
        { emoji: '🍊', nombre: '1 Mandarina', precio: 1 },
        { emoji: '🥭', nombre: '1 Mango', precio: 1 },
        { emoji: '🍎', nombre: '1 Manzana', precio: 1 },
        { emoji: '🌿', nombre: '1 Maracuyá', precio: 1 },
        { emoji: '🍑', nombre: '1 Melocotón', precio: 1 },
        { emoji: '🍈', nombre: '1 Melón', precio: 1 },
        { emoji: '🌿', nombre: '1 Membrillo', precio: 1 },
        { emoji: '🫐', nombre: '12 Moras', precio: 2 },
        { emoji: '🍊', nombre: '12 Naranjas', precio: 2 },
        { emoji: '🌿', nombre: '3 Nísperos', precio: 1 },
        { emoji: '🌿', nombre: '1 Papaya', precio: 2 },
        { emoji: '🍐', nombre: '1 Pera', precio: 1 },
        { emoji: '🍍', nombre: '1 Piña', precio: 2 },
        { emoji: '🌿', nombre: '1 Pitahaya', precio: 1 },
        { emoji: '🌿', nombre: '1 Pomelo', precio: 1 },
        { emoji: '🍉', nombre: '1 Sandía', precio: 5 },
        { emoji: '🌿', nombre: '1 Tamarindo', precio: 1 },
        { emoji: '🍇', nombre: '24 Uvas', precio: 2 },
        { emoji: '🍇', nombre: '12 Uvas pasa', precio: 3 }
      ],
      panaderia: [
        { emoji: '🥐', nombre: '12 Facturas', precio: 10 },
        { emoji: '🍞', nombre: '1 Pan de molde', precio: 4 },
        { emoji: '🥖', nombre: '1 Pan', precio: 3 },
        { emoji: '🥨', nombre: '2 Pretzels', precio: 4 },
        { emoji: '🍞', nombre: '1 Pan hawaiano', precio: 4 },
        { emoji: '🌭', nombre: '1 Pan con salchicha', precio: 3 },
        { emoji: '🍩', nombre: '1 Dona', precio: 3 }
      ],
      postres: [
        { emoji: '🍡', nombre: '3 Dulces japoneses', precio: 4 },
        { emoji: '🍧', nombre: '1 Granizado', precio: 3 },
        { emoji: '🥧', nombre: '1 Tarta', precio: 6 },
        { emoji: '🥧', nombre: '1 Porción de tarta', precio: 2 },
        { emoji: '🧁', nombre: '1 Cupcake', precio: 3 },
        { emoji: '🧁', nombre: '1 Caja de cupcakes', precio: 12 },
        { emoji: '🍰', nombre: '1 Pedazo de torta', precio: 4 },
        { emoji: '🎂', nombre: '1 Torta', precio: 10 },
        { emoji: '🍮', nombre: '1 Flan', precio: 4 },
        { emoji: '🍭', nombre: '2 Paletas', precio: 4 },
        { emoji: '🍬', nombre: '3 Caramelos', precio: 3 },
        { emoji: '🍫', nombre: '1 Chocolate', precio: 4 },
        { emoji: '🍩', nombre: '1 Dona', precio: 4 },
        { emoji: '🍩', nombre: '1 Caja de donas', precio: 12 },
        { emoji: '🍪', nombre: '2 Galletas', precio: 3 },
        { emoji: '🍡', nombre: '3 Mochis', precio: 6 }
      ]
    },

    construcciones: {
      casas: [
        { emoji: '🛖', nombre: 'Departamento 2m²', precio: 1600 },
        { emoji: '🛖', nombre: 'Departamento 4m²', precio: 3200 },
        { emoji: '🛖', nombre: 'Departamento 6m²', precio: 4800 },
        { emoji: '🛖', nombre: 'Departamento grande 8m²', precio: 6400 },
        { emoji: '🛖', nombre: 'Departamento grande 10m²', precio: 8000 },
        { emoji: '🛖', nombre: 'Departamento grande 12m²', precio: 9600 },
        { emoji: '🏚️', nombre: 'Casa pequeña 14m²', precio: 11200 },
        { emoji: '🏚️', nombre: 'Casa pequeña 15m²', precio: 12000 },
        { emoji: '🏚️', nombre: 'Casa pequeña 16m²', precio: 12800 },
        { emoji: '🏚️', nombre: 'Casa mediana 18m²', precio: 14400 },
        { emoji: '🏚️', nombre: 'Casa mediana 20m²', precio: 16000 },
        { emoji: '🏚️', nombre: 'Casa mediana 22m²', precio: 17600 },
        { emoji: '🏚️', nombre: 'Casa mediana 24m²', precio: 19200 },
        { emoji: '🏠', nombre: 'Casa grande 40m²', precio: 32000 },
        { emoji: '🏠', nombre: 'Casa grande 45m²', precio: 36000 },
        { emoji: '🏠', nombre: 'Casa grande 50m²', precio: 40000 },
        { emoji: '🏠', nombre: 'Casona pequeña 60m²', precio: 48000 },
        { emoji: '🏠', nombre: 'Casona pequeña 70m²', precio: 56000 },
        { emoji: '🏠', nombre: 'Casona pequeña 80m²', precio: 64000 },
        { emoji: '🏡', nombre: 'Casona mediana-pequeña 100m²', precio: 80000 },
        { emoji: '🏡', nombre: 'Casona mediana-pequeña 120m²', precio: 96000 },
        { emoji: '🏡', nombre: 'Casona mediana-pequeña 150m²', precio: 120000 },
        { emoji: '🏡', nombre: 'Casona mediana 200m²', precio: 160000 },
        { emoji: '🏡', nombre: 'Casona mediana 250m²', precio: 200000 },
        { emoji: '🏡', nombre: 'Casona mediana 300m²', precio: 240000 },
        { emoji: '🏡', nombre: 'Casona grande 400m²', precio: 320000 },
        { emoji: '🏡', nombre: 'Casona grande 500m²', precio: 400000 },
        { emoji: '🏡', nombre: 'Casona grande 600m²', precio: 480000 },
        { emoji: '🏢', nombre: 'Mansión mediana 700m²', precio: 560000 },
        { emoji: '🏢', nombre: 'Mansión mediana 800m²', precio: 640000 },
        { emoji: '🏢', nombre: 'Mansión mediana 900m²', precio: 720000 },
        { emoji: '🏢', nombre: 'Mansión 1000m²', precio: 800000 },
        { emoji: '🏢', nombre: 'Mansión 1500m²', precio: 1200000 },
        { emoji: '🏢', nombre: 'Mansión 2000m²', precio: 1600000 },
        { emoji: '🏰', nombre: 'Castillo 3000m²', precio: 2400000 },
        { emoji: '🏰', nombre: 'Castillo 4000m²', precio: 3200000 },
        { emoji: '🏰', nombre: 'Castillo 5000m²', precio: 4000000 }
      ],
      materiales: [
        { emoji: '🪨', nombre: 'Piedra (m³)', precio: 5 },
        { emoji: '🪨', nombre: 'Granito (m²)', precio: 3 },
        { emoji: '🪨', nombre: 'Adoquín (m²)', precio: 2 },
        { emoji: '🪨', nombre: 'Mármol (m²)', precio: 4 },
        { emoji: '🪨', nombre: 'Pizarra (m²)', precio: 3 },
        { emoji: '🪨', nombre: 'Caliza (m³)', precio: 2 },
        { emoji: '🪨', nombre: 'Arenisca (m²)', precio: 1 },
        { emoji: '🪨', nombre: 'Grava (m³)', precio: 1 },
        { emoji: '🪨', nombre: 'Terrazo (m²)', precio: 3 },
        { emoji: '🪨', nombre: 'Piedra artificial (m²)', precio: 7 },
        { emoji: '🧱', nombre: '1 Bolsa de Cal', precio: 3 },
        { emoji: '🧱', nombre: '5kg de Yeso', precio: 4 },
        { emoji: '🧱', nombre: 'Escayola (m²)', precio: 2 },
        { emoji: '🧱', nombre: '1 Bolsa de Cemento', precio: 3 },
        { emoji: '🧱', nombre: '1 Placa de Fibrocemento', precio: 3 },
        { emoji: '🧱', nombre: '1 Bolsa de Mortero', precio: 3 },
        { emoji: '🧱', nombre: 'Hormigón (m³)', precio: 5 },
        { emoji: '🧱', nombre: 'Hormigón simple (m³)', precio: 2 },
        { emoji: '🧱', nombre: 'Hormigón armado (m³)', precio: 5 },
        { emoji: '🧱', nombre: 'Hormigón preforzado (m³)', precio: 7 },
        { emoji: '🧱', nombre: 'GRC (m²)', precio: 5 },
        { emoji: '🧱', nombre: 'Palet de Bloque de hormigón', precio: 9 },
        { emoji: '🧱', nombre: 'Placa de Cartón yeso (Durlock)', precio: 4 },
        { emoji: '🧱', nombre: 'Panel de Lana de roca', precio: 7 },
        { emoji: '🧱', nombre: 'Rollo de Fibra de vidrio', precio: 5 },
        { emoji: '🧱', nombre: 'Palet de Adobe', precio: 4 },
        { emoji: '🧱', nombre: 'Palet de Ladrillo común', precio: 5 },
        { emoji: '🧱', nombre: 'Palet de Ladrillo cocido de arcilla', precio: 3 },
        { emoji: '🧱', nombre: 'Palet de Ladrillo visto', precio: 3 },
        { emoji: '🧱', nombre: 'Palet de Ladrillo hueco', precio: 3 },
        { emoji: '🧱', nombre: 'Palet de Ladrillo decorativo caravista', precio: 4 },
        { emoji: '🧱', nombre: 'Palet de Ladrillo de estilo rústico', precio: 4 },
        { emoji: '🧱', nombre: 'Palet de Ladrillo refractario', precio: 6 },
        { emoji: '🏖️', nombre: 'Bolsa de Arena', precio: 1 },
        { emoji: '🏖️', nombre: 'Bolsa de Arena gruesa', precio: 2 },
        { emoji: '🏖️', nombre: 'Bolsa de Arena fina', precio: 2 },
        { emoji: '🪟', nombre: 'Vidrio (m²)', precio: 4 },
        { emoji: '🪟', nombre: 'Vidrio celular (m²)', precio: 6 },
        { emoji: '🪨', nombre: 'Kilo de Arcilla', precio: 1 },
        { emoji: '🪨', nombre: 'Cob (m²)', precio: 3 },
        { emoji: '🪨', nombre: 'Teja (m²)', precio: 2 },
        { emoji: '🪨', nombre: 'Gres (m²)', precio: 3 },
        { emoji: '🪨', nombre: 'Azulejo (m²)', precio: 2 },
        { emoji: '🪨', nombre: 'Lodo bentonítico (m³)', precio: 3 },
        { emoji: '⚙️', nombre: 'Kg de Acero', precio: 12 },
        { emoji: '⚙️', nombre: '4 Perfiles metálicos', precio: 8 },
        { emoji: '⚙️', nombre: 'Docena de Varillas', precio: 5 },
        { emoji: '⚙️', nombre: 'Kg de Acero inoxidable', precio: 20 },
        { emoji: '⚙️', nombre: 'Kg de Acero corten', precio: 25 },
        { emoji: '⚙️', nombre: 'Kg de Aluminio', precio: 5 },
        { emoji: '⚙️', nombre: 'Kg de Zinc', precio: 4 },
        { emoji: '⚙️', nombre: 'Kg de Titanio', precio: 23 },
        { emoji: '⚙️', nombre: 'Kg de Cobre', precio: 8 },
        { emoji: '⚙️', nombre: 'Kg de Plomo', precio: 10 },
        { emoji: '⚙️', nombre: 'Kg de Hierro', precio: 9 },
        { emoji: '⚙️', nombre: 'Kg de Plata', precio: 11 },
        { emoji: '🌿', nombre: 'Paja (m³)', precio: 1 },
        { emoji: '🌿', nombre: 'Bambú (m³)', precio: 4 },
        { emoji: '🌿', nombre: 'Kg de Corcho', precio: 1 },
        { emoji: '🌿', nombre: 'Kg de Lino', precio: 2 },
        { emoji: '🪵', nombre: 'Madera (m²)', precio: 5 },
        { emoji: '🪵', nombre: 'Guadua (m³)', precio: 4 },
        { emoji: '🪵', nombre: 'Contrachapado (m²)', precio: 2 },
        { emoji: '🪵', nombre: 'OSB (m²)', precio: 2 },
        { emoji: '🪵', nombre: 'Tablero aglomerado (m²)', precio: 3 },
        { emoji: '🪵', nombre: 'Madera cemento (m²)', precio: 5 },
        { emoji: '🪵', nombre: 'Linóleo (m²)', precio: 2 },
        { emoji: '🧴', nombre: 'Kg de Plásticos', precio: 1 },
        { emoji: '🧴', nombre: 'Alquitranes (m³)', precio: 2 },
        { emoji: '🧴', nombre: 'Kg de Polímero', precio: 4 },
        { emoji: '🧴', nombre: 'Sellante (ml)', precio: 3 },
        { emoji: '🧴', nombre: 'Impermeabilizantes (m²)', precio: 4 },
        { emoji: '🧴', nombre: 'Aislantes térmicos (m²)', precio: 4 },
        { emoji: '🎨', nombre: '1 Litro de Pintura', precio: 1 },
        { emoji: '🎨', nombre: '1 Litro de Esmalte', precio: 1 },
        { emoji: '🎨', nombre: '1 Litro de Barniz', precio: 4 },
        { emoji: '🎨', nombre: '1 Litro de Lasures', precio: 3 },
        { emoji: '🧴', nombre: 'Tubo PVC (ml)', precio: 2 },
        { emoji: '🧴', nombre: 'Placa PVC (m²)', precio: 3 },
        { emoji: '🧴', nombre: 'Suelos vinílicos (m²)', precio: 3 },
        { emoji: '🧴', nombre: 'Kg de Polietileno', precio: 2 },
        { emoji: '🧴', nombre: 'Poliestireno (m³)', precio: 2 },
        { emoji: '🧴', nombre: 'Placa de Telgopor (m²)', precio: 3 },
        { emoji: '🧴', nombre: 'Poliestireno extrusionado (m²)', precio: 5 },
        { emoji: '🧴', nombre: 'Kg de Polipropileno', precio: 4 },
        { emoji: '🧴', nombre: '1 Litro de Poliuretano', precio: 6 },
        { emoji: '🧴', nombre: 'Poliéster (ml)', precio: 4 },
        { emoji: '🧴', nombre: 'ETFE (m²)', precio: 5 },
        { emoji: '🧴', nombre: 'EPDM (m²)', precio: 2 },
        { emoji: '🧴', nombre: 'Neopreno (m²)', precio: 3 },
        { emoji: '🧴', nombre: '1 Litro de Resina epoxi', precio: 2 },
        { emoji: '🧴', nombre: 'Acrílicos (m²)', precio: 3 },
        { emoji: '🧴', nombre: 'Metacrilato (m²)', precio: 4 },
        { emoji: '🎨', nombre: '1 Litro de Pintura acrílica', precio: 2 },
        { emoji: '🧴', nombre: '1 Litro de Silicona', precio: 2 },
        { emoji: '🛣️', nombre: 'Tonelada de Asfalto', precio: 12 }
      ]
    },

    armas: {
      metales_armas: [
        { emoji: '⚔️', nombre: 'Acero Nv1 (1kg)', precio: 20 },
        { emoji: '⚔️', nombre: 'Titanio Nv1 (1kg)', precio: 17 },
        { emoji: '⚔️', nombre: 'Hierro Nv1 (1kg)', precio: 13 },
        { emoji: '⚔️', nombre: 'Misita Nv2 (1kg)', precio: 65 },
        { emoji: '⚔️', nombre: 'Tirintina Nv2 (1kg)', precio: 67 },
        { emoji: '⚔️', nombre: 'Firin Nv2 (1kg)', precio: 60 },
        { emoji: '⚔️', nombre: 'Kirin Nv2 (1kg)', precio: 61 },
        { emoji: '⚔️', nombre: 'Marusilla Nv2 (1kg)', precio: 58 },
        { emoji: '⚔️', nombre: 'Malaquilla Nv3 (1kg)', precio: 280 },
        { emoji: '⚔️', nombre: 'Pachatin Nv3 (1kg)', precio: 270 },
        { emoji: '⚔️', nombre: 'Sisurm Nv3 (1kg)', precio: 275 },
        { emoji: '⚔️', nombre: 'Kingo Nv3 (1kg)', precio: 265 },
        { emoji: '⚔️', nombre: 'Nacaril Nv4 (1kg)', precio: 730 },
        { emoji: '⚔️', nombre: 'Coralt Nv4 (1kg)', precio: 720 },
        { emoji: '⚔️', nombre: 'Balnitiro Nv4 (1kg)', precio: 725 },
        { emoji: '⚔️', nombre: 'Aligatorcaspi Nv4 (1kg)', precio: 750 },
        { emoji: '⚔️', nombre: 'Valerio Nv5 (1kg)', precio: 1840 },
        { emoji: '⚔️', nombre: 'Tetragramant Nv5 (1kg)', precio: 1800 },
        { emoji: '⚔️', nombre: 'Galeano Nv5 (1kg)', precio: 1860 },
        { emoji: '⚔️', nombre: 'Escratula Nv5 (1kg)', precio: 1820 },
        { emoji: '⚔️', nombre: 'Aserio Nv6 (1kg)', precio: 20420 },
        { emoji: '⚔️', nombre: 'Aserio Val Nv6 (1kg)', precio: 30450 },
        { emoji: '⚔️', nombre: 'Aserio Negro Nv6 (1kg)', precio: 44370 },
        { emoji: '⚔️', nombre: 'Thor Nv6 (1kg)', precio: 44350 },
        { emoji: '⚔️', nombre: 'Adamantita Nv7 (1kg)', precio: 50200 },
        { emoji: '⚔️', nombre: 'Kalkon Nv7 (1kg)', precio: 60500 },
        { emoji: '⚔️', nombre: 'Kalkon Oscuro Nv7 (1kg)', precio: 80600 }
      ],
      preciosos: [
        { emoji: '💛', nombre: 'Oro (1tn)', precio: 0.05 },
        { emoji: '🟤', nombre: 'Cobre (1kg)', precio: 11 },
        { emoji: '⚪', nombre: 'Aluminio (1kg)', precio: 9 },
        { emoji: '⚪', nombre: 'Plata (1kg)', precio: 2300 },
        { emoji: '⚪', nombre: 'Platino (1kg)', precio: 4400 },
        { emoji: '💎', nombre: 'Diamante baja calidad (1 kilate)', precio: 2200 },
        { emoji: '💎', nombre: 'Diamante alta calidad (1 kilate)', precio: 3200 },
        { emoji: '💚', nombre: 'Esmeralda baja calidad', precio: 1200 },
        { emoji: '💚', nombre: 'Esmeralda alta calidad', precio: 2400 },
        { emoji: '❤️', nombre: 'Ruby', precio: 2600 },
        { emoji: '⚫', nombre: 'Tungsteno (1kg)', precio: 3600 }
      ]
    }

  };

  var catalogosGresit = {
    g_carnes: [
      { emoji: '🥩', nombre: 'Vaca (500g)', precio: 22 },
      { emoji: '🥩', nombre: 'Oveja (500g)', precio: 16 },
      { emoji: '🥩', nombre: 'Cerdo (500g)', precio: 18 },
      { emoji: '🥩', nombre: 'Conejo (500g)', precio: 12 },
      { emoji: '🦆', nombre: 'Pato (500g)', precio: 15 },
      { emoji: '🍗', nombre: 'Pollo (500g)', precio: 14 },
      { emoji: '🦌', nombre: 'Antílope (500g)', precio: 25 },
      { emoji: '🐻', nombre: 'Oso (500g)', precio: 30 },
      { emoji: '🐊', nombre: 'Cocodrilo (500g)', precio: 40 }
    ],
    g_verduras: [
      { emoji: '🥔', nombre: 'Papa (1 unidad)', precio: 3 },
      { emoji: '🧅', nombre: 'Cebolla (1 unidad)', precio: 2 },
      { emoji: '🧄', nombre: 'Ajo (1 unidad)', precio: 1 },
      { emoji: '🥬', nombre: 'Lechuga (1 unidad)', precio: 4 },
      { emoji: '🍅', nombre: 'Tomate (1 unidad)', precio: 3 },
      { emoji: '🥕', nombre: 'Zanahoria (1 unidad)', precio: 2 },
      { emoji: '🫑', nombre: 'Pimiento (1 unidad)', precio: 3 },
      { emoji: '🎃', nombre: 'Calabaza (1 unidad)', precio: 4 },
      { emoji: '🍆', nombre: 'Berenjena (1 unidad)', precio: 4 },
      { emoji: '🌿', nombre: 'Espinaca (1 unidad)', precio: 3 },
      { emoji: '🫘', nombre: 'Garbanzo (1 unidad)', precio: 4 },
      { emoji: '🥦', nombre: 'Brócoli (1 unidad)', precio: 5 },
      { emoji: '🥒', nombre: 'Pepino (1 unidad)', precio: 3 },
      { emoji: '🫑', nombre: 'Morrón (1 unidad)', precio: 3 },
      { emoji: '🌿', nombre: 'Perejil (1 unidad)', precio: 1 },
      { emoji: '🌿', nombre: 'Cilantro (1 unidad)', precio: 1 },
      { emoji: '🌽', nombre: 'Mazorca de Maíz (1 unidad)', precio: 4 }
    ],
    g_frutas: [
      { emoji: '🍎', nombre: 'Manzana (1 unidad)', precio: 3 },
      { emoji: '🍌', nombre: 'Banana (1 unidad)', precio: 1 },
      { emoji: '🍊', nombre: 'Naranja (1 unidad)', precio: 2 },
      { emoji: '🍇', nombre: 'Uva (15 unidades)', precio: 4 },
      { emoji: '🍐', nombre: 'Pera (1 unidad)', precio: 3 },
      { emoji: '🍓', nombre: 'Fresas (1 unidad)', precio: 2 },
      { emoji: '🍒', nombre: 'Cereza (1 unidad)', precio: 2 },
      { emoji: '🥑', nombre: 'Palta (1 unidad)', precio: 5 },
      { emoji: '🫐', nombre: 'Bayas silvestres (1 unidad)', precio: 6 },
      { emoji: '🥥', nombre: 'Coco (1 unidad)', precio: 4 },
      { emoji: '🍋', nombre: 'Limón (1 unidad)', precio: 2 },
      { emoji: '🍑', nombre: 'Durazno (1 unidad)', precio: 3 },
      { emoji: '🍉', nombre: 'Sandía (1 unidad)', precio: 7 },
      { emoji: '🍍', nombre: 'Piña (1 unidad)', precio: 6 }
    ],
    g_lacteos: [
      { emoji: '🥛', nombre: 'Leche (1L)', precio: 6 },
      { emoji: '🧀', nombre: 'Queso (500g)', precio: 12 },
      { emoji: '🍮', nombre: 'Crema Repostera (1 unidad)', precio: 5 },
      { emoji: '🥛', nombre: 'Yogurt (1L)', precio: 9 },
      { emoji: '🧈', nombre: 'Mantequilla (200g)', precio: 7 },
      { emoji: '🍯', nombre: 'Dulce de leche (1 unidad)', precio: 6 }
    ],
    g_panaderia: [
      { emoji: '🍞', nombre: 'Pan de Mil (1 unidad)', precio: 1000 },
      { emoji: '🍞', nombre: 'Pan (1 unidad)', precio: 4 },
      { emoji: '🍞', nombre: 'Pan Integral (1 unidad)', precio: 8 },
      { emoji: '🍞', nombre: 'Pan Dulce (1 unidad)', precio: 6 },
      { emoji: '🍞', nombre: 'Pan Relleno (1 unidad)', precio: 5 },
      { emoji: '🍞', nombre: 'Pan Rallado (500g)', precio: 6 },
      { emoji: '🥐', nombre: 'Factura (1 unidad)', precio: 4 },
      { emoji: '🍪', nombre: 'Galleta (1 unidad)', precio: 2 },
      { emoji: '🎂', nombre: 'Torta Asada (1 unidad)', precio: 10 },
      { emoji: '🧇', nombre: 'Torta Frita (1 unidad)', precio: 7 },
      { emoji: '🍩', nombre: 'Buñuelo (1 unidad)', precio: 5 },
      { emoji: '🫓', nombre: 'Chipa (1 unidad)', precio: 4 }
    ],
    g_postres: [
      { emoji: '🥧', nombre: 'Tarta (1 unidad)', precio: 25 },
      { emoji: '🎂', nombre: 'Pastel (1 unidad)', precio: 40 },
      { emoji: '🧁', nombre: 'Pastelito (1 unidad)', precio: 15 },
      { emoji: '🍫', nombre: 'Chocolate Negro (1 barra)', precio: 10 },
      { emoji: '🍫', nombre: 'Chocolate Blanco (1 barra)', precio: 10 },
      { emoji: '🍬', nombre: 'Caramelo (1 unidad)', precio: 1 },
      { emoji: '🍭', nombre: 'Paleta Dulce (1 unidad)', precio: 3 },
      { emoji: '🍫', nombre: 'Bombón (1 caja)', precio: 20 },
      { emoji: '🥚', nombre: 'Huevo de Pascua (1 unidad)', precio: 30 },
      { emoji: '🍮', nombre: 'Flan (1 unidad)', precio: 12 },
      { emoji: '🥧', nombre: 'Pastafrola (1 unidad)', precio: 16 },
      { emoji: '🍭', nombre: 'Chupetin (1 unidad)', precio: 1 },
      { emoji: '🍮', nombre: 'Gelatina (1 unidad)', precio: 5 },
      { emoji: '🍓', nombre: 'Mermelada (1 frasco)', precio: 7 },
      { emoji: '🍎', nombre: 'Manzana Acaramelada (1 unidad)', precio: 6 },
      { emoji: '🍭', nombre: 'Algodón de Azúcar (1 porción)', precio: 4 },
      { emoji: '🍨', nombre: 'Helado (1L)', precio: 13 }
    ],
    g_preparados: [
      { emoji: '🍔', nombre: 'Hamburguesa (1 unidad)', precio: 30 },
      { emoji: '🥩', nombre: 'Milanesa (1 unidad)', precio: 22 },
      { emoji: '🍗', nombre: 'Milanesa de Pollo (1 unidad)', precio: 20 },
      { emoji: '🥩', nombre: 'Milanesa Napolitana (1 unidad)', precio: 25 },
      { emoji: '🌭', nombre: 'Choripan (1 unidad)', precio: 12 },
      { emoji: '🌭', nombre: 'Hotdog (1 unidad)', precio: 9 },
      { emoji: '🍕', nombre: 'Pizza (1 unidad)', precio: 35 },
      { emoji: '🥗', nombre: 'Ensalada (1 unidad)', precio: 25 },
      { emoji: '🍜', nombre: 'Ramen (1 tazón)', precio: 40 },
      { emoji: '🍣', nombre: 'Sushi (1 pieza)', precio: 6 },
      { emoji: '🥟', nombre: 'Empanada (1 unidad)', precio: 4 },
      { emoji: '🍟', nombre: 'Papa Frita (1 cajita)', precio: 7 },
      { emoji: '🍟', nombre: 'Papa Frita L.P. (1 cajita)', precio: 9 },
      { emoji: '🥪', nombre: 'Sandwich Clásico (1 unidad)', precio: 18 },
      { emoji: '🥪', nombre: 'Sandwich de Miga (1 unidad)', precio: 15 },
      { emoji: '🍔', nombre: 'Bollo de Carne (1 unidad)', precio: 20 },
      { emoji: '🍙', nombre: 'Bollo de Arroz (1 unidad)', precio: 10 },
      { emoji: '🍿', nombre: 'Palomita de Maíz (1 cajita)', precio: 5 },
      { emoji: '🥞', nombre: 'Panqueque (1 unidad)', precio: 12 },
      { emoji: '🧆', nombre: 'Albóndiga (1 unidad)', precio: 6 },
      { emoji: '🌮', nombre: 'Taco (1 unidad)', precio: 18 },
      { emoji: '🌯', nombre: 'Burrito (1 unidad)', precio: 25 },
      { emoji: '🥘', nombre: 'Estofado (1 unidad)', precio: 20 },
      { emoji: '🍝', nombre: 'Espagueti con Salsa (1 unidad)', precio: 24 },
      { emoji: '🍚', nombre: 'Arroz Hervido (1 porción)', precio: 8 },
      { emoji: '🍚', nombre: 'Arroz con Pollo (1 porción)', precio: 20 },
      { emoji: '🍗', nombre: 'Nuggets (1 unidad)', precio: 18 },
      { emoji: '🍟', nombre: 'Salchipapas (1 porción)', precio: 15 },
      { emoji: '🫓', nombre: 'Arepa Rellena (1 unidad)', precio: 13 }
    ],
    g_condimentos: [
      { emoji: '🧂', nombre: 'Sal (1 paquete)', precio: 2 },
      { emoji: '🥚', nombre: 'Huevo (1 unidad)', precio: 2 },
      { emoji: '🌶️', nombre: 'Pimienta (1 unidad)', precio: 1 },
      { emoji: '🫙', nombre: 'Aceite de Girasol (1L)', precio: 10 },
      { emoji: '🫙', nombre: 'Aceite de Oliva (1L)', precio: 10 },
      { emoji: '🍯', nombre: 'Miel (1 frasco)', precio: 7 },
      { emoji: '🍋', nombre: 'Jugo de Limón (1L)', precio: 5 },
      { emoji: '🌾', nombre: 'Harina (1 paquete)', precio: 4 },
      { emoji: '🧂', nombre: 'Azúcar (1 paquete)', precio: 3 },
      { emoji: '🫙', nombre: 'Polvo de Hornear (1 paquete)', precio: 1 },
      { emoji: '🫙', nombre: 'Bicarbonato de Sodio (1 paquete)', precio: 1 },
      { emoji: '🍅', nombre: 'Puré de Tomate (1 frasco)', precio: 4 },
      { emoji: '🫙', nombre: 'Esencia de Vainilla (1 frasco)', precio: 2 }
    ],
    g_preelaborados: [
      { emoji: '🍕', nombre: 'Pre-Pizza (1 unidad)', precio: 15 },
      { emoji: '🍝', nombre: 'Fideos (1 paquete)', precio: 10 },
      { emoji: '🍝', nombre: 'Ñoquis (1 paquete)', precio: 15 },
      { emoji: '🍝', nombre: 'Ravioles (1 paquete)', precio: 15 },
      { emoji: '🌭', nombre: 'Salchichas (1 unidad)', precio: 3 },
      { emoji: '🌭', nombre: 'Chorizo (1 unidad)', precio: 13 },
      { emoji: '🥟', nombre: 'Tapas de Empanada (20 unidades)', precio: 9 },
      { emoji: '🥧', nombre: 'Masa para Tartas (1 unidad)', precio: 13 },
      { emoji: '🥞', nombre: 'Masa para Panqueques (1 unidad)', precio: 6 },
      { emoji: '🍔', nombre: 'Carne de Hamburguesa (1 unidad)', precio: 8 }
    ],
    g_bebidas: [
      { emoji: '🧃', nombre: 'Jugos Frutales (1L)', precio: 20 },
      { emoji: '🥤', nombre: 'Gaseosa (1L)', precio: 25 },
      { emoji: '🧋', nombre: 'Batido (1 unidad)', precio: 13 },
      { emoji: '☕', nombre: 'Café (1 taza)', precio: 5 },
      { emoji: '☕', nombre: 'Café Helado (1 vaso)', precio: 7 },
      { emoji: '☕', nombre: 'Café Descafeinado (1 taza)', precio: 6 },
      { emoji: '💧', nombre: 'Agua Mineral (1L)', precio: 10 },
      { emoji: '💧', nombre: 'Agua Saborizada (1L)', precio: 15 },
      { emoji: '🍵', nombre: 'Té (1 taza)', precio: 4 },
      { emoji: '🍵', nombre: 'Té Helado (1 vaso)', precio: 6 },
      { emoji: '🍵', nombre: 'Té Verde (1 taza)', precio: 5 },
      { emoji: '⚡', nombre: 'Energizante Saborizado (250ml)', precio: 20 },
      { emoji: '🥃', nombre: 'Whisky (750ml)', precio: 400 },
      { emoji: '🍷', nombre: 'Vino (750ml)', precio: 100 },
      { emoji: '🍺', nombre: 'Cerveza (1L)', precio: 120 },
      { emoji: '🥃', nombre: 'Agua Ardiente (750ml)', precio: 75 }
    ],
    g_casas: [
      { emoji: '🛖', nombre: 'Cabaña de trabajador', precio: 7500 },
      { emoji: '🏚️', nombre: 'Casa pequeña urbana', precio: 10500 },
      { emoji: '🏚️', nombre: 'Casa familiar básica', precio: 14000 },
      { emoji: '🏚️', nombre: 'Vivienda artesanal', precio: 17500 },
      { emoji: '🏚️', nombre: 'Casa doble adosada', precio: 19000 },
      { emoji: '🏠', nombre: 'Casa con tienda frontal', precio: 24000 },
      { emoji: '🏠', nombre: 'Residencia comerciante', precio: 29000 },
      { emoji: '🏠', nombre: 'Casa ribereña', precio: 34000 },
      { emoji: '🏠', nombre: 'Posada pequeña', precio: 40000 },
      { emoji: '🏠', nombre: 'Taller + vivienda', precio: 46000 },
      { emoji: '🏡', nombre: 'Casa burguesa', precio: 55000 },
      { emoji: '🏡', nombre: 'Residencia administrativa', precio: 68000 },
      { emoji: '🏡', nombre: 'Villa urbana', precio: 82000 },
      { emoji: '🏡', nombre: 'Casa señorial', precio: 96000 },
      { emoji: '🏢', nombre: 'Mansión menor', precio: 120000 },
      { emoji: '🏢', nombre: 'Villa noble', precio: 165000 },
      { emoji: '🏢', nombre: 'Palacio urbano', precio: 220000 },
      { emoji: '🏢', nombre: 'Palacio con jardines', precio: 310000 },
      { emoji: '🏢', nombre: 'Residencia imperial privada', precio: 450000 },
      { emoji: '🏰', nombre: 'Fortaleza residencial', precio: 600000 },
      { emoji: '🏰', nombre: 'Complejo mercantil cerrado', precio: 750000 },
      { emoji: '🏰', nombre: 'Castillo menor', precio: 1200000 }
    ]
  };

var catalogosIrkustk = {
    irkustk_casas: [
      { emoji: '🏠', nombre: 'Construcción Irkustk 1', precio: 0 },
      { emoji: '🏠', nombre: 'Construcción Irkustk 2', precio: 0 },
      { emoji: '🏠', nombre: 'Construcción Irkustk 3', precio: 0 },
      { emoji: '🏠', nombre: 'Construcción Irkustk 4', precio: 0 },
      { emoji: '🏠', nombre: 'Construcción Irkustk 5', precio: 0 }
    ]
  };

  if (categoria === 'irkustk' && catalogosIrkustk[subcategoria]) {
    return catalogosIrkustk[subcategoria];
  }

  if (categoria === 'gresit' && catalogosGresit[subcategoria]) {
    return catalogosGresit[subcategoria];
  }

  if (catalogos[categoria] && catalogos[categoria][subcategoria]) {
    return catalogos[categoria][subcategoria];
  }
  return [];
}

function renderCitas() {
  mainContent.innerHTML =
    '<div class="card"><h3>💘 Citas</h3></div>' +
    '<div id="citas-panel"></div>';
  
  verificarPerfilCitas();
}

async function verificarPerfilCitas() {
  var panel = document.getElementById('citas-panel');
  var snap = await getDoc(doc(db, 'citas_perfiles', currentUser.uid));
  
  if (!snap.exists()) {
    renderRegistroCitas(panel);
  } else {
    renderMenuCitas(panel, snap.data());
  }
}

function renderRegistroCitas(panel) {
  panel.innerHTML =
    '<div class="card" style="text-align:center;padding:2rem">' +
      '<p style="font-size:2rem">💘</p>' +
      '<h3 style="margin-bottom:0.5rem">Bienvenido a Citas</h3>' +
      '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1.5rem">Para aparecer en el buscador y ver otros perfiles, primero completa tu perfil de citas.</p>' +
      '<button class="btn btn-primary btn-full" id="btn-crear-perfil-citas">💘 Crear mi perfil de citas</button>' +
    '</div>';

  document.getElementById('btn-crear-perfil-citas').addEventListener('click', function() {
    renderFormularioCitas(panel, null);
  });
}

function renderFormularioCitas(panel, datosExistentes) {
  var esEdicion = datosExistentes !== null;
  panel.innerHTML =
    '<div class="card">' +
      '<h3 style="margin-bottom:1rem">' + (esEdicion ? '✏️ Editar perfil de citas' : '💘 Crear perfil de citas') + '</h3>' +

      '<p class="edit-section-title">Género</p>' +
      '<div class="citas-opciones" id="citas-genero">' +
        ['Masculino', 'Femenino', 'Otro'].map(function(g) {
          return '<button class="citas-opcion' + (datosExistentes && datosExistentes.genero === g ? ' selected' : '') + '" data-val="' + g + '">' + g + '</button>';
        }).join('') +
      '</div>' +

      '<p class="edit-section-title" style="margin-top:1rem">Orientación sexual</p>' +
      '<div class="citas-opciones" id="citas-orientacion">' +
        ['Heterosexual', 'Homosexual', 'Bisexual', 'Pansexual', 'Otro'].map(function(o) {
          return '<button class="citas-opcion' + (datosExistentes && datosExistentes.orientacion === o ? ' selected' : '') + '" data-val="' + o + '">' + o + '</button>';
        }).join('') +
      '</div>' +
      '<div id="orientacion-otro-wrap" class="hidden">' +
        '<input type="text" id="orientacion-otro-input" placeholder="Escribe tu orientación (máx. 20 caracteres)" maxlength="20" style="margin-top:0.5rem;width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block" value="' + (datosExistentes && datosExistentes.orientacionCustom ? datosExistentes.orientacionCustom : '') + '" />' +
      '</div>' +

      '<p class="edit-section-title" style="margin-top:1rem">Estado civil</p>' +
      '<div class="citas-opciones" id="citas-estado">' +
        ['Soltero/a', 'Viudo/a', 'Relación polígama'].map(function(e) {
          return '<button class="citas-opcion' + (datosExistentes && datosExistentes.estadoCivil === e ? ' selected' : '') + '" data-val="' + e + '">' + e + '</button>';
        }).join('') +
      '</div>' +

      '<p class="edit-section-title" style="margin-top:1rem">¿Qué tipo de relación buscas? <span style="color:var(--text-secondary);font-size:0.75rem">(máx. 100 caracteres)</span></p>' +
      '<input type="text" id="citas-busca" maxlength="100" placeholder="Ej: Una relación seria y estable..." value="' + (datosExistentes ? (datosExistentes.queBusca || '') : '') + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block" />' +

      '<p class="edit-section-title" style="margin-top:1rem">Descripción breve <span style="color:var(--text-secondary);font-size:0.75rem">(máx. 150 caracteres)</span></p>' +
      '<textarea id="citas-descripcion" maxlength="150" placeholder="Cuéntanos un poco sobre ti..." style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;min-height:80px;resize:vertical">' + (datosExistentes ? (datosExistentes.descripcion || '') : '') + '</textarea>' +

      '<p class="edit-section-title" style="margin-top:1rem">Frase (opcional)</p>' +
      '<input type="text" id="citas-frase" placeholder="Una frase que te represente..." value="' + (datosExistentes ? (datosExistentes.frase || '') : '') + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block" />' +

      '<button class="btn btn-primary btn-full" id="btn-guardar-perfil-citas" style="margin-top:1rem">' + (esEdicion ? '💾 Guardar cambios' : '💘 Publicar perfil') + '</button>' +
      (esEdicion ? '<button class="btn btn-secondary btn-full" id="btn-cancelar-edicion-citas" style="margin-top:0.5rem">Cancelar</button>' : '') +
      '<div id="citas-form-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  // Lógica de selección de opciones
  ['citas-genero', 'citas-orientacion', 'citas-estado'].forEach(function(grupoId) {
    document.getElementById(grupoId).querySelectorAll('.citas-opcion').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.getElementById(grupoId).querySelectorAll('.citas-opcion').forEach(function(b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        if (grupoId === 'citas-orientacion') {
          var otroWrap = document.getElementById('orientacion-otro-wrap');
          if (btn.dataset.val === 'Otro') otroWrap.classList.remove('hidden');
          else otroWrap.classList.add('hidden');
        }
      });
    });
  });

  // Mostrar campo "otro" si ya estaba seleccionado
  if (datosExistentes && datosExistentes.orientacion === 'Otro') {
    document.getElementById('orientacion-otro-wrap').classList.remove('hidden');
  }

  if (esEdicion) {
    document.getElementById('btn-cancelar-edicion-citas').addEventListener('click', function() {
      verificarPerfilCitas();
    });
  }

  document.getElementById('btn-guardar-perfil-citas').addEventListener('click', async function() {
    var generoBtn = document.querySelector('#citas-genero .citas-opcion.selected');
    var orientacionBtn = document.querySelector('#citas-orientacion .citas-opcion.selected');
    var estadoBtn = document.querySelector('#citas-estado .citas-opcion.selected');
    var queBusca = document.getElementById('citas-busca').value.trim();
    var descripcion = document.getElementById('citas-descripcion').value.trim();
    var frase = document.getElementById('citas-frase').value.trim();
    var msg = document.getElementById('citas-form-msg');

    if (!generoBtn) { msg.textContent = 'Selecciona un género'; msg.style.color = 'var(--danger)'; return; }
    if (!orientacionBtn) { msg.textContent = 'Selecciona una orientación'; msg.style.color = 'var(--danger)'; return; }
    if (!estadoBtn) { msg.textContent = 'Selecciona tu estado civil'; msg.style.color = 'var(--danger)'; return; }
    if (!queBusca) { msg.textContent = 'Indica qué tipo de relación buscas'; msg.style.color = 'var(--danger)'; return; }
    if (!descripcion) { msg.textContent = 'Escribe una descripción'; msg.style.color = 'var(--danger)'; return; }

    var orientacion = orientacionBtn.dataset.val;
    var orientacionCustom = '';
    if (orientacion === 'Otro') {
      orientacionCustom = document.getElementById('orientacion-otro-input').value.trim();
      if (!orientacionCustom) { msg.textContent = 'Escribe tu orientación'; msg.style.color = 'var(--danger)'; return; }
    }

    var btn = document.getElementById('btn-guardar-perfil-citas');
    btn.disabled = true; btn.textContent = 'Guardando...';

    var datos = {
      uid: currentUser.uid,
      username: currentUser.username,
      genero: generoBtn.dataset.val,
      orientacion: orientacion,
      orientacionCustom: orientacionCustom,
      estadoCivil: estadoBtn.dataset.val,
      queBusca: queBusca,
      descripcion: descripcion,
      frase: frase,
      activo: true,
      actualizadoEn: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'citas_perfiles', currentUser.uid), datos);
      msg.textContent = '✓ Perfil ' + (esEdicion ? 'actualizado' : 'publicado');
      msg.style.color = 'var(--success)';
      setTimeout(function() { verificarPerfilCitas(); }, 1000);
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
      msg.style.color = 'var(--danger)';
      btn.disabled = false;
      btn.textContent = esEdicion ? '💾 Guardar cambios' : '💘 Publicar perfil';
    }
  });
}

function renderMenuCitas(panel, miPerfil) {
  panel.innerHTML =
    '<div class="citas-menu-btns">' +
      '<button class="btn-citas-menu" id="btn-explorar-citas"><span>🃏</span><span>Explorar</span></button>' +
      '<button class="btn-citas-menu" id="btn-mis-matches"><span>💞</span><span>Mis Matches</span></button>' +
    '</div>' +
    '<div class="citas-menu-secundario">' +
      '<button class="btn btn-secondary" id="btn-editar-perfil-citas" style="flex:1;font-size:0.82rem">✏️ Editar mi perfil</button>' +
      '<button class="btn btn-secondary" id="btn-borrar-perfil-citas" style="flex:1;font-size:0.82rem;border-color:var(--danger);color:var(--danger)">🗑️ Eliminar perfil</button>' +
    '</div>' +
    '<div id="citas-contenido"></div>';

  document.getElementById('btn-explorar-citas').addEventListener('click', function() {
    renderExplorarCitas(miPerfil);
  });
  document.getElementById('btn-mis-matches').addEventListener('click', function() {
    renderMisMatches();
  });
  document.getElementById('btn-editar-perfil-citas').addEventListener('click', function() {
    renderFormularioCitas(panel, miPerfil);
  });
  document.getElementById('btn-borrar-perfil-citas').addEventListener('click', async function() {
    if (!confirm('¿Eliminar tu perfil de citas? Perderás tus matches.')) return;
    await deleteDoc(doc(db, 'citas_perfiles', currentUser.uid));
    verificarPerfilCitas();
  });
}

async function renderExplorarCitas(miPerfil) {
  var contenido = document.getElementById('citas-contenido');
  contenido.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<h3>🃏 Explorar perfiles</h3>' +
      '<button class="btn-filtrar-citas" id="btn-filtrar-citas">⚙️ Filtrar</button>' +
    '</div>' +
    '<div id="filtros-citas" class="hidden card" style="margin-bottom:0.75rem">' +
      '<p class="edit-section-title">Género</p>' +
      '<div class="citas-opciones" id="filtro-genero">' +
        ['Todos', 'Masculino', 'Femenino', 'Otro'].map(function(g) {
          return '<button class="citas-opcion' + (g === 'Todos' ? ' selected' : '') + '" data-val="' + g + '">' + g + '</button>';
        }).join('') +
      '</div>' +
      '<p class="edit-section-title" style="margin-top:0.75rem">Orientación</p>' +
      '<div class="citas-opciones" id="filtro-orientacion">' +
        ['Todos', 'Heterosexual', 'Homosexual', 'Bisexual', 'Pansexual', 'Otro'].map(function(o) {
          return '<button class="citas-opcion' + (o === 'Todos' ? ' selected' : '') + '" data-val="' + o + '">' + o + '</button>';
        }).join('') +
      '</div>' +
      '<p class="edit-section-title" style="margin-top:0.75rem">Estado civil</p>' +
      '<div class="citas-opciones" id="filtro-estado">' +
        ['Todos', 'Soltero/a', 'Viudo/a', 'Relación polígama'].map(function(e) {
          return '<button class="citas-opcion' + (e === 'Todos' ? ' selected' : '') + '" data-val="' + e + '">' + e + '</button>';
        }).join('') +
      '</div>' +
      '<p class="edit-section-title" style="margin-top:0.75rem">Ciudad</p>' +
      '<div class="citas-opciones" id="filtro-ciudad">' +
        ['Todas', 'Ryazan', 'Ryla', 'Kemerov', 'Navarra', 'Gresit', 'Odrekao', 'Irkustk'].map(function(c) {
          return '<button class="citas-opcion' + (c === 'Todas' ? ' selected' : '') + '" data-val="' + c + '">' + c + '</button>';
        }).join('') +
      '</div>' +
      '<button class="btn btn-primary btn-full" id="btn-aplicar-filtros" style="margin-top:0.75rem">Aplicar filtros</button>' +
    '</div>' +
    '<div id="tarjetas-citas"></div>';

  document.getElementById('btn-filtrar-citas').addEventListener('click', function() {
    document.getElementById('filtros-citas').classList.toggle('hidden');
  });

  ['filtro-genero', 'filtro-orientacion', 'filtro-estado', 'filtro-ciudad'].forEach(function(grupoId) {
    document.getElementById(grupoId).querySelectorAll('.citas-opcion').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.getElementById(grupoId).querySelectorAll('.citas-opcion').forEach(function(b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
    });
  });

  document.getElementById('btn-aplicar-filtros').addEventListener('click', function() {
    document.getElementById('filtros-citas').classList.add('hidden');
    cargarTarjetasCitas(miPerfil);
  });

  cargarTarjetasCitas(miPerfil);
}

async function cargarTarjetasCitas(miPerfil) {
  var tarjetas = document.getElementById('tarjetas-citas');
  tarjetas.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p>';

  var filtroGenero = document.querySelector('#filtro-genero .citas-opcion.selected');
  var filtroOrientacion = document.querySelector('#filtro-orientacion .citas-opcion.selected');
  var filtroEstado = document.querySelector('#filtro-estado .citas-opcion.selected');
  var filtroCiudad = document.querySelector('#filtro-ciudad .citas-opcion.selected');

  var snap = await getDocs(query(collection(db, 'citas_perfiles'), where('activo', '==', true)));
  var perfiles = snap.docs
    .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
    .filter(function(p) { return p.uid !== currentUser.uid; });

  if (filtroGenero && filtroGenero.dataset.val !== 'Todos') {
    perfiles = perfiles.filter(function(p) { return p.genero === filtroGenero.dataset.val; });
  }
  if (filtroOrientacion && filtroOrientacion.dataset.val !== 'Todos') {
    perfiles = perfiles.filter(function(p) { return p.orientacion === filtroOrientacion.dataset.val; });
  }
  if (filtroEstado && filtroEstado.dataset.val !== 'Todos') {
    perfiles = perfiles.filter(function(p) { return p.estadoCivil === filtroEstado.dataset.val; });
  }

  // Cruzar con datos de usuarios
  perfiles = await Promise.all(perfiles.map(async function(p) {
    var uSnap = await getDoc(doc(db, 'usuarios', p.uid));
    var uData = uSnap.exists() ? uSnap.data() : {};
    return Object.assign({}, p, {
      fotoPerfil: uData.fotoPerfil || '',
      ciudad: uData.ciudad || '',
      nivel: uData.nivel || '?',
      raza: uData.raza || '?',
      edad: uData.edad || '',
      whatsapp: uData.whatsapp || '',
      datoCurioso: uData.datoCurioso || ''
    });
  }));

  if (filtroCiudad && filtroCiudad.dataset.val !== 'Todas') {
    perfiles = perfiles.filter(function(p) { return p.ciudad === filtroCiudad.dataset.val; });
  }

  var likesSnap = await getDocs(query(collection(db, 'citas_likes'), where('de', '==', currentUser.uid)));
  var yaLike = {};
  likesSnap.docs.forEach(function(d) { yaLike[d.data().para] = true; });
  perfiles = perfiles.filter(function(p) { return !yaLike[p.uid]; });

  if (perfiles.length === 0) {
    tarjetas.innerHTML = '<div style="text-align:center;padding:3rem"><p style="font-size:2rem">😔</p><p style="color:var(--text-secondary)">No hay más perfiles por explorar.</p></div>';
    return;
  }

  var indice = 0;

  function mostrarTarjeta() {
    if (indice >= perfiles.length) {
      tarjetas.innerHTML = '<div style="text-align:center;padding:3rem"><p style="font-size:2rem">🎉</p><p style="color:var(--text-secondary)">Has visto todos los perfiles disponibles.</p></div>';
      return;
    }
    var p = perfiles[indice];
    tarjetas.innerHTML =
      '<div class="citas-tarjeta">' +
        (p.fotoPerfil ? '<img src="' + p.fotoPerfil + '" class="citas-tarjeta-foto" onerror="this.style.display=\'none\'" />' : '<div class="citas-tarjeta-foto-placeholder">👤</div>') +
        '<div class="citas-tarjeta-info">' +
          '<h3 class="citas-tarjeta-nombre">' + p.username + '</h3>' +
          '<p class="citas-tarjeta-dato">' + (p.ciudad || 'Sin ciudad') + ' · Nv.' + p.nivel + ' · ' + p.raza + '</p>' +
          (p.frase ? '<p class="citas-tarjeta-frase">"' + p.frase + '"</p>' : '') +
          '<button class="btn btn-secondary citas-tarjeta-ver-mas" id="btn-ver-mas-citas">Ver perfil completo ▼</button>' +
          '<div id="citas-perfil-completo" class="hidden">' +
            '<div class="citas-dato-row"><span>🎭 Género</span><span>' + p.genero + '</span></div>' +
            '<div class="citas-dato-row"><span>💫 Orientación</span><span>' + (p.orientacion === 'Otro' ? p.orientacionCustom : p.orientacion) + '</span></div>' +
            '<div class="citas-dato-row"><span>💍 Estado civil</span><span>' + p.estadoCivil + '</span></div>' +
            '<div class="citas-dato-row"><span>🎂 Edad</span><span>' + (p.edad || 'No indicada') + '</span></div>' +
            '<div class="citas-dato-row"><span>📱 WhatsApp</span><span>' + (p.whatsapp || 'No registrado') + '</span></div>' +
            '<div class="citas-dato-row"><span>✨ Dato curioso</span><span>' + (p.datoCurioso || 'Sin dato') + '</span></div>' +
            '<p style="margin-top:0.75rem;font-size:0.85rem;color:var(--text-secondary)">🔍 Busca:</p>' +
            '<p style="font-size:0.88rem;color:var(--text-primary);margin-bottom:0.5rem">' + p.queBusca + '</p>' +
            '<p style="font-size:0.85rem;color:var(--text-secondary)">📝 Sobre mí:</p>' +
            '<p style="font-size:0.88rem;color:var(--text-primary)">' + p.descripcion + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="citas-tarjeta-acciones">' +
          '<button class="btn-citas-no" id="btn-citas-no">✕</button>' +
          '<button class="btn-citas-si" id="btn-citas-si">♥</button>' +
        '</div>' +
      '</div>' +
      '<p style="color:var(--text-secondary);font-size:0.78rem;text-align:center;margin-top:0.5rem">' + (indice + 1) + ' de ' + perfiles.length + ' perfiles</p>';

    document.getElementById('btn-ver-mas-citas').addEventListener('click', function() {
      var completo = document.getElementById('citas-perfil-completo');
      completo.classList.toggle('hidden');
      this.textContent = completo.classList.contains('hidden') ? 'Ver perfil completo ▼' : 'Ocultar ▲';
    });

    document.getElementById('btn-citas-no').addEventListener('click', function() {
      indice++;
      mostrarTarjeta();
    });

    document.getElementById('btn-citas-si').addEventListener('click', async function() {
      var para = p.uid;
      await setDoc(doc(db, 'citas_likes', currentUser.uid + '_' + para), {
        de: currentUser.uid, para: para,
        deUsername: currentUser.username, paraUsername: p.username,
        fecha: new Date().toISOString()
      });

      var likeReverso = await getDoc(doc(db, 'citas_likes', para + '_' + currentUser.uid));
      if (likeReverso.exists()) {
        await setDoc(doc(db, 'citas_matches', currentUser.uid + '_' + para), {
          usuarios: [currentUser.uid, para],
          usernames: [currentUser.username, p.username],
          fecha: new Date().toISOString()
        });
        await setDoc(doc(db, 'citas_matches', para + '_' + currentUser.uid), {
          usuarios: [para, currentUser.uid],
          usernames: [p.username, currentUser.username],
          fecha: new Date().toISOString()
        });
        tarjetas.innerHTML =
          '<div class="citas-match-banner">' +
            '<p style="font-size:3rem">💞</p>' +
            '<h3>¡Es un match!</h3>' +
            '<p style="color:var(--text-secondary)">Tú y ' + p.username + ' se han gustado mutuamente</p>' +
            '<button class="btn btn-primary btn-full" id="btn-match-continuar" style="margin-top:1rem">Seguir explorando</button>' +
          '</div>';
        document.getElementById('btn-match-continuar').addEventListener('click', function() {
          indice++;
          mostrarTarjeta();
        });
        return;
      }

      indice++;
      mostrarTarjeta();
    });
  }

  mostrarTarjeta();
}

async function renderMisMatches() {
  var contenido = document.getElementById('citas-contenido');
  contenido.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<h3>💞 Mis Matches</h3>' +
    '</div>' +
    '<div id="matches-lista"><p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p></div>';

  var snap = await getDocs(query(collection(db, 'citas_matches'), where('usuarios', 'array-contains', currentUser.uid)));

  var lista = document.getElementById('matches-lista');
  if (snap.empty) {
    lista.innerHTML = '<div style="text-align:center;padding:3rem"><p style="font-size:2rem">💔</p><p style="color:var(--text-secondary)">Aún no tienes matches.</p></div>';
    return;
  }

  var matchesUids = [];
  snap.docs.forEach(function(d) {
    var data = d.data();
    var otroUid = data.usuarios.find(function(u) { return u !== currentUser.uid; });
    if (otroUid && !matchesUids.includes(otroUid)) matchesUids.push(otroUid);
  });

  var perfilesHTML = await Promise.all(matchesUids.map(async function(uid) {
    var perfilSnap = await getDoc(doc(db, 'citas_perfiles', uid));
    var usuarioSnap = await getDoc(doc(db, 'usuarios', uid));
    if (!perfilSnap.exists()) return '';
    var p = perfilSnap.data();
    var u = usuarioSnap.exists() ? usuarioSnap.data() : {};
    return '<div class="citas-match-card">' +
      (u.fotoPerfil ? '<img src="' + u.fotoPerfil + '" class="citas-match-foto" onerror="this.style.display=\'none\'" />' : '<div class="citas-match-foto-placeholder">👤</div>') +
      '<div class="citas-match-info">' +
        '<p class="citas-match-nombre">' + p.username + '</p>' +
        '<p class="citas-match-dato">' + (u.ciudad || 'Sin ciudad') + ' · Nv.' + (u.nivel || '?') + '</p>' +
        (u.whatsapp ? '<p class="citas-match-wa">📱 ' + u.whatsapp + '</p>' : '<p class="citas-match-wa" style="color:var(--text-secondary)">Sin WhatsApp registrado</p>') +
      '</div>' +
      '<span style="font-size:1.5rem">💞</span>' +
    '</div>';
  }));

  lista.innerHTML = perfilesHTML.join('');
}

function esMisionAdmin() {
  if (!currentUser) return false;
  var r = currentUser.rol ? currentUser.rol.toLowerCase() : '';
  return r === 'dev' || r === 'lider_suprema' || r === 'narrador' || r === 'alcalde';
}

function esMisionSuperAdmin() {
  if (!currentUser) return false;
  var r = currentUser.rol ? currentUser.rol.toLowerCase() : '';
  return r === 'dev' || r === 'lider_suprema';
}

function puedeVerMisionDeUsuario(misionCiudad) {
  if (esMisionSuperAdmin()) return true;
  var r = currentUser.rol ? currentUser.rol.toLowerCase() : '';
  if (r === 'narrador' || r === 'alcalde') {
    return misionCiudad === currentUser.ciudad;
  }
  return false;
}

function puedeEditarMision(mision) {
  if (esMisionSuperAdmin()) return true;
  var r = currentUser.rol ? currentUser.rol.toLowerCase() : '';
  if (r === 'alcalde') return mision.ciudad === currentUser.ciudad;
  if (r === 'narrador') return mision.autorUid === currentUser.uid;
  return false;
}

function renderMisiones() {
  var esAdmin = esMisionAdmin();
  mainContent.innerHTML =
    '<div class="card"><h3>⚔️ Misiones</h3></div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" id="btn-misiones-individuales"><span>🗡️</span><span>Individuales</span></button>' +
      '<button class="categoria-btn" id="btn-misiones-grupales"><span>⚔️</span><span>Grupales</span></button>' +
    '</div>' +
    '<button class="btn btn-secondary btn-full" id="btn-mision-ia" style="margin-bottom:0.5rem;border-color:var(--accent);color:var(--accent)">🤖 Misión con IA</button>' +
    '<button class="btn btn-secondary btn-full" id="btn-misiones-en-curso" style="margin-bottom:0.5rem">📋 Mis misiones en curso</button>' +
    (esAdmin ? '<button class="btn btn-secondary btn-full" id="btn-panel-misiones-admin" style="border-color:var(--accent);color:var(--accent)">🔍 Panel de misiones</button>' : '') +
    '<div id="misiones-panel"></div>';

  document.getElementById('btn-misiones-individuales').addEventListener('click', function() {
    renderListaMisiones('individual');
  });
  document.getElementById('btn-misiones-grupales').addEventListener('click', function() {
    renderListaMisiones('grupal');
  });
  document.getElementById('btn-misiones-en-curso').addEventListener('click', function() {
    renderMisionesEnCurso();
  });
  document.getElementById('btn-mision-ia').addEventListener('click', function() {
  renderFormMisionIA();
  });
  if (esAdmin) {
    document.getElementById('btn-panel-misiones-admin').addEventListener('click', function() {
      renderPanelAdminMisiones();
    });
  }
}

async function renderListaMisiones(tipo) {
  var panel = document.getElementById('misiones-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-misiones">← Misiones</button>' +
      '<h3>' + (tipo === 'individual' ? '🗡️ Misiones individuales' : '⚔️ Misiones grupales') + '</h3>' +
    '</div>' +
    (esMisionAdmin() ? '<button class="btn btn-primary btn-full" id="btn-crear-mision" style="margin-bottom:0.75rem">+ Crear misión</button>' : '') +
    '<div id="lista-misiones"><p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p></div>' +
    '<div id="mision-form"></div>';

  document.getElementById('back-misiones').addEventListener('click', function() {
    panel.innerHTML = '';
  });

  if (esMisionAdmin()) {
    document.getElementById('btn-crear-mision').addEventListener('click', function() {
      renderFormCrearMision(tipo, null);
    });
  }

  cargarListaMisiones(tipo);
}

function cargarListaMisiones(tipo) {
  var lista = document.getElementById('lista-misiones');
  onSnapshot(
    query(collection(db, 'misiones'), where('tipo', '==', tipo), where('activa', '==', true), orderBy('creadoEn', 'desc')),
    function(snap) {
      if (!lista) return;
      if (snap.empty) {
        lista.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">No hay misiones disponibles.</p>';
        return;
      }
      lista.innerHTML = snap.docs.map(function(d) {
        var m = d.data();
        return '<div class="mision-item" data-id="' + d.id + '">' +
          '<div class="mision-item-info">' +
            '<p class="mision-titulo">' + m.titulo + '</p>' +
            '<p class="mision-meta">💷 £' + (m.recompensaDinero || 0).toLocaleString('es-CO') + (m.recompensaObjeto ? ' + ' + m.recompensaObjeto : '') + '</p>' +
          '</div>' +
          '<span class="mision-arrow">›</span>' +
        '</div>';
      }).join('');

      lista.querySelectorAll('.mision-item').forEach(function(item) {
        item.addEventListener('click', function() {
          var id = item.dataset.id;
          var snap2 = snap.docs.find(function(d) { return d.id === id; });
          if (snap2) renderDetalleMision(snap2.id, snap2.data(), tipo);
        });
      });
    }
  );
}

function renderDetalleMision(misionId, mision, tipo) {
  var panel = document.getElementById('misiones-panel');
  var puedeEditar = puedeEditarMision(mision);

  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-lista-misiones">← Lista</button>' +
      '<h3>⚔️ ' + mision.titulo + '</h3>' +
    '</div>' +
    '<div class="card">' +
      '<p class="edit-section-title">📜 Descripción</p>' +
      '<p style="font-size:0.88rem;color:var(--text-primary);margin-bottom:0.75rem">' + mision.descripcion + '</p>' +
      '<div class="mision-dato-row"><span>💷 Recompensa dinero</span><span>£' + (mision.recompensaDinero || 0).toLocaleString('es-CO') + '</span></div>' +
      (mision.recompensaObjeto ? '<div class="mision-dato-row"><span>🎁 Recompensa objeto</span><span>' + mision.recompensaObjeto + '</span></div>' : '') +
      '<div class="mision-dato-row"><span>💬 Mín. mensajes</span><span>' + mision.minMensajes + '</span></div>' +
      '<div class="mision-dato-row"><span>📝 Mín. líneas/mensaje</span><span>' + mision.minLineas + '</span></div>' +
      (tipo === 'grupal' ? '<div class="mision-dato-row"><span>👥 Tipo</span><span>Grupal (2-5 jugadores)</span></div>' : '') +
      '<p style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.5rem">Creada por ' + mision.autorUsername + '</p>' +
    '</div>' +
    '<button class="btn btn-primary btn-full" id="btn-tomar-mision" style="margin-top:0.75rem">⚔️ Tomar misión</button>' +
    (puedeEditar ? '<div style="display:flex;gap:0.5rem;margin-top:0.5rem">' +
      '<button class="btn btn-secondary" id="btn-editar-mision" style="flex:1">✏️ Editar</button>' +
      '<button class="btn btn-secondary" id="btn-borrar-mision" style="flex:1;border-color:var(--danger);color:var(--danger)">🗑️ Borrar</button>' +
    '</div>' : '') +
    '<div id="tomar-mision-form"></div>';

  document.getElementById('back-lista-misiones').addEventListener('click', function() {
    renderListaMisiones(tipo);
  });

  document.getElementById('btn-tomar-mision').addEventListener('click', function() {
    if (tipo === 'grupal') {
      mostrarFormTomarGrupal(misionId, mision);
    } else {
      tomarMisionIndividual(misionId, mision);
    }
  });

  if (puedeEditar) {
    document.getElementById('btn-editar-mision').addEventListener('click', function() {
      renderFormCrearMision(tipo, Object.assign({ id: misionId }, mision));
    });
    document.getElementById('btn-borrar-mision').addEventListener('click', async function() {
      if (!confirm('¿Borrar esta misión?')) return;
      await updateDoc(doc(db, 'misiones', misionId), { activa: false });
      renderListaMisiones(tipo);
    });
  }
}

async function tomarMisionIndividual(misionId, mision) {
  var form = document.getElementById('tomar-mision-form');
  form.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:0.5rem">Procesando...</p>';

  var yaEnCurso = await getDocs(query(collection(db, 'misiones_en_curso'),
    where('uid', '==', currentUser.uid),
    where('misionId', '==', misionId)
  ));

  if (!yaEnCurso.empty) {
    form.innerHTML = '<p style="color:var(--danger);text-align:center;padding:0.5rem">Ya tienes esta misión en curso.</p>';
    return;
  }

  await addDoc(collection(db, 'misiones_en_curso'), {
    uid: currentUser.uid,
    username: currentUser.username,
    ciudad: currentUser.ciudad || '',
    misionId: misionId,
    titulo: mision.titulo,
    recompensaDinero: mision.recompensaDinero || 0,
    recompensaObjeto: mision.recompensaObjeto || '',
    tipo: 'individual',
    miembros: [{ uid: currentUser.uid, username: currentUser.username }],
    tomadaEn: new Date().toISOString(),
    estado: 'en_curso'
  });

  form.innerHTML = '<p style="color:var(--success);text-align:center;padding:0.5rem">✓ Misión tomada. Aparece en "Mis misiones en curso".</p>';
}

function mostrarFormTomarGrupal(misionId, mision) {
  var form = document.getElementById('tomar-mision-form');
  form.innerHTML =
    '<div class="card" style="margin-top:0.75rem">' +
      '<h3 style="margin-bottom:0.75rem">👥 Añadir compañeros</h3>' +
      '<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.75rem">Puedes añadir hasta 4 compañeros (5 en total contigo)</p>' +
      '<div style="position:relative">' +
        '<input type="text" id="grupal-buscar-usuario" placeholder="Buscar usuario..." autocomplete="off" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block" />' +
        '<div id="grupal-usuario-lista" class="usuarios-lista"></div>' +
      '</div>' +
      '<div id="grupal-seleccionados" style="margin-top:0.5rem"></div>' +
      '<button class="btn btn-primary btn-full" id="btn-confirmar-grupal" style="margin-top:0.75rem">⚔️ Tomar misión grupal</button>' +
      '<div id="grupal-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  var seleccionados = [];
  crearBuscadorUsuarios('grupal-buscar-usuario', 'grupal-usuario-lista', currentUser.username, false);

  document.getElementById('grupal-buscar-usuario').addEventListener('change', function() {
    var username = this.value.trim().toLowerCase();
    if (!username || seleccionados.find(function(s) { return s.username === username; })) return;
    if (seleccionados.length >= 4) {
      document.getElementById('grupal-msg').textContent = 'Máximo 4 compañeros';
      document.getElementById('grupal-msg').style.color = 'var(--danger)';
      return;
    }
    seleccionados.push({ username: username });
    actualizarSeleccionadosGrupal(seleccionados);
    this.value = '';
  });

  document.getElementById('btn-confirmar-grupal').addEventListener('click', async function() {
    var msg = document.getElementById('grupal-msg');
    if (seleccionados.length === 0) { msg.textContent = 'Añade al menos un compañero'; msg.style.color = 'var(--danger)'; return; }
    var btn = this; btn.disabled = true; btn.textContent = 'Procesando...';

    var miembros = [{ uid: currentUser.uid, username: currentUser.username }];
    for (var i = 0; i < seleccionados.length; i++) {
      var uSnap = await getDoc(doc(db, 'usernames', seleccionados[i].username));
      if (uSnap.exists()) miembros.push({ uid: uSnap.data().uid, username: seleccionados[i].username });
    }

    await addDoc(collection(db, 'misiones_en_curso'), {
      uid: currentUser.uid,
      username: currentUser.username,
      ciudad: currentUser.ciudad || '',
      misionId: misionId,
      titulo: mision.titulo,
      recompensaDinero: mision.recompensaDinero || 0,
      recompensaObjeto: mision.recompensaObjeto || '',
      tipo: 'grupal',
      miembros: miembros,
      tomadaEn: new Date().toISOString(),
      estado: 'en_curso'
    });

    msg.textContent = '✓ Misión grupal iniciada'; msg.style.color = 'var(--success)';
    btn.disabled = false; btn.textContent = '⚔️ Tomar misión grupal';
  });
}

function actualizarSeleccionadosGrupal(seleccionados) {
  var cont = document.getElementById('grupal-seleccionados');
  if (seleccionados.length === 0) { cont.innerHTML = ''; return; }
  cont.innerHTML = '<p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem">Compañeros:</p>' +
    seleccionados.map(function(u, i) {
      return '<span class="tag-usuario" data-i="' + i + '">' + u.username + ' ✕</span>';
    }).join('');
  cont.querySelectorAll('.tag-usuario').forEach(function(tag) {
    tag.addEventListener('click', function() {
      seleccionados.splice(parseInt(tag.dataset.i), 1);
      actualizarSeleccionadosGrupal(seleccionados);
    });
  });
}

function renderFormCrearMision(tipo, misionExistente) {
  var panel = document.getElementById('misiones-panel');
  var esEdicion = misionExistente !== null;
  var m = misionExistente || {};

  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-form-mision">← Atrás</button>' +
      '<h3>' + (esEdicion ? '✏️ Editar misión' : '+ Crear misión') + '</h3>' +
    '</div>' +
    '<div class="card">' +
      '<input type="text" id="mision-titulo" placeholder="Título de la misión" value="' + (m.titulo || '') + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;margin-bottom:0.5rem" />' +
      '<textarea id="mision-descripcion" placeholder="Descripción detallada de la misión..." style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;min-height:120px;resize:vertical;margin-bottom:0.5rem">' + (m.descripcion || '') + '</textarea>' +
      '<input type="number" id="mision-recompensa-dinero" placeholder="Recompensa en £ (0 si no hay)" min="0" value="' + (m.recompensaDinero || 0) + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;margin-bottom:0.5rem" />' +
      '<input type="text" id="mision-recompensa-objeto" placeholder="Recompensa objeto (opcional)" value="' + (m.recompensaObjeto || '') + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;margin-bottom:0.5rem" />' +
      '<input type="number" id="mision-min-mensajes" placeholder="Mínimo de mensajes requeridos" min="1" value="' + (m.minMensajes || '') + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;margin-bottom:0.5rem" />' +
      '<input type="number" id="mision-min-lineas" placeholder="Mínimo de líneas por mensaje" min="1" value="' + (m.minLineas || '') + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;margin-bottom:0.5rem" />' +
      '<button class="btn btn-primary btn-full" id="btn-guardar-mision">' + (esEdicion ? '💾 Guardar cambios' : '📤 Publicar misión') + '</button>' +
      '<div id="mision-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  document.getElementById('back-form-mision').addEventListener('click', function() {
    renderListaMisiones(tipo);
  });

  document.getElementById('btn-guardar-mision').addEventListener('click', async function() {
    var titulo = document.getElementById('mision-titulo').value.trim();
    var descripcion = document.getElementById('mision-descripcion').value.trim();
    var recompensaDinero = parseInt(document.getElementById('mision-recompensa-dinero').value) || 0;
    var recompensaObjeto = document.getElementById('mision-recompensa-objeto').value.trim();
    var minMensajes = parseInt(document.getElementById('mision-min-mensajes').value);
    var minLineas = parseInt(document.getElementById('mision-min-lineas').value);
    var msg = document.getElementById('mision-msg');

    if (!titulo) { msg.textContent = 'El título es obligatorio'; msg.style.color = 'var(--danger)'; return; }
    if (!descripcion) { msg.textContent = 'La descripción es obligatoria'; msg.style.color = 'var(--danger)'; return; }
    if (!minMensajes || minMensajes < 1) { msg.textContent = 'Ingresa el mínimo de mensajes'; msg.style.color = 'var(--danger)'; return; }
    if (!minLineas || minLineas < 1) { msg.textContent = 'Ingresa el mínimo de líneas'; msg.style.color = 'var(--danger)'; return; }

    var btn = document.getElementById('btn-guardar-mision');
    btn.disabled = true; btn.textContent = 'Guardando...';

    var datos = {
      titulo: titulo,
      descripcion: descripcion,
      recompensaDinero: recompensaDinero,
      recompensaObjeto: recompensaObjeto,
      minMensajes: minMensajes,
      minLineas: minLineas,
      tipo: tipo,
      activa: true,
      autorUid: currentUser.uid,
      autorUsername: currentUser.username,
      ciudad: currentUser.ciudad || ''
    };

    try {
      if (esEdicion) {
        await updateDoc(doc(db, 'misiones', misionExistente.id), datos);
      } else {
        datos.creadoEn = new Date().toISOString();
        await addDoc(collection(db, 'misiones'), datos);
      }
      msg.textContent = '✓ ' + (esEdicion ? 'Misión actualizada' : 'Misión publicada');
      msg.style.color = 'var(--success)';
      setTimeout(function() { renderListaMisiones(tipo); }, 1000);
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
      msg.style.color = 'var(--danger)';
      btn.disabled = false;
      btn.textContent = esEdicion ? '💾 Guardar cambios' : '📤 Publicar misión';
    }
  });
}

function renderFormMisionIA() {
  var panel = document.getElementById('misiones-panel');
  var iStyle = 'width:100%;padding:0.75rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.88rem;outline:none;font-family:inherit;display:block;box-sizing:border-box;margin-bottom:0.5rem';
  var sStyle = 'width:100%;padding:0.75rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.88rem;outline:none;font-family:inherit;display:block;box-sizing:border-box;margin-bottom:0.5rem';

  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-mision-ia">← Misiones</button>' +
      '<h3>🤖 Misión personalizada con IA</h3>' +
    '</div>' +
    '<div class="card" style="display:flex;flex-direction:column;gap:0.1rem">' +

      '<input type="number" id="ia-nivel" placeholder="Nivel del personaje (ej: 1, 50, 500...)" min="1" style="' + iStyle + '" />' +
      '<input type="number" id="ia-nivel-mision" placeholder="Nivel de la misión deseada (puede ser menor al tuyo)" min="1" style="' + iStyle + '" />' +
      '<input type="text" id="ia-raza" placeholder="Raza o especie (ej: humano, demonio, dios...)" style="' + iStyle + '" />' +
      '<textarea id="ia-habilidades" placeholder="Habilidades especiales (una por línea o separadas por coma)" style="' + iStyle + 'min-height:70px;resize:vertical"></textarea>' +

      '<p class="edit-section-title" style="margin:0.3rem 0 0.2rem">💪 Fuerza máxima</p>' +
      '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">' +
        '<input type="text" id="ia-fuerza-val" placeholder="Valor (ej: 5.2 o 3e8)" style="' + iStyle + 'flex:2;margin:0" />' +
        '<select id="ia-fuerza-unit" style="' + sStyle + 'flex:1;margin:0">' +
          '<option value="kg">kg</option>' +
          '<option value="toneladas">ton</option>' +
          '<option value="masas planetarias">M. Planet.</option>' +
          '<option value="masas solares">M. Solar</option>' +
        '</select>' +
      '</div>' +

      '<p class="edit-section-title" style="margin:0.3rem 0 0.2rem">🛡️ Resistencia máxima</p>' +
      '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">' +
        '<input type="text" id="ia-resist-val" placeholder="Valor" style="' + iStyle + 'flex:2;margin:0" />' +
        '<select id="ia-resist-unit" style="' + sStyle + 'flex:1;margin:0">' +
          '<option value="kg">kg</option>' +
          '<option value="toneladas">ton</option>' +
          '<option value="masas planetarias">M. Planet.</option>' +
          '<option value="masas solares">M. Solar</option>' +
        '</select>' +
      '</div>' +

      '<p class="edit-section-title" style="margin:0.3rem 0 0.2rem">⚡ Velocidad máxima</p>' +
      '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">' +
        '<input type="text" id="ia-vel-val" placeholder="Valor" style="' + iStyle + 'flex:2;margin:0" />' +
        '<select id="ia-vel-unit" style="' + sStyle + 'flex:1;margin:0">' +
          '<option value="m/s">m/s</option>' +
          '<option value="km/h">km/h</option>' +
          '<option value="km/s">km/s</option>' +
          '<option value="c (velocidad de la luz)">× c (luz)</option>' +
        '</select>' +
      '</div>' +

      '<p class="edit-section-title" style="margin:0.3rem 0 0.2rem">⚙️ Parámetros de misión</p>' +
      '<select id="ia-tipo-mision" style="' + sStyle + '">' +
        '<option value="combate">⚔️ Combate</option>' +
        '<option value="exploracion">🗺️ Exploración</option>' +
        '<option value="infiltracion">🕵️ Infiltración</option>' +
        '<option value="rescate">🏥 Rescate</option>' +
        '<option value="caceria">🎯 Cacería</option>' +
        '<option value="defensa">🏰 Defensa</option>' +
        '<option value="libre">✨ Libre (la IA decide)</option>' +
      '</select>' +
      '<select id="ia-dificultad" style="' + sStyle + '">' +
        '<option value="Fácil">😌 Fácil</option>' +
        '<option value="Normal" selected>⚔️ Normal</option>' +
        '<option value="Difícil">🔥 Difícil</option>' +
        '<option value="Extrema">💀 Extrema</option>' +
        '<option value="Imposible">☠️ Imposible</option>' +
      '</select>' +
      '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">' +
        '<label style="font-size:0.85rem;color:var(--text-secondary);white-space:nowrap;min-width:90px">👥 Participantes:</label>' +
        '<input type="number" id="ia-participantes" value="1" min="1" max="5" style="' + iStyle + 'margin:0;width:80px" />' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">' +
        '<label style="font-size:0.85rem;color:var(--text-secondary);white-space:nowrap;min-width:90px">📝 Posts (10-50):</label>' +
        '<input type="number" id="ia-posts" value="15" min="10" max="50" style="' + iStyle + 'margin:0;width:80px" />' +
      '</div>' +
      '<textarea id="ia-contexto" placeholder="Contexto especial (opcional): lugar, restricciones, condiciones únicas, peticiones especiales..." style="' + iStyle + 'min-height:80px;resize:vertical"></textarea>' +

      '<button class="btn btn-primary btn-full" id="btn-generar-mision-ia">🤖 Generar misión con IA</button>' +
      '<div id="ia-msg" style="font-size:0.85rem;text-align:center;margin-top:0.3rem"></div>' +
    '</div>' +
    '<div id="ia-resultado"></div>';

  document.getElementById('back-mision-ia').addEventListener('click', function() {
    panel.innerHTML = '';
  });

  document.getElementById('btn-generar-mision-ia').addEventListener('click', async function() {
    await generarMisionConIA();
  });
}

async function generarMisionConIA() {
  var msg = document.getElementById('ia-msg');
  var btn = document.getElementById('btn-generar-mision-ia');
  var resultado = document.getElementById('ia-resultado');

  var nivel = document.getElementById('ia-nivel').value.trim();
  var nivelMision = document.getElementById('ia-nivel-mision').value.trim();
  var raza = document.getElementById('ia-raza').value.trim();
  var habilidades = document.getElementById('ia-habilidades').value.trim();
  var fuerzaVal = document.getElementById('ia-fuerza-val').value.trim();
  var fuerzaUnit = document.getElementById('ia-fuerza-unit').value;
  var resistVal = document.getElementById('ia-resist-val').value.trim();
  var resistUnit = document.getElementById('ia-resist-unit').value;
  var velVal = document.getElementById('ia-vel-val').value.trim();
  var velUnit = document.getElementById('ia-vel-unit').value;
  var tipoMision = document.getElementById('ia-tipo-mision').value;
  var dificultad = document.getElementById('ia-dificultad').value;
  var participantes = Math.max(1, Math.min(5, parseInt(document.getElementById('ia-participantes').value) || 1));
  var posts = Math.max(10, Math.min(50, parseInt(document.getElementById('ia-posts').value) || 15));
  var contexto = document.getElementById('ia-contexto').value.trim();

  if (!nivel || !raza || !nivelMision) {
    msg.textContent = 'El nivel, nivel de misión y la raza son obligatorios';
    msg.style.color = 'var(--danger)';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Generando misión...';
  msg.textContent = 'La IA está creando tu misión épica...';
  msg.style.color = 'var(--text-secondary)';
  resultado.innerHTML = '';

  var postEventoMin = Math.floor(posts * 0.6);
  var postEventoMax = Math.floor(posts * 0.8);

  var prompt = 'Genera una misión personalizada para este personaje:\n\n' +
    'PERSONAJE:\n' +
    '- Nivel del personaje: ' + nivel + '\n' +
    '- Nivel de la misión deseada: ' + nivelMision + '\n' +
    '- Ratio de nivel: ' + (Math.min(1, parseInt(nivelMision) / parseInt(nivel))).toFixed(3) + '\n' +
    '- Raza: ' + (raza || 'no especificada') + '\n' +
    '- Habilidades especiales: ' + (habilidades || 'ninguna especificada') + '\n' +
    '- Fuerza máxima: ' + (fuerzaVal || '?') + ' ' + fuerzaUnit + '\n' +
    '- Resistencia máxima: ' + (resistVal || '?') + ' ' + resistUnit + '\n' +
    '- Velocidad máxima: ' + (velVal || '?') + ' ' + velUnit + '\n\n' +
    'PARÁMETROS:\n' +
    '- Tipo de misión deseada: ' + tipoMision + '\n' +
    '- Dificultad buscada: ' + dificultad + '\n' +
    '- Participantes: ' + participantes + ' jugador' + (participantes > 1 ? 'es' : '') + '\n' +
    '- Cantidad de posts: ' + posts + ' (mínimo 10 líneas por post)\n' +
    '- El post del evento especial debe estar entre el post ' + postEventoMin + ' y el post ' + postEventoMax + '\n' +
    (contexto ? '- Contexto especial del jugador: ' + contexto + '\n' : '') +
    '\nResponde ÚNICAMENTE con el JSON indicado. Sin texto adicional, sin markdown, sin backticks.';

  try {
    var respuesta = await llamarGroq([
      { role: 'system', content: SISTEMA_MISIONES },
      { role: 'user', content: prompt }
    ], 1500);

    var jsonLimpio = respuesta.replace(/```json|```/g, '').trim();
    var mision = JSON.parse(jsonLimpio);
    renderResultadoMisionIA(mision, participantes, posts);
    msg.textContent = '';
  } catch (err) {
    msg.textContent = 'Error generando la misión: ' + err.message;
    msg.style.color = 'var(--danger)';
  }

  btn.disabled = false;
  btn.textContent = '🤖 Generar misión con IA';
}

function renderResultadoMisionIA(mision, participantes, totalPosts) {
  var resultado = document.getElementById('ia-resultado');

  resultado.innerHTML =
    '<div class="card" style="margin-top:1rem;border-color:var(--accent)">' +
      '<p class="edit-section-title">⚔️ ' + mision.titulo + '</p>' +
      '<p style="font-size:0.85rem;color:var(--text-primary);margin-bottom:0.75rem">' + mision.descripcion + '</p>' +
      '<div class="mision-dato-row"><span>🎯 Objetivo</span><span style="font-size:0.8rem;text-align:right;max-width:60%">' + mision.objetivo + '</span></div>' +
      '<div class="mision-dato-row"><span>⚠️ Dificultad real</span><span>' + mision.dificultadReal + '</span></div>' +
      '<div class="mision-dato-row"><span>💷 Recompensa</span><span>£' + (mision.recompensaDinero || 0).toLocaleString('es-CO') + (mision.recompensaObjeto ? ' + ' + mision.recompensaObjeto : '') + '</span></div>' +
      '<div class="mision-dato-row"><span>📝 Posts / Líneas mín.</span><span>' + mision.minMensajes + ' posts · ' + mision.minLineas + ' líneas</span></div>' +
      '<div class="mision-dato-row" style="border:none"><span>🎲 Evento especial en</span><span>Post ' + mision.postEventoEspecial + '</span></div>' +
      '<p style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.4rem;font-style:italic">' + mision.descripcionEventoBase + '</p>' +
    '</div>' +

    '<div class="card" style="margin-top:0.5rem">' +
      '<p class="edit-section-title">🎲 Tabla de eventos D20</p>' +
      '<div class="dice-tabla">' +
        '<div class="dice-fila critico-fallo"><span class="dice-rango">1–2</span><span>' + mision.tablaDice.critico_fallo + '</span></div>' +
        '<div class="dice-fila fallo"><span class="dice-rango">3–7</span><span>' + mision.tablaDice.fallo + '</span></div>' +
        '<div class="dice-fila neutro"><span class="dice-rango">8–12</span><span>' + mision.tablaDice.neutro + '</span></div>' +
        '<div class="dice-fila exito"><span class="dice-rango">13–18</span><span>' + mision.tablaDice.exito + '</span></div>' +
        '<div class="dice-fila critico-exito"><span class="dice-rango">19–20</span><span>' + mision.tablaDice.critico_exito + '</span></div>' +
      '</div>' +
    '</div>' +

    '<div class="card" style="margin-top:0.5rem">' +
      '<p class="edit-section-title">🎲 Activar evento especial</p>' +
      '<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.75rem">Cuando llegues al post ' + mision.postEventoEspecial + ', tira el dado y envíaselo al narrador IA.</p>' +
      '<button class="btn btn-primary btn-full" id="btn-tirar-dado">🎲 Tirar D20</button>' +
      '<div id="dado-resultado" style="margin-top:0.5rem"></div>' +
    '</div>' +

    '<div class="card" style="margin-top:0.5rem">' +
      '<p class="edit-section-title">💬 Narrador IA</p>' +
      '<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.5rem">Cuéntale al narrador qué ocurre en tu misión, envíale el resultado del dado, o pregúntale lo que necesites.</p>' +
      '<div id="chat-ia-mensajes" style="max-height:300px;overflow-y:auto;margin-bottom:0.75rem;display:flex;flex-direction:column;gap:0.5rem"></div>' +
      '<div style="display:flex;gap:0.5rem">' +
        '<textarea id="chat-ia-input" placeholder="Describe lo que haces, el resultado del dado, o pregunta al narrador..." style="flex:1;padding:0.7rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem;outline:none;font-family:inherit;resize:none;min-height:60px;box-sizing:border-box"></textarea>' +
        '<button class="btn btn-primary" id="btn-enviar-chat-ia" style="padding:0.7rem 1rem;align-self:flex-end">Enviar</button>' +
      '</div>' +
      '<div id="chat-ia-msg" style="font-size:0.82rem;margin-top:0.3rem"></div>' +
    '</div>' +

    '<button class="btn btn-primary btn-full" id="btn-tomar-mision-ia" style="margin-top:0.75rem">⚔️ Tomar esta misión</button>';

  var historialChat = [
    { role: 'system', content: SISTEMA_MISIONES + '\n\nMISIÓN ACTIVA:\n' + JSON.stringify(mision) }
  ];

  document.getElementById('btn-tirar-dado').addEventListener('click', function() {
    var dado = Math.floor(Math.random() * 20) + 1;
    var categoria, color;
    if (dado <= 2)       { categoria = 'FALLO CRÍTICO'; color = '#ff3333'; }
    else if (dado <= 7)  { categoria = 'FALLO'; color = 'var(--danger)'; }
    else if (dado <= 12) { categoria = 'NEUTRO'; color = 'var(--text-secondary)'; }
    else if (dado <= 18) { categoria = 'ÉXITO'; color = 'var(--success)'; }
    else                 { categoria = 'ÉXITO CRÍTICO ✨'; color = 'var(--accent)'; }

    document.getElementById('dado-resultado').innerHTML =
      '<div style="text-align:center;padding:0.75rem;background:var(--bg-secondary);border-radius:10px;border:2px solid ' + color + '">' +
        '<p style="font-size:2.5rem;margin:0;line-height:1">' + dado + '</p>' +
        '<p style="color:' + color + ';font-weight:700;margin:0.3rem 0;font-size:0.95rem">' + categoria + '</p>' +
        '<p style="font-size:0.78rem;color:var(--text-secondary)">Envíalo al narrador ↓</p>' +
      '</div>';

    document.getElementById('chat-ia-input').value = 'Tiré el D20 y obtuve un ' + dado + ' (' + categoria + '). ¿Qué ocurre en el evento especial?';
    document.getElementById('chat-ia-input').focus();
  });

  document.getElementById('btn-enviar-chat-ia').addEventListener('click', async function() {
    var input = document.getElementById('chat-ia-input');
    var chatMsg = document.getElementById('chat-ia-msg');
    var texto = input.value.trim();
    if (!texto) return;

    var btn = this;
    btn.disabled = true;
    chatMsg.textContent = 'El narrador está respondiendo...';
    chatMsg.style.color = 'var(--text-secondary)';

    agregarMensajeChat('user', texto);
    historialChat.push({ role: 'user', content: texto });
    input.value = '';

    try {
      var respuesta = await llamarGroq(historialChat, 800);
      historialChat.push({ role: 'assistant', content: respuesta });
      agregarMensajeChat('assistant', respuesta);
      chatMsg.textContent = '';
    } catch (err) {
      chatMsg.textContent = 'Error: ' + err.message;
      chatMsg.style.color = 'var(--danger)';
    }
    btn.disabled = false;
  });

  document.getElementById('btn-tomar-mision-ia').addEventListener('click', async function() {
    var tipo = participantes > 1 ? 'grupal' : 'individual';
    var misionAdaptada = Object.assign({}, mision, {
      tipo: tipo,
      autorUsername: 'IA Narradora',
      ciudad: currentUser.ciudad || '',
      autorUid: currentUser.uid
    });
    var misionId = 'ia_' + Date.now();

    if (tipo === 'grupal') {
      mostrarFormTomarGrupal(misionId, misionAdaptada);
    } else {
      await tomarMisionIndividual(misionId, misionAdaptada);
    }
  });
}

function agregarMensajeChat(rol, texto) {
  var cont = document.getElementById('chat-ia-mensajes');
  if (!cont) return;
  var div = document.createElement('div');
  div.style.cssText = 'padding:0.6rem 0.8rem;border-radius:10px;font-size:0.83rem;line-height:1.5;' +
    (rol === 'user'
      ? 'background:var(--accent);color:white;align-self:flex-end;margin-left:20%'
      : 'background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--bg-card);margin-right:20%');
  div.textContent = texto;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
}

function renderMisionesEnCurso() {
  var panel = document.getElementById('misiones-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-en-curso">← Misiones</button>' +
      '<h3>📋 Mis misiones en curso</h3>' +
    '</div>' +
    '<div id="en-curso-lista"><p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p></div>';

  document.getElementById('back-en-curso').addEventListener('click', function() { panel.innerHTML = ''; });

  onSnapshot(
    query(collection(db, 'misiones_en_curso'), where('uid', '==', currentUser.uid), where('estado', '==', 'en_curso')),
    function(snap) {
      var lista = document.getElementById('en-curso-lista');
      if (!lista) return;
      if (snap.empty) {
        lista.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">No tienes misiones en curso.</p>';
        return;
      }
      lista.innerHTML = snap.docs.map(function(d) {
        var m = d.data();
        var miembrosStr = m.miembros && m.miembros.length > 1
          ? m.miembros.map(function(mb) { return mb.username; }).join(', ')
          : 'Individual';
        return '<div class="mision-en-curso-card">' +
          '<div class="mision-en-curso-info">' +
            '<p class="mision-titulo">' + m.titulo + '</p>' +
            '<p class="mision-meta">💷 £' + (m.recompensaDinero || 0).toLocaleString('es-CO') + (m.recompensaObjeto ? ' + ' + m.recompensaObjeto : '') + '</p>' +
            '<p class="mision-meta">👥 ' + miembrosStr + '</p>' +
            '<p class="mision-meta" style="font-size:0.72rem">' + new Date(m.tomadaEn).toLocaleDateString('es-CO') + '</p>' +
          '</div>' +
          '<div class="mision-en-curso-acciones">' +
            '<button class="btn-mision-terminar" data-id="' + d.id + '">✅ Terminar</button>' +
            '<button class="btn-mision-cancelar" data-id="' + d.id + '">❌ Cancelar</button>' +
          '</div>' +
        '</div>';
      }).join('');

      lista.querySelectorAll('.btn-mision-terminar').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    if (!confirm('¿Reportar esta misión como completada?')) return;
    var snap2 = await getDoc(doc(db, 'misiones_en_curso', btn.dataset.id));
    var mData = snap2.data();
    await addDoc(collection(db, 'misiones_terminadas'), Object.assign({}, mData, {
      misionEnCursoId: btn.dataset.id,
      terminadaEn: new Date().toISOString(),
      estado: 'pendiente_revision'
    }));
    await updateDoc(doc(db, 'misiones_en_curso', btn.dataset.id), { estado: 'reportada' });
  });
});

      lista.querySelectorAll('.btn-mision-cancelar').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          if (!confirm('¿Cancelar esta misión?')) return;
          await updateDoc(doc(db, 'misiones_en_curso', btn.dataset.id), { estado: 'cancelada' });
        });
      });
    }
  );
}

function renderPanelAdminMisiones() {
  var panel = document.getElementById('misiones-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-admin-misiones">← Misiones</button>' +
      '<h3>🔍 Panel de misiones</h3>' +
    '</div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" id="btn-admin-en-progreso"><span>⏳</span><span>En progreso</span></button>' +
      '<button class="categoria-btn" id="btn-admin-completadas"><span>✅</span><span>Completadas</span></button>' +
    '</div>' +
    '<div id="admin-misiones-contenido"></div>';

  document.getElementById('back-admin-misiones').addEventListener('click', function() { panel.innerHTML = ''; });
  document.getElementById('btn-admin-en-progreso').addEventListener('click', function() { renderAdminEnProgreso(); });
  document.getElementById('btn-admin-completadas').addEventListener('click', function() { renderAdminCompletadas(); });
}

function renderAdminEnProgreso() {
  var contenido = document.getElementById('admin-misiones-contenido');
  contenido.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p>';

  onSnapshot(
    query(collection(db, 'misiones_en_curso'), where('estado', '==', 'en_curso')),
    function(snap) {
      if (!contenido) return;
      var docs = snap.docs.filter(function(d) {
        return puedeVerMisionDeUsuario(d.data().ciudad);
      });
      if (docs.length === 0) {
        contenido.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">No hay misiones en progreso.</p>';
        return;
      }
      contenido.innerHTML = '<h3 style="margin:0.75rem 0 0.5rem">⏳ En progreso</h3>' +
        docs.map(function(d) {
          var m = d.data();
          var miembros = m.miembros ? m.miembros.map(function(mb) { return mb.username; }).join(', ') : m.username;
          return '<div class="mision-admin-card">' +
            '<p class="mision-titulo">' + m.titulo + '</p>' +
            '<p class="mision-meta">👤 ' + miembros + ' · 🏙️ ' + (m.ciudad || 'Sin ciudad') + '</p>' +
            '<p class="mision-meta">' + new Date(m.tomadaEn).toLocaleDateString('es-CO') + '</p>' +
          '</div>';
        }).join('');
    }
  );
}

function renderAdminCompletadas() {
  var contenido = document.getElementById('admin-misiones-contenido');
  contenido.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p>';

  onSnapshot(
    query(collection(db, 'misiones_terminadas'), where('estado', '==', 'pendiente_revision')),
    function(snap) {
      if (!contenido) return;
      var docs = snap.docs.filter(function(d) {
        return puedeVerMisionDeUsuario(d.data().ciudad);
      });
      if (docs.length === 0) {
        contenido.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">No hay misiones pendientes de revisión.</p>';
        return;
      }
      contenido.innerHTML = '<h3 style="margin:0.75rem 0 0.5rem">✅ Pendientes de revisión</h3>' +
        docs.map(function(d) {
          var m = d.data();
          var miembros = m.miembros ? m.miembros.map(function(mb) { return mb.username; }).join(', ') : m.username;
          return '<div class="mision-admin-card">' +
            '<p class="mision-titulo">' + m.titulo + '</p>' +
            '<p class="mision-meta">👤 ' + miembros + '</p>' +
            '<p class="mision-meta">💷 £' + (m.recompensaDinero || 0).toLocaleString('es-CO') + (m.recompensaObjeto ? ' + 🎁 ' + m.recompensaObjeto : '') + '</p>' +
            '<p class="mision-meta">🏙️ ' + (m.ciudad || 'Sin ciudad') + ' · ' + new Date(m.terminadaEn).toLocaleDateString('es-CO') + '</p>' +
            '<div style="display:flex;gap:0.5rem;margin-top:0.5rem">' +
              '<button class="btn btn-primary btn-confirmar-mision" data-id="' + d.id + '" style="flex:1;font-size:0.82rem;padding:0.5rem">✅ Confirmar</button>' +
              '<button class="btn btn-secondary btn-rechazar-mision" data-id="' + d.id + '" style="flex:1;font-size:0.82rem;padding:0.5rem;border-color:var(--danger);color:var(--danger)">❌ Rechazar</button>' +
            '</div>' +
            (m.recompensaObjeto ? '<p style="font-size:0.75rem;color:var(--warning);margin-top:0.4rem">⚠️ Recuerda dar manualmente: ' + m.recompensaObjeto + '</p>' : '') +
          '</div>';
        }).join('');

      contenido.querySelectorAll('.btn-confirmar-mision').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          if (!confirm('¿Confirmar misión como completada?')) return;
          btn.disabled = true; btn.textContent = 'Procesando...';
          var snap2 = await getDoc(doc(db, 'misiones_terminadas', btn.dataset.id));
          var mData = snap2.data();

          if (mData.recompensaDinero && mData.recompensaDinero > 0) {
            for (var i = 0; i < mData.miembros.length; i++) {
              var miembro = mData.miembros[i];
              await updateDoc(doc(db, 'usuarios', miembro.uid), { saldo: increment(mData.recompensaDinero) });
              await registrarTransaccion({
                tipo: 'recompensa_mision',
                de: 'sistema',
                deUsername: 'Sistema Misiones',
                para: miembro.uid,
                paraUsername: miembro.username,
                monto: mData.recompensaDinero,
                descripcion: 'Recompensa por completar misión: ' + mData.titulo
              });
            }
          }

          await updateDoc(doc(db, 'misiones_terminadas', btn.dataset.id), { estado: 'confirmada' });
          await updateDoc(doc(db, 'misiones_en_curso', mData.misionEnCursoId || btn.dataset.id), { estado: 'completada' });
        });
      });

      contenido.querySelectorAll('.btn-rechazar-mision').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          if (!confirm('¿Rechazar esta misión? Volverá a estar en curso para el jugador.')) return;
          var snap2 = await getDoc(doc(db, 'misiones_terminadas', btn.dataset.id));
          var mData = snap2.data();
          await updateDoc(doc(db, 'misiones_terminadas', btn.dataset.id), { estado: 'rechazada' });
          await updateDoc(doc(db, 'misiones_en_curso', mData.misionEnCursoId || btn.dataset.id), { estado: 'en_curso' });
        });
      });
    }
  );
}

function renderPatrimonio() {
  var esAdmin = currentUser && (
    currentUser.rol === 'dev' || currentUser.rol === 'DEV' ||
    currentUser.rol === 'lider_suprema' || currentUser.rol === 'LIDER_SUPREMA' ||
    currentUser.rol === 'ministra' || currentUser.rol === 'MINISTRA' ||
    currentUser.rol === 'viceministra' || currentUser.rol === 'VICEMINISTRA'
  );
  var esRegidor = currentUser && (currentUser.rol === 'regidor' || currentUser.rol === 'REGIDOR');

  var categorias = [
    { key: 'armas', emoji: '⚔️', label: 'Armas' },
    { key: 'vehiculos', emoji: '🚗', label: 'Vehículos' },
    { key: 'casas', emoji: '🏠', label: 'Casas' },
    { key: 'terrenos', emoji: '🏔️', label: 'Terrenos' },
    { key: 'construcciones', emoji: '🏗️', label: 'Construcciones' },
    { key: 'comida', emoji: '🍽️', label: 'Comida' },
    { key: 'materiales_armas', emoji: '🔩', label: 'Materiales para armas' },
    { key: 'materiales_construccion', emoji: '🧱', label: 'Materiales de construcción' },
    { key: 'metales_preciosos', emoji: '💎', label: 'Metales preciosos/joyas' },
    { key: 'artilugios', emoji: '🔮', label: 'Artilugios' },
    { key: 'animales', emoji: '🐾', label: 'Animales' },
    { key: 'esclavos', emoji: '⛓️', label: 'Esclavos' },
    { key: 'otros', emoji: '📦', label: 'Otros' }
  ];

  mainContent.innerHTML =
    '<div class="card"><h3>💎 Patrimonio de ' + currentUser.username + '</h3></div>' +
    '<div class="categorias-grid">' +
      categorias.map(function(c) {
        return '<button class="categoria-btn" data-key="' + c.key + '"><span>' + c.emoji + '</span><span>' + c.label + '</span></button>';
      }).join('') +
    '</div>' +
    '<button class="btn btn-secondary btn-full" id="btn-historial-patrimonio" style="margin-top:0.5rem">📋 Historial del inventario</button>' +
    ((esAdmin || esRegidor) ? '<button class="btn btn-secondary btn-full" id="btn-panel-admin-patrimonio" style="margin-top:0.5rem;border-color:var(--accent);color:var(--accent)">🔍 ' + (esAdmin ? 'Panel Admin' : 'Ver patrimonio de usuario') + '</button>' : '') +
    '<div id="patrimonio-panel"></div>';

  mainContent.querySelectorAll('.categoria-btn[data-key]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      renderCategoriaPatrimonio(btn.dataset.key, categorias.find(function(c) { return c.key === btn.dataset.key; }), currentUser.uid, currentUser.username, esAdmin, false);
    });
  });

  document.getElementById('btn-historial-patrimonio').addEventListener('click', function() {
    renderHistorialPatrimonio(currentUser.uid, currentUser.username, esAdmin);
  });

  if (esAdmin || esRegidor) {
    document.getElementById('btn-panel-admin-patrimonio').addEventListener('click', function() {
      renderPanelAdminPatrimonio(esAdmin, esRegidor);
    });
  }
}

function renderCategoriaPatrimonio(categoriaKey, categoriaObj, uid, username, esAdmin, esModoAdmin) {
  var panel = document.getElementById('patrimonio-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-patrimonio-cat">← Patrimonio</button>' +
      '<h3>' + categoriaObj.emoji + ' ' + categoriaObj.label + (esModoAdmin ? ' — ' + username : '') + '</h3>' +
    '</div>' +
    '<div id="items-patrimonio"><p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">Cargando...</p></div>' +
    (!esModoAdmin || esAdmin
      ? '<button class="btn btn-primary btn-full" id="btn-agregar-item-patrimonio" style="margin-top:0.75rem">+ Añadir objeto</button>'
      : '') +
    '<div id="patrimonio-form"></div>';

  document.getElementById('back-patrimonio-cat').addEventListener('click', function() {
    panel.innerHTML = '';
    if (esModoAdmin) renderPanelAdminPatrimonio(esAdmin, false);
  });

  cargarItemsPatrimonio(uid, username, categoriaKey, categoriaObj, esAdmin, esModoAdmin);

  var btnAgregar = document.getElementById('btn-agregar-item-patrimonio');
  if (btnAgregar) {
    btnAgregar.addEventListener('click', function() {
      mostrarFormAgregarItem(uid, username, categoriaKey, categoriaObj, esAdmin, esModoAdmin, null);
    });
  }
}

function cargarItemsPatrimonio(uid, username, categoriaKey, categoriaObj, esAdmin, esModoAdmin) {
  var lista = document.getElementById('items-patrimonio');
  onSnapshot(
    query(collection(db, 'patrimonio'), where('uid', '==', uid), where('categoria', '==', categoriaKey), where('activo', '==', true), orderBy('creadoEn', 'desc')),
    function(snap) {
      if (!lista) return;
      if (snap.empty) {
        lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">No hay objetos en esta categoría.</p>';
        return;
      }
      lista.innerHTML = snap.docs.map(function(d) {
        var item = d.data();
        return '<div class="patrimonio-item">' +
          (item.imagen ? '<img src="' + item.imagen + '" class="patrimonio-img" onerror="this.style.display=\'none\'" />' : '') +
          '<div class="patrimonio-info">' +
            '<p class="patrimonio-nombre">' + item.nombre + (item.cantidad > 1 ? ' ×' + item.cantidad : '') + '</p>' +
            (item.descripcion ? '<p class="patrimonio-desc">' + item.descripcion + '</p>' : '') +
            '<p class="patrimonio-meta">Compra: £' + (item.precioCompra || 0).toLocaleString('es-CO') + ' · Mercado: £' + (item.precioMercado || 0).toLocaleString('es-CO') + '</p>' +
            '<p class="patrimonio-meta" style="font-size:0.72rem">' + new Date(item.creadoEn).toLocaleString('es-CO') + '</p>' +
          '</div>' +
          '<div class="patrimonio-acciones">' +
            '<button class="btn-pat-editar" data-id="' + d.id + '">✏️</button>' +
            '<button class="btn-pat-borrar" data-id="' + d.id + '">🗑️</button>' +
          '</div>' +
        '</div>';
      }).join('');

      lista.querySelectorAll('.btn-pat-editar').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var snap2 = await getDoc(doc(db, 'patrimonio', btn.dataset.id));
          if (snap2.exists()) mostrarFormAgregarItem(uid, username, categoriaKey, categoriaObj, esAdmin, esModoAdmin, { id: btn.dataset.id, ...snap2.data() });
        });
      });

      lista.querySelectorAll('.btn-pat-borrar').forEach(function(btn) {
        btn.addEventListener('click', function() {
          mostrarFormBorrarItem(btn.dataset.id, uid, username, categoriaKey, categoriaObj, esAdmin, esModoAdmin);
        });
      });
    }
  );
}

function mostrarFormAgregarItem(uid, username, categoriaKey, categoriaObj, esAdmin, esModoAdmin, itemExistente) {
  var form = document.getElementById('patrimonio-form');
  var esEdicion = itemExistente !== null;
  form.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.75rem">' + (esEdicion ? '✏️ Editar objeto' : '+ Añadir objeto') + (esModoAdmin ? ' — ' + username : '') + '</h3>' +
      '<input type="text" id="pat-nombre" placeholder="Nombre del objeto" value="' + (esEdicion ? itemExistente.nombre : '') + '" />' +
      '<input type="number" id="pat-cantidad" placeholder="Cantidad" value="' + (esEdicion ? itemExistente.cantidad : '1') + '" min="1" style="margin-top:0.5rem" />' +
      '<textarea id="pat-desc" placeholder="Descripción (opcional)" style="margin-top:0.5rem;min-height:70px;resize:vertical">' + (esEdicion ? (itemExistente.descripcion || '') : '') + '</textarea>' +
      '<input type="number" id="pat-precio-compra" placeholder="Precio de compra £" value="' + (esEdicion ? itemExistente.precioCompra : '') + '" min="0" style="margin-top:0.5rem" />' +
      '<input type="number" id="pat-precio-mercado" placeholder="Precio de mercado £" value="' + (esEdicion ? itemExistente.precioMercado : '') + '" min="0" style="margin-top:0.5rem" />' +
      '<input type="url" id="pat-imagen" placeholder="URL de imagen (opcional)" value="' + (esEdicion ? (itemExistente.imagen || '') : '') + '" style="margin-top:0.5rem" />' +
      (esModoAdmin
        ? '<input type="text" id="pat-motivo-admin" placeholder="Motivo del cambio (obligatorio)" style="margin-top:0.5rem" />'
        : '') +
      '<button class="btn btn-primary btn-full" id="btn-guardar-pat-item" style="margin-top:0.75rem">' + (esEdicion ? 'Guardar cambios' : 'Añadir al inventario') + '</button>' +
      '<div id="pat-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  form.querySelectorAll('input, textarea').forEach(function(el) {
    el.style.cssText += ';width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block';
  });

  document.getElementById('btn-guardar-pat-item').addEventListener('click', async function() {
    var nombre = document.getElementById('pat-nombre').value.trim();
    var cantidad = parseInt(document.getElementById('pat-cantidad').value) || 1;
    var desc = document.getElementById('pat-desc').value.trim();
    var precioCompra = parseFloat(document.getElementById('pat-precio-compra').value) || 0;
    var precioMercado = parseFloat(document.getElementById('pat-precio-mercado').value) || 0;
    var imagen = document.getElementById('pat-imagen').value.trim();
    var motivoAdmin = esModoAdmin ? (document.getElementById('pat-motivo-admin') ? document.getElementById('pat-motivo-admin').value.trim() : '') : '';
    var msg = document.getElementById('pat-msg');

    if (!nombre) { msg.textContent = 'El nombre es obligatorio'; msg.style.color = 'var(--danger)'; return; }
    if (esModoAdmin && !motivoAdmin) { msg.textContent = 'El motivo es obligatorio'; msg.style.color = 'var(--danger)'; return; }

    var btn = document.getElementById('btn-guardar-pat-item');
    btn.disabled = true; btn.textContent = 'Guardando...';

    var ahora = new Date().toISOString();
    var descripcionHistorial = esModoAdmin
      ? (esEdicion ? 'Editado por admin ' + currentUser.username + '. Motivo: ' + motivoAdmin : 'Añadido por admin ' + currentUser.username + '. Motivo: ' + motivoAdmin)
      : (esEdicion ? 'Editado por el usuario' : 'Añadido manualmente');

    try {
      if (esEdicion) {
        await updateDoc(doc(db, 'patrimonio', itemExistente.id), {
          nombre: nombre, cantidad: cantidad, descripcion: desc,
          precioCompra: precioCompra, precioMercado: precioMercado,
          imagen: imagen, editadoEn: ahora
        });
        await addDoc(collection(db, 'patrimonio_historial'), {
          uid: uid, username: username, tipo: 'editado',
          itemNombre: nombre, categoria: categoriaKey,
          descripcion: descripcionHistorial, fecha: ahora
        });
      } else {
        await addDoc(collection(db, 'patrimonio'), {
          uid: uid, username: username, categoria: categoriaKey,
          nombre: nombre, cantidad: cantidad, descripcion: desc,
          precioCompra: precioCompra, precioMercado: precioMercado,
          imagen: imagen, activo: true, creadoEn: ahora,
          creadoPor: currentUser.username
        });
        await addDoc(collection(db, 'patrimonio_historial'), {
          uid: uid, username: username, tipo: 'añadido',
          itemNombre: nombre, categoria: categoriaKey,
          descripcion: descripcionHistorial, fecha: ahora
        });
      }
      msg.textContent = '✓ ' + (esEdicion ? 'Cambios guardados' : 'Objeto añadido');
      msg.style.color = 'var(--success)';
      form.innerHTML = '';
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
      msg.style.color = 'var(--danger)';
      btn.disabled = false; btn.textContent = esEdicion ? 'Guardar cambios' : 'Añadir al inventario';
    }
  });
}

function mostrarFormBorrarItem(itemId, uid, username, categoriaKey, categoriaObj, esAdmin, esModoAdmin) {
  var form = document.getElementById('patrimonio-form');
  form.innerHTML =
    '<div class="card" style="margin-top:1rem;border-color:var(--danger)">' +
      '<h3 style="margin-bottom:0.75rem;color:var(--danger)">🗑️ Eliminar objeto</h3>' +
      '<textarea id="pat-motivo-borrar" placeholder="Motivo de eliminación (obligatorio)" style="min-height:70px;resize:vertical"></textarea>' +
      '<button class="btn btn-primary btn-full" id="btn-confirmar-borrar-pat" style="margin-top:0.75rem;background:var(--danger)">Confirmar eliminación</button>' +
      '<button class="btn btn-secondary btn-full" id="btn-cancelar-borrar-pat" style="margin-top:0.5rem">Cancelar</button>' +
      '<div id="pat-borrar-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  form.querySelector('textarea').style.cssText = 'width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block';

  document.getElementById('btn-cancelar-borrar-pat').addEventListener('click', function() { form.innerHTML = ''; });

  document.getElementById('btn-confirmar-borrar-pat').addEventListener('click', async function() {
    var motivo = document.getElementById('pat-motivo-borrar').value.trim();
    var msg = document.getElementById('pat-borrar-msg');
    if (!motivo) { msg.textContent = 'El motivo es obligatorio'; msg.style.color = 'var(--danger)'; return; }

    var btn = document.getElementById('btn-confirmar-borrar-pat');
    btn.disabled = true; btn.textContent = 'Eliminando...';

    var snap2 = await getDoc(doc(db, 'patrimonio', itemId));
    var itemData = snap2.data();
    var ahora = new Date().toISOString();
    var descripcionHistorial = esModoAdmin
      ? 'Eliminado por admin ' + currentUser.username + '. Motivo: ' + motivo
      : 'Eliminado. Motivo: ' + motivo;

    await updateDoc(doc(db, 'patrimonio', itemId), { activo: false, eliminadoEn: ahora });
    await addDoc(collection(db, 'patrimonio_historial'), {
      uid: uid, username: username, tipo: 'eliminado',
      itemNombre: itemData.nombre, categoria: categoriaKey,
      descripcion: descripcionHistorial, fecha: ahora
    });

    form.innerHTML = '';
  });
}

function renderHistorialPatrimonio(uid, username, esAdmin) {
  var panel = document.getElementById('patrimonio-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-historial-pat">← Patrimonio</button>' +
      '<h3>📋 Historial — ' + username + '</h3>' +
    '</div>' +
    '<div class="categorias-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:0.75rem">' +
      '<button class="btn-historial-tab active" data-tipo="añadido" style="padding:0.5rem;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:white;font-size:0.78rem;cursor:pointer">➕ Añadido</button>' +
      '<button class="btn-historial-tab" data-tipo="editado" style="padding:0.5rem;border-radius:8px;border:1px solid var(--bg-card);background:var(--bg-secondary);color:var(--text-primary);font-size:0.78rem;cursor:pointer">✏️ Editado</button>' +
      '<button class="btn-historial-tab" data-tipo="eliminado" style="padding:0.5rem;border-radius:8px;border:1px solid var(--bg-card);background:var(--bg-secondary);color:var(--text-primary);font-size:0.78rem;cursor:pointer">🗑️ Eliminado</button>' +
    '</div>' +
    '<div id="historial-lista"><p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">Cargando...</p></div>';

  document.getElementById('back-historial-pat').addEventListener('click', function() { panel.innerHTML = ''; });

  cargarHistorialPatrimonio(uid, 'añadido');

  panel.querySelectorAll('.btn-historial-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      panel.querySelectorAll('.btn-historial-tab').forEach(function(t) {
        t.style.background = 'var(--bg-secondary)';
        t.style.borderColor = 'var(--bg-card)';
        t.style.color = 'var(--text-primary)';
      });
      tab.style.background = 'var(--accent)';
      tab.style.borderColor = 'var(--accent)';
      tab.style.color = 'white';
      cargarHistorialPatrimonio(uid, tab.dataset.tipo);
    });
  });
}

function cargarHistorialPatrimonio(uid, tipo) {
  var lista = document.getElementById('historial-lista');
  if (!lista) return;
  lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">Cargando...</p>';
  onSnapshot(
    query(collection(db, 'patrimonio_historial'), where('uid', '==', uid), where('tipo', '==', tipo), orderBy('fecha', 'desc')),
    function(snap) {
      if (!lista) return;
      if (snap.empty) { lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:1rem">Sin registros.</p>'; return; }
      lista.innerHTML = snap.docs.map(function(d) {
        var h = d.data();
        return '<div class="movimiento-item">' +
          '<div class="movimiento-info">' +
            '<p class="movimiento-desc">' + h.itemNombre + ' — ' + h.categoria + '</p>' +
            '<p class="movimiento-meta">' + h.descripcion + '</p>' +
            '<p class="movimiento-meta">' + new Date(h.fecha).toLocaleString('es-CO') + '</p>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  );
}

function renderPanelAdminPatrimonio(esAdmin, esRegidor) {
  var panel = document.getElementById('patrimonio-panel');
  var soloCiudad = esRegidor && !esAdmin;
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-admin-pat">← Patrimonio</button>' +
      '<h3>' + (esAdmin ? '🔍 Panel Admin' : '🔍 Ver patrimonio') + '</h3>' +
    '</div>' +
    '<div style="position:relative">' +
      '<input type="text" id="admin-pat-usuario" placeholder="Buscar usuario..." autocomplete="off" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block" />' +
      '<div id="admin-pat-lista" class="usuarios-lista"></div>' +
    '</div>' +
    '<button class="btn btn-primary btn-full" id="btn-buscar-pat-usuario" style="margin-top:0.5rem">Buscar</button>' +
    '<div id="admin-pat-resultado"></div>';

  document.getElementById('back-admin-pat').addEventListener('click', function() { panel.innerHTML = ''; });
  crearBuscadorUsuarios('admin-pat-usuario', 'admin-pat-lista', null, soloCiudad);

  document.getElementById('btn-buscar-pat-usuario').addEventListener('click', async function() {
    var username = document.getElementById('admin-pat-usuario').value.trim().toLowerCase();
    if (!username) return;
    var usernameSnap = await getDoc(doc(db, 'usernames', username));
    if (!usernameSnap.exists()) { document.getElementById('admin-pat-resultado').innerHTML = '<p style="color:var(--danger);margin-top:0.5rem">Usuario no encontrado</p>'; return; }
    var uid = usernameSnap.data().uid;
    var userSnap = await getDoc(doc(db, 'usuarios', uid));
    var userData = userSnap.data();
    if (soloCiudad && userData.ciudad !== currentUser.ciudad) {
      document.getElementById('admin-pat-resultado').innerHTML = '<p style="color:var(--danger);margin-top:0.5rem">No tienes permiso para ver usuarios de otra ciudad</p>';
      return;
    }

    var categorias = [
      { key: 'armas', emoji: '⚔️', label: 'Armas' },
      { key: 'vehiculos', emoji: '🚗', label: 'Vehículos' },
      { key: 'casas', emoji: '🏠', label: 'Casas' },
      { key: 'terrenos', emoji: '🏔️', label: 'Terrenos' },
      { key: 'construcciones', emoji: '🏗️', label: 'Construcciones' },
      { key: 'comida', emoji: '🍽️', label: 'Comida' },
      { key: 'materiales_armas', emoji: '🔩', label: 'Materiales para armas' },
      { key: 'materiales_construccion', emoji: '🧱', label: 'Materiales de construcción' },
      { key: 'metales_preciosos', emoji: '💎', label: 'Metales preciosos/joyas' },
      { key: 'artilugios', emoji: '🔮', label: 'Artilugios' },
      { key: 'animales', emoji: '🐾', label: 'Animales' },
      { key: 'esclavos', emoji: '⛓️', label: 'Esclavos' },
      { key: 'otros', emoji: '📦', label: 'Otros' }
    ];

    document.getElementById('admin-pat-resultado').innerHTML =
      '<div class="card" style="margin-top:1rem">' +
        '<h3>' + userData.username + ' · ' + (userData.ciudad || 'Sin ciudad') + '</h3>' +
        '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.75rem">Rol: ' + userData.rol + '</p>' +
      '</div>' +
      '<div class="categorias-grid">' +
        categorias.map(function(c) {
          return '<button class="categoria-btn btn-admin-pat-cat" data-key="' + c.key + '" data-uid="' + uid + '" data-username="' + userData.username + '"><span>' + c.emoji + '</span><span>' + c.label + '</span></button>';
        }).join('') +
      '</div>' +
      '<button class="btn btn-secondary btn-full btn-admin-pat-historial" data-uid="' + uid + '" data-username="' + userData.username + '" style="margin-top:0.5rem">📋 Ver historial</button>';

    document.querySelectorAll('.btn-admin-pat-cat').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var cat = categorias.find(function(c) { return c.key === btn.dataset.key; });
        renderCategoriaPatrimonio(btn.dataset.key, cat, btn.dataset.uid, btn.dataset.username, esAdmin, true);
      });
    });

    document.querySelector('.btn-admin-pat-historial').addEventListener('click', function() {
      renderHistorialPatrimonio(this.dataset.uid, this.dataset.username, esAdmin);
    });
  });
}

function renderProximamente(seccion) {
  var iconos = { casino: '🎰', citas: '💘', misiones: '⚔️' };
  var nombres = { casino: 'Casino', citas: 'Citas', misiones: 'Misiones' };
  mainContent.innerHTML =
    '<div class="proximamente-wrap">' +
      '<div class="proximamente-icon">' + (iconos[seccion] || '🔒') + '</div>' +
      '<h2 class="proximamente-titulo">' + (nombres[seccion] || seccion) + '</h2>' +
      '<p class="proximamente-texto">Esta seccion esta en desarrollo.</p>' +
      '<p class="proximamente-texto">Proximamente disponible.</p>' +
    '</div>';
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
  var ciudades = ['Ryazan', 'Ryla', 'Kemerov', 'Navarra', 'Gresit', 'Odrekao', 'Irkustk'];
  var foto = currentUser && currentUser.fotoPerfil ? currentUser.fotoPerfil : '';

  mainContent.innerHTML =
    '<div class="card perfil-card">' +
      '<div class="perfil-header">' +
        '<div class="perfil-avatar-wrap">' +
          (foto
            ? '<img src="' + foto + '" class="perfil-avatar" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><div class="perfil-avatar-placeholder" style="display:none">👤</div>'
            : '<div class="perfil-avatar-placeholder">👤</div>'
          ) +
        '</div>' +
        '<div class="perfil-datos">' +
          '<h2 class="perfil-username">' + (currentUser ? currentUser.username : '') + '</h2>' +
          '<span class="perfil-rol-badge">' + (currentUser ? currentUser.rol : 'jugador') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="perfil-info-lista">' +
        '<div class="perfil-info-item"><span class="perfil-info-label">🏙️ Ciudad</span><span class="perfil-info-valor">' + (currentUser && currentUser.ciudad ? currentUser.ciudad : 'Sin asignar') + '</span></div>' +
        '<div class="perfil-info-item"><span class="perfil-info-label">📱 WhatsApp</span><span class="perfil-info-valor">' + (currentUser && currentUser.whatsapp ? currentUser.whatsapp : 'No registrado') + '</span></div>' +
        '<div class="perfil-info-item"><span class="perfil-info-label">⚔️ Nivel</span><span class="perfil-info-valor">' + (currentUser && currentUser.nivel ? currentUser.nivel : 'No definido') + '</span></div>' +
        '<div class="perfil-info-item"><span class="perfil-info-label">🧬 Raza</span><span class="perfil-info-valor">' + (currentUser && currentUser.raza ? currentUser.raza : 'No definida') + '</span></div>' +
        '<div class="perfil-info-item"><span class="perfil-info-label">🎂 Edad</span><span class="perfil-info-valor">' + (currentUser && currentUser.edad ? currentUser.edad : 'No definida') + '</span></div>' +
        '<div class="perfil-info-item"><span class="perfil-info-label">✨ Dato curioso</span><span class="perfil-info-valor">' + (currentUser && currentUser.datoCurioso ? currentUser.datoCurioso : 'No definido') + '</span></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-full" id="btn-abrir-editar-perfil" style="margin-top:1rem">✏️ Editar perfil</button>' +
    '</div>' +
    '<button class="btn btn-secondary btn-full" id="logout-btn" style="margin-top:0.5rem">Cerrar sesion</button>' +

    '<div id="modal-editar-perfil" class="modal-overlay hidden">' +
      '<div class="modal-box">' +
        '<div class="modal-header">' +
          '<h3>✏️ Editar perfil</h3>' +
          '<button id="btn-cerrar-modal-perfil" class="modal-close-btn">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +

          '<div class="edit-section">' +
            '<p class="edit-section-title">🖼️ Foto de perfil</p>' +
            '<div class="foto-preview-wrap">' +
              '<div id="foto-preview-container">' +
                (foto
                  ? '<img id="foto-preview-img" src="' + foto + '" class="foto-preview-img" onerror="this.style.display=\'none\'" />'
                  : '<div id="foto-preview-placeholder" class="foto-preview-placeholder">👤</div>'
                ) +
              '</div>' +
            '</div>' +
            '<input type="url" id="perfil-foto-url" placeholder="Pega aqui la URL de tu foto..." value="' + foto + '" />' +
            '<button class="btn btn-secondary btn-full" id="btn-previsualizar-foto" style="margin-top:0.5rem">Previsualizar</button>' +
            '<button class="btn btn-primary btn-full" id="btn-guardar-foto" style="margin-top:0.4rem">Guardar foto</button>' +
            '<div id="foto-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
          '</div>' +

          '<hr class="edit-divider" />' +

          (!esRegidor
            ? '<div class="edit-section">' +
                '<p class="edit-section-title">🏙️ Ciudad</p>' +
                '<select id="perfil-ciudad"><option value="">Selecciona tu ciudad</option>' +
                ciudades.map(function(c) { return '<option value="' + c + '"' + (currentUser && currentUser.ciudad === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
                '</select>' +
                '<button class="btn btn-primary btn-full" id="btn-guardar-ciudad" style="margin-top:0.5rem">Guardar ciudad</button>' +
                '<div id="ciudad-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
              '</div><hr class="edit-divider" />'
            : '<div class="edit-section"><p class="edit-section-title">🏙️ Ciudad</p><p style="color:var(--text-secondary);font-size:0.85rem">Los regidores no pueden cambiar su ciudad.</p></div><hr class="edit-divider" />'
          ) +

          '<div class="edit-section">' +
            '<p class="edit-section-title">📱 WhatsApp</p>' +
            '<input type="tel" id="perfil-whatsapp" placeholder="Numero de WhatsApp" value="' + (currentUser && currentUser.whatsapp ? currentUser.whatsapp : '') + '" />' +
            '<button class="btn btn-primary btn-full" id="btn-guardar-whatsapp" style="margin-top:0.5rem">Guardar WhatsApp</button>' +
            '<div id="whatsapp-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
          '</div>' +

          '<hr class="edit-divider" />' +

          '<div class="edit-section">' +
            '<p class="edit-section-title">⚔️ Nivel del personaje</p>' +
            '<input type="number" id="perfil-nivel" placeholder="Nivel del personaje" min="1" value="' + (currentUser && currentUser.nivel ? currentUser.nivel : '') + '" />' +
            '<button class="btn btn-primary btn-full" id="btn-guardar-nivel" style="margin-top:0.5rem">Guardar nivel</button>' +
            '<div id="nivel-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
          '</div>' +

          '<hr class="edit-divider" />' +

          '<div class="edit-section">' +
            '<p class="edit-section-title">🧬 Raza</p>' +
            '<input type="text" id="perfil-raza" placeholder="Raza del personaje" value="' + (currentUser && currentUser.raza ? currentUser.raza : '') + '" />' +
            '<button class="btn btn-primary btn-full" id="btn-guardar-raza" style="margin-top:0.5rem">Guardar raza</button>' +
            '<div id="raza-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
          '</div>' +

          '<hr class="edit-divider" />' +

          '<div class="edit-section">' +
            '<p class="edit-section-title">🎂 Edad</p>' +
            '<input type="number" id="perfil-edad" placeholder="Edad del personaje" min="1" value="' + (currentUser && currentUser.edad ? currentUser.edad : '') + '" />' +
            '<button class="btn btn-primary btn-full" id="btn-guardar-edad" style="margin-top:0.5rem">Guardar edad</button>' +
            '<div id="edad-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
          '</div>' +

          '<hr class="edit-divider" />' +

          '<div class="edit-section">' +
            '<p class="edit-section-title">✨ Dato curioso <span style="color:var(--text-secondary);font-size:0.75rem">(máx. 75 caracteres)</span></p>' +
            '<input type="text" id="perfil-dato" placeholder="Dato curioso sobre tu personaje" maxlength="75" value="' + (currentUser && currentUser.datoCurioso ? currentUser.datoCurioso : '') + '" />' +
            '<button class="btn btn-primary btn-full" id="btn-guardar-dato" style="margin-top:0.5rem">Guardar dato curioso</button>' +
            '<div id="dato-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
          '</div>' +

          '<hr class="edit-divider" />' +

          '<div class="edit-section">' +
            '<p class="edit-section-title">🔑 Cambiar contrasena</p>' +
            '<input type="password" id="perfil-pass-nueva" placeholder="Nueva contrasena (min 6 caracteres)" />' +
            '<input type="password" id="perfil-pass-confirmar" placeholder="Confirmar nueva contrasena" style="margin-top:0.5rem" />' +
            '<button class="btn btn-primary btn-full" id="btn-cambiar-pass" style="margin-top:0.5rem">Cambiar contrasena</button>' +
            '<div id="pass-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
          '</div>' +

        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('btn-abrir-editar-perfil').addEventListener('click', function() {
    document.getElementById('modal-editar-perfil').classList.remove('hidden');
  });
  document.getElementById('btn-cerrar-modal-perfil').addEventListener('click', function() {
    document.getElementById('modal-editar-perfil').classList.add('hidden');
  });
  document.getElementById('modal-editar-perfil').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });

  document.getElementById('btn-previsualizar-foto').addEventListener('click', function() {
    var url = document.getElementById('perfil-foto-url').value.trim();
    var container = document.getElementById('foto-preview-container');
    var msg = document.getElementById('foto-msg');
    if (!url) { msg.textContent = 'Ingresa una URL'; msg.style.color = 'var(--danger)'; return; }
    container.innerHTML = '<img id="foto-preview-img" src="' + url + '" class="foto-preview-img" />';
    document.getElementById('foto-preview-img').addEventListener('error', function() {
      container.innerHTML = '<div class="foto-preview-placeholder">❌</div>';
      msg.textContent = 'La URL no es una imagen valida'; msg.style.color = 'var(--danger)';
    });
    document.getElementById('foto-preview-img').addEventListener('load', function() {
      msg.textContent = 'Vista previa cargada'; msg.style.color = 'var(--success)';
    });
  });

  document.getElementById('btn-guardar-foto').addEventListener('click', async function() {
    var url = document.getElementById('perfil-foto-url').value.trim();
    var msg = document.getElementById('foto-msg');
    if (!url) { msg.textContent = 'Ingresa una URL'; msg.style.color = 'var(--danger)'; return; }
    var btn = this; btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { fotoPerfil: url });
      currentUser.fotoPerfil = url;
      msg.textContent = 'Foto actualizada'; msg.style.color = 'var(--success)';
    } catch (err) {
      msg.textContent = 'Error al guardar'; msg.style.color = 'var(--danger)';
    }
    btn.disabled = false; btn.textContent = 'Guardar foto';
  });

  if (!esRegidor) {
    document.getElementById('btn-guardar-ciudad').addEventListener('click', async function() {
      var ciudad = document.getElementById('perfil-ciudad').value;
      var msg = document.getElementById('ciudad-msg');
      if (!ciudad) { msg.textContent = 'Selecciona una ciudad'; msg.style.color = 'var(--danger)'; return; }
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { ciudad: ciudad });
      currentUser.ciudad = ciudad;
      msg.textContent = 'Ciudad actualizada a ' + ciudad; msg.style.color = 'var(--success)';
    });
  }

  document.getElementById('btn-guardar-whatsapp').addEventListener('click', async function() {
    var whatsapp = document.getElementById('perfil-whatsapp').value.trim();
    var msg = document.getElementById('whatsapp-msg');
    if (!whatsapp) { msg.textContent = 'Ingresa un numero'; msg.style.color = 'var(--danger)'; return; }
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { whatsapp: whatsapp });
    currentUser.whatsapp = whatsapp;
    msg.textContent = 'WhatsApp actualizado'; msg.style.color = 'var(--success)';
  });

  document.getElementById('btn-guardar-nivel').addEventListener('click', async function() {
    var nivel = parseInt(document.getElementById('perfil-nivel').value);
    var msg = document.getElementById('nivel-msg');
    if (!nivel || nivel < 1) { msg.textContent = 'Ingresa un nivel válido'; msg.style.color = 'var(--danger)'; return; }
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { nivel: nivel });
    currentUser.nivel = nivel;
    msg.textContent = 'Nivel actualizado'; msg.style.color = 'var(--success)';
  });

  document.getElementById('btn-guardar-raza').addEventListener('click', async function() {
    var raza = document.getElementById('perfil-raza').value.trim();
    var msg = document.getElementById('raza-msg');
    if (!raza) { msg.textContent = 'Ingresa una raza'; msg.style.color = 'var(--danger)'; return; }
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { raza: raza });
    currentUser.raza = raza;
    msg.textContent = 'Raza actualizada'; msg.style.color = 'var(--success)';
  });

  document.getElementById('btn-guardar-edad').addEventListener('click', async function() {
    var edad = parseInt(document.getElementById('perfil-edad').value);
    var msg = document.getElementById('edad-msg');
    if (!edad || edad < 1) { msg.textContent = 'Ingresa una edad válida'; msg.style.color = 'var(--danger)'; return; }
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { edad: edad });
    currentUser.edad = edad;
    msg.textContent = 'Edad actualizada'; msg.style.color = 'var(--success)';
  });

  document.getElementById('btn-guardar-dato').addEventListener('click', async function() {
    var dato = document.getElementById('perfil-dato').value.trim();
    var msg = document.getElementById('dato-msg');
    if (!dato) { msg.textContent = 'Ingresa un dato curioso'; msg.style.color = 'var(--danger)'; return; }
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { datoCurioso: dato });
    currentUser.datoCurioso = dato;
    msg.textContent = 'Dato curioso actualizado'; msg.style.color = 'var(--success)';
  });

  document.getElementById('btn-cambiar-pass').addEventListener('click', async function() {
    var nueva = document.getElementById('perfil-pass-nueva').value;
    var confirmar = document.getElementById('perfil-pass-confirmar').value;
    var msg = document.getElementById('pass-msg');
    if (!nueva || nueva.length < 6) { msg.textContent = 'Minimo 6 caracteres'; msg.style.color = 'var(--danger)'; return; }
    if (nueva !== confirmar) { msg.textContent = 'Las contrasenhas no coinciden'; msg.style.color = 'var(--danger)'; return; }
    var btn = this; btn.disabled = true; btn.textContent = 'Cambiando...';
    try {
      var { updatePassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await updatePassword(auth.currentUser, nueva);
      msg.textContent = 'Contrasena cambiada'; msg.style.color = 'var(--success)';
      document.getElementById('perfil-pass-nueva').value = '';
      document.getElementById('perfil-pass-confirmar').value = '';
    } catch (err) {
      msg.textContent = 'Error: ' + err.message; msg.style.color = 'var(--danger)';
    }
    btn.disabled = false; btn.textContent = 'Cambiar contrasena';
  });

  document.getElementById('logout-btn').addEventListener('click', function() { signOut(auth); });
}

// ===== CASINO =====

function renderCasino() {
  mainContent.innerHTML =
    '<div class="card"><h3>🎰 Casino de Estiria</h3><p style="color:var(--text-secondary);font-size:0.85rem">Elige un juego</p></div>' +
    '<div class="categorias-grid">' +
      '<button class="categoria-btn" id="casino-ruleta-rusa"><span>🔫</span><span>Ruleta Rusa</span></button>' +
      '<button class="categoria-btn" id="casino-tragaperras"><span>🎰</span><span>Tragaperras</span></button>' +
      '<button class="categoria-btn" id="casino-ruleta"><span>🎡</span><span>Ruleta</span></button>' +
      '<button class="categoria-btn" id="casino-dados"><span>🎲</span><span>Dados</span></button>' +
      '<button class="categoria-btn" id="casino-blackjack"><span>🃏</span><span>Blackjack</span></button>' +
    '</div>' +
    '<div id="casino-panel"></div>';

  document.getElementById('casino-ruleta-rusa').addEventListener('click', function() {
    renderRuletaRusa();
  });

  document.getElementById('casino-tragaperras').addEventListener('click', function() {
    renderTragaperras();
  });

  document.getElementById('casino-ruleta').addEventListener('click', function() {
    renderRuleta();
  });

  document.getElementById('casino-dados').addEventListener('click', function() {
    renderDados();
  });

  document.getElementById('casino-blackjack').addEventListener('click', function() {
    renderBlackjack();
  });
}

// ===== RULETA RUSA =====

var salaActualId = null;
var salaListener = null;
var girando = false;

function renderRuletaRusa() {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-casino">← Casino</button>' +
      '<h3>🔫 Ruleta Rusa</h3>' +
    '</div>' +
    '<div class="ruleta-menu">' +
      '<button class="btn btn-primary btn-full" id="btn-crear-sala-privada" style="margin-bottom:0.5rem">🔒 Crear sala privada</button>' +
      '<button class="btn btn-secondary btn-full" id="btn-unirse-codigo">🔑 Unirse con código</button>' +
    '</div>' +
    '<h3 style="margin:1rem 0 0.5rem;font-size:0.95rem">🌐 Salas públicas</h3>' +
    '<div class="salas-tabs">' +
      '<button class="sala-tab active" data-cap="2">2 jugadores</button>' +
      '<button class="sala-tab" data-cap="3">3 jugadores</button>' +
      '<button class="sala-tab" data-cap="4">4 jugadores</button>' +
      '<button class="sala-tab" data-cap="5">5 jugadores</button>' +
    '</div>' +
    '<div id="lista-salas-publicas"></div>' +
    '<div id="sala-form"></div>';

  document.getElementById('back-casino').addEventListener('click', function() {
    if (salaListener) { salaListener(); salaListener = null; }
    panel.innerHTML = '';
    renderCasino();
  });

  document.getElementById('btn-crear-sala-privada').addEventListener('click', function() {
    mostrarFormCrearSalaPrivada();
  });

  document.getElementById('btn-unirse-codigo').addEventListener('click', function() {
    mostrarFormUnirseConCodigo();
  });

  document.querySelectorAll('.sala-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.sala-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      cargarSalasPublicas(parseInt(tab.dataset.cap));
    });
  });

  cargarSalasPublicas(2);
  inicializarSalasPublicas();
}

async function inicializarSalasPublicas() {
  var caps = [2, 3, 4, 5];
  for (var c = 0; c < caps.length; c++) {
    var cap = caps[c];
    for (var i = 1; i <= 5; i++) {
      var salaId = 'publica_' + cap + '_' + i;
      var snap = await getDoc(doc(db, 'casino_salas', salaId));
      if (!snap.exists()) {
        await setDoc(doc(db, 'casino_salas', salaId), {
          id: salaId,
          tipo: 'publica',
          capacidad: cap,
          nombre: 'Sala ' + i + ' (' + cap + ' jugadores)',
          estado: 'esperando',
          jugadores: [],
          espectadores: [],
          createdAt: new Date().toISOString()
        });
      }
    }
  }
}

function cargarSalasPublicas(capacidad) {
  var lista = document.getElementById('lista-salas-publicas');
  if (!lista) return;
  lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:0.5rem">Cargando...</p>';

  var q = query(
    collection(db, 'casino_salas'),
    where('tipo', '==', 'publica'),
    where('capacidad', '==', capacidad)
  );

  onSnapshot(q, function(snap) {
    lista = document.getElementById('lista-salas-publicas');
    if (!lista) return;
    if (snap.empty) { lista.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:0.5rem">No hay salas disponibles.</p>'; return; }

    var salas = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    salas.sort(function(a, b) { return a.id.localeCompare(b.id); });

    lista.innerHTML = salas.map(function(sala) {
      var jugadores = sala.jugadores ? sala.jugadores.length : 0;
      var estado = sala.estado || 'esperando';
      var estadoColor = estado === 'jugando' ? 'var(--danger)' : estado === 'esperando' && jugadores > 0 ? 'var(--warning)' : 'var(--success)';
      var estadoTexto = estado === 'jugando' ? '🔴 En juego' : jugadores > 0 ? '🟡 Esperando (' + jugadores + '/' + sala.capacidad + ')' : '🟢 Vacía';
      var puedeEntrar = estado !== 'jugando' && jugadores < sala.capacidad;
      var estaAdentro = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });

      return '<div class="sala-card">' +
        '<div class="sala-info">' +
          '<p class="sala-nombre">' + sala.nombre + '</p>' +
          '<p class="sala-estado" style="color:' + estadoColor + '">' + estadoTexto + '</p>' +
        '</div>' +
        (estaAdentro
          ? '<button class="btn btn-primary sala-btn" data-id="' + sala.id + '" data-cap="' + sala.capacidad + '">Volver</button>'
          : puedeEntrar
            ? '<button class="btn btn-primary sala-btn" data-id="' + sala.id + '" data-cap="' + sala.capacidad + '">Entrar</button>'
            : '<button class="btn btn-secondary sala-btn" data-id="' + sala.id + '" data-cap="' + sala.capacidad + '" disabled>Ver</button>'
        ) +
      '</div>';
    }).join('');

    lista.querySelectorAll('.sala-btn:not([disabled])').forEach(function(btn) {
      btn.addEventListener('click', function() {
        entrarASala(btn.dataset.id, parseInt(btn.dataset.cap));
      });
    });
  });
}

function mostrarFormCrearSalaPrivada() {
  var form = document.getElementById('sala-form');
  form.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.75rem">🔒 Crear sala privada</h3>' +
      '<p class="edit-section-title">Capacidad</p>' +
      '<div class="citas-opciones" id="cap-privada">' +
        [2,3,4,5].map(function(n) {
          return '<button class="citas-opcion" data-val="' + n + '">' + n + ' jugadores</button>';
        }).join('') +
      '</div>' +
      '<button class="btn btn-primary btn-full" id="btn-confirmar-sala-privada" style="margin-top:0.75rem">Crear sala</button>' +
      '<div id="sala-privada-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  document.getElementById('cap-privada').querySelectorAll('.citas-opcion').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.getElementById('cap-privada').querySelectorAll('.citas-opcion').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
    });
  });

  document.getElementById('btn-confirmar-sala-privada').addEventListener('click', async function() {
    var capBtn = document.querySelector('#cap-privada .citas-opcion.selected');
    var msg = document.getElementById('sala-privada-msg');
    if (!capBtn) { msg.textContent = 'Selecciona la capacidad'; msg.style.color = 'var(--danger)'; return; }
    var cap = parseInt(capBtn.dataset.val);
    var codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    var salaId = 'privada_' + codigo;
    var btn = document.getElementById('btn-confirmar-sala-privada');
    btn.disabled = true; btn.textContent = 'Creando...';
    await setDoc(doc(db, 'casino_salas', salaId), {
      id: salaId, tipo: 'privada', capacidad: cap,
      nombre: 'Sala privada', codigo: codigo,
      estado: 'esperando', jugadores: [], espectadores: [],
      creadoPor: currentUser.uid, createdAt: new Date().toISOString()
    });
    form.innerHTML = '';
    entrarASala(salaId, cap);
  });
}

function mostrarFormUnirseConCodigo() {
  var form = document.getElementById('sala-form');
  form.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.75rem">🔑 Unirse con código</h3>' +
      '<input type="text" id="input-codigo-sala" placeholder="Código de sala (ej: AB12CD)" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;text-transform:uppercase" />' +
      '<button class="btn btn-primary btn-full" id="btn-confirmar-codigo" style="margin-top:0.5rem">Buscar sala</button>' +
      '<div id="codigo-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  document.getElementById('btn-confirmar-codigo').addEventListener('click', async function() {
    var codigo = document.getElementById('input-codigo-sala').value.trim().toUpperCase();
    var msg = document.getElementById('codigo-msg');
    if (!codigo) { msg.textContent = 'Ingresa un código'; msg.style.color = 'var(--danger)'; return; }
    var salaId = 'privada_' + codigo;
    var snap = await getDoc(doc(db, 'casino_salas', salaId));
    if (!snap.exists()) { msg.textContent = 'Sala no encontrada'; msg.style.color = 'var(--danger)'; return; }
    var sala = snap.data();
    if (sala.estado === 'jugando') { msg.textContent = 'La partida ya comenzó, espera'; msg.style.color = 'var(--danger)'; return; }
    if (sala.jugadores && sala.jugadores.length >= sala.capacidad) { msg.textContent = 'Sala llena'; msg.style.color = 'var(--danger)'; return; }
    form.innerHTML = '';
    entrarASala(salaId, sala.capacidad);
  });
}

async function entrarASala(salaId, capacidad) {
  var snap = await getDoc(doc(db, 'casino_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();

  var yaEsta = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });

  if (!yaEsta && sala.estado === 'esperando' && (!sala.jugadores || sala.jugadores.length < capacidad)) {
    var nuevosJugadores = (sala.jugadores || []).concat([{
      uid: currentUser.uid,
      username: currentUser.username,
      saldo: currentUser.saldo || 0,
      foto: currentUser.fotoPerfil || '',
      apretadas: 0,
      eliminado: false
    }]);
    await updateDoc(doc(db, 'casino_salas', salaId), { jugadores: nuevosJugadores });
  }

  salaActualId = salaId;
  renderSala(salaId);
}

function renderSala(salaId) {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML =
    '<div id="sala-container" style="min-height:300px">' +
      '<p style="color:var(--text-secondary);text-align:center;padding:2rem">Cargando sala...</p>' +
    '</div>';

  if (salaListener) { salaListener(); salaListener = null; }

  salaListener = onSnapshot(doc(db, 'casino_salas', salaId), function(snap) {
    if (!snap.exists()) return;
    var sala = snap.data();
    var container = document.getElementById('sala-container');
    if (!container) return;

    var yoJugador = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });

    switch (sala.estado) {
      case 'esperando':
        renderEstadoEsperando(container, sala, salaId);
        break;
      case 'apostando':
        renderEstadoApostando(container, sala, salaId, yoJugador);
        break;
      case 'dados':
        renderEstadoDados(container, sala, salaId, yoJugador);
        break;
      case 'eligiendo_espacios':
        renderEstadoEligiendoEspacios(container, sala, salaId, yoJugador);
        break;
      case 'jugando':
        renderEstadoJugando(container, sala, salaId, yoJugador);
        break;
      case 'terminado':
        renderEstadoTerminado(container, sala, salaId, yoJugador);
        break;
    }
  });
}

function renderEstadoEsperando(container, sala, salaId) {
  var jugadores = sala.jugadores || [];
  var soyCreador = sala.tipo === 'privada' && sala.creadoPor === currentUser.uid;
  var puedoSalir = jugadores.find(function(j) { return j.uid === currentUser.uid; });

  container.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">' +
        '<h3>' + sala.nombre + '</h3>' +
        (sala.codigo ? '<span class="perfil-rol-badge" style="font-size:0.75rem">Código: ' + sala.codigo + '</span>' : '') +
      '</div>' +
      '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1rem">Esperando jugadores... ' + jugadores.length + '/' + sala.capacidad + '</p>' +
      '<div id="sala-jugadores-lista">' +
        jugadores.map(function(j) {
          return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--bg-card)">' +
            (j.foto ? '<img src="' + j.foto + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover" />' : '<div style="width:32px;height:32px;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:1rem">👤</div>') +
            '<p style="font-size:0.9rem;color:var(--text-primary)">' + j.username + '</p>' +
          '</div>';
        }).join('') +
      '</div>' +
      (jugadores.length < sala.capacidad
        ? '<p style="color:var(--text-secondary);font-size:0.82rem;margin-top:0.75rem;text-align:center">Esperando ' + (sala.capacidad - jugadores.length) + ' jugadores más...</p>'
        : ''
      ) +
      '<div style="display:flex;gap:0.5rem;margin-top:1rem">' +
        (puedoSalir ? '<button class="btn btn-secondary" id="btn-salir-sala" style="flex:1;border-color:var(--danger);color:var(--danger)">Salir</button>' : '') +
      '</div>' +
    '</div>';

  if (puedoSalir) {
    document.getElementById('btn-salir-sala').addEventListener('click', async function() {
      var nuevosJugadores = sala.jugadores.filter(function(j) { return j.uid !== currentUser.uid; });
      await updateDoc(doc(db, 'casino_salas', salaId), { jugadores: nuevosJugadores });
      if (salaListener) { salaListener(); salaListener = null; }
      salaActualId = null;
      renderRuletaRusa();
    });
  }

  if (jugadores.length === sala.capacidad && sala.estado === 'esperando') {
    setTimeout(async function() {
      var snapActual = await getDoc(doc(db, 'casino_salas', salaId));
      if (snapActual.data().estado === 'esperando' && snapActual.data().jugadores.length === sala.capacidad) {
        await updateDoc(doc(db, 'casino_salas', salaId), { estado: 'apostando' });
      }
    }, 1500);
  }
}

function renderEstadoApostando(container, sala, salaId, yoJugador) {
  if (!yoJugador) { container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem">Partida en curso, espera.</p>'; return; }

  var apuestasListas = sala.apuestas || {};
  var yoApeste = apuestasListas[currentUser.uid] !== undefined;
  var saldoMin = Math.min.apply(null, sala.jugadores.map(function(j) { return j.saldo || 0; }));
  var maxApuesta = saldoMin;

  container.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.75rem">💰 Fase de apuestas</h3>' +
      '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.75rem">Mínimo £100 · Máximo £' + maxApuesta.toLocaleString('es-CO') + '</p>' +
      '<div style="margin-bottom:0.75rem">' +
        sala.jugadores.map(function(j) {
          var aposto = apuestasListas[j.uid] !== undefined;
          return '<div style="display:flex;justify-content:space-between;padding:0.35rem 0;font-size:0.85rem">' +
            '<span>' + j.username + '</span>' +
            '<span style="color:' + (aposto ? 'var(--success)' : 'var(--text-secondary)') + '">' + (aposto ? '✓ Listo' : '⏳ Pendiente') + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      (!yoApeste
        ? '<input type="number" id="input-apuesta" placeholder="Tu apuesta en £" min="100" max="' + maxApuesta + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;margin-bottom:0.5rem" />' +
          '<button class="btn btn-primary btn-full" id="btn-confirmar-apuesta">Confirmar apuesta</button>' +
          '<div id="apuesta-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>'
        : '<p style="color:var(--success);text-align:center">✓ Tu apuesta de £' + apuestasListas[currentUser.uid].toLocaleString('es-CO') + ' está confirmada</p>'
      ) +
    '</div>';

  if (!yoApeste) {
    document.getElementById('btn-confirmar-apuesta').addEventListener('click', async function() {
      var monto = parseInt(document.getElementById('input-apuesta').value);
      var msg = document.getElementById('apuesta-msg');
      if (!monto || monto < 100) { msg.textContent = 'Mínimo £100'; msg.style.color = 'var(--danger)'; return; }
      if (monto > maxApuesta) { msg.textContent = 'Máximo £' + maxApuesta.toLocaleString('es-CO'); msg.style.color = 'var(--danger)'; return; }
      if (monto > (currentUser.saldo || 0)) { msg.textContent = 'Saldo insuficiente'; msg.style.color = 'var(--danger)'; return; }
      var nuevasApuestas = Object.assign({}, apuestasListas);
      nuevasApuestas[currentUser.uid] = monto;
      var update = { apuestas: nuevasApuestas };
      if (Object.keys(nuevasApuestas).length === sala.capacidad) {
        update.estado = 'dados';
        update.dadosLanzados = {};
      }
      await updateDoc(doc(db, 'casino_salas', salaId), update);
    });
  }
}

function renderEstadoDados(container, sala, salaId, yoJugador) {
  if (!yoJugador) { container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem">Partida en curso, espera.</p>'; return; }

  var dadosLanzados = sala.dadosLanzados || {};
  var yoLance = dadosLanzados[currentUser.uid] !== undefined;
  var capInfo = { 2: [10,50], 3: [15,75], 4: [20,100], 5: [25,125] };
  var rango = capInfo[sala.capacidad] || [10,50];

  container.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.5rem">🎲 Tira el dado</h3>' +
      '<p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:0.75rem">El que saque más alto decide cuántos espacios tendrá el arma (' + rango[0] + '-' + rango[1] + ')</p>' +
      '<div style="margin-bottom:0.75rem">' +
        sala.jugadores.map(function(j) {
          var d = dadosLanzados[j.uid];
          return '<div style="display:flex;justify-content:space-between;padding:0.35rem 0;font-size:0.85rem">' +
            '<span>' + j.username + '</span>' +
            '<span style="color:' + (d !== undefined ? 'var(--success)' : 'var(--text-secondary)') + '">' + (d !== undefined ? '🎲 ' + d : '⏳ Pendiente') + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      (!yoLance
        ? '<button class="btn btn-primary btn-full" id="btn-tirar-dado-sala">🎲 Tirar D20</button>'
        : '<p style="color:var(--success);text-align:center">✓ Sacaste ' + dadosLanzados[currentUser.uid] + '</p>'
      ) +
    '</div>';

  if (!yoLance) {
    document.getElementById('btn-tirar-dado-sala').addEventListener('click', async function() {
      var resultado = Math.floor(Math.random() * 20) + 1;
      var nuevosDados = Object.assign({}, dadosLanzados);
      nuevosDados[currentUser.uid] = resultado;
      var update = { dadosLanzados: nuevosDados };

      if (Object.keys(nuevosDados).length === sala.capacidad) {
        var maxValor = Math.max.apply(null, Object.values(nuevosDados));
        var ganadores = Object.keys(nuevosDados).filter(function(uid) { return nuevosDados[uid] === maxValor; });
        if (ganadores.length === 1) {
          update.estado = 'eligiendo_espacios';
          update.ganadorDado = ganadores[0];
        } else {
          var nuevoDados2 = {};
          ganadores.forEach(function(uid) { nuevoDados2[uid] = null; });
          update.dadosLanzados = nuevoDados2;
          update.desempate = true;
          update.desempateEntre = ganadores;
        }
      }
      await updateDoc(doc(db, 'casino_salas', salaId), update);
    });
  }

  var todosLanzaron = Object.keys(dadosLanzados).length === sala.capacidad;
  if (todosLanzaron && sala.desempate) {
    var enDesempate = sala.desempateEntre || [];
    var yoEnDesempate = enDesempate.includes(currentUser.uid);
    if (yoEnDesempate && dadosLanzados[currentUser.uid] === null) {
      container.innerHTML += '<div class="card" style="margin-top:0.5rem;border-color:var(--accent)"><p style="color:var(--accent);text-align:center;margin-bottom:0.5rem">¡Empate! Vuelves a tirar</p><button class="btn btn-primary btn-full" id="btn-desempate">🎲 Tirar de nuevo</button></div>';
      document.getElementById('btn-desempate').addEventListener('click', async function() {
        var r2 = Math.floor(Math.random() * 20) + 1;
        var nuevosDados3 = Object.assign({}, dadosLanzados);
        nuevosDados3[currentUser.uid] = r2;
        var update2 = { dadosLanzados: nuevosDados3 };
        var listos = enDesempate.filter(function(uid) { return nuevosDados3[uid] !== null && nuevosDados3[uid] !== undefined; });
        if (listos.length === enDesempate.length) {
          var maxV2 = Math.max.apply(null, enDesempate.map(function(uid) { return nuevosDados3[uid]; }));
          var gan2 = enDesempate.filter(function(uid) { return nuevosDados3[uid] === maxV2; });
          if (gan2.length === 1) {
            update2.estado = 'eligiendo_espacios';
            update2.ganadorDado = gan2[0];
            update2.desempate = false;
          } else {
            var nd3 = {};
            gan2.forEach(function(uid) { nd3[uid] = null; });
            update2.dadosLanzados = nd3;
            update2.desempateEntre = gan2;
          }
        }
        await updateDoc(doc(db, 'casino_salas', salaId), update2);
      });
    }
  }
}

function renderEstadoEligiendoEspacios(container, sala, salaId, yoJugador) {
  if (!yoJugador) { container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem">Partida en curso, espera.</p>'; return; }

  var ganador = sala.ganadorDado;
  var soyGanador = ganador === currentUser.uid;
  var ganadorData = sala.jugadores.find(function(j) { return j.uid === ganador; });
  var capInfo = { 2: [10,50], 3: [15,75], 4: [20,100], 5: [25,125] };
  var rango = capInfo[sala.capacidad] || [10,50];

  container.innerHTML =
    '<div class="card" style="margin-top:1rem">' +
      '<h3 style="margin-bottom:0.5rem">🔫 Configurar el arma</h3>' +
      (soyGanador
        ? '<p style="color:var(--success);margin-bottom:0.75rem;font-size:0.88rem">¡Ganaste el dado! Elige cuántos espacios tendrá el arma</p>' +
          '<p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:0.5rem">Mínimo ' + rango[0] + ' · Máximo ' + rango[1] + '</p>' +
          '<input type="number" id="input-espacios" placeholder="Número de espacios" min="' + rango[0] + '" max="' + rango[1] + '" style="width:100%;padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;margin-bottom:0.5rem" />' +
          '<button class="btn btn-primary btn-full" id="btn-confirmar-espacios">Confirmar</button>' +
          '<div id="espacios-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>'
        : '<p style="color:var(--text-secondary);font-size:0.88rem">' + (ganadorData ? ganadorData.username : 'Alguien') + ' está eligiendo los espacios del arma...</p>'
      ) +
    '</div>';

  if (soyGanador) {
    document.getElementById('btn-confirmar-espacios').addEventListener('click', async function() {
      var espacios = parseInt(document.getElementById('input-espacios').value);
      var msg = document.getElementById('espacios-msg');
      if (!espacios || espacios < rango[0] || espacios > rango[1]) {
        msg.textContent = 'Ingresa entre ' + rango[0] + ' y ' + rango[1]; msg.style.color = 'var(--danger)'; return;
      }
      var balaPos = Math.floor(Math.random() * espacios) + 1;
      var ordenAleatorio = sala.jugadores.map(function(j) { return j.uid; }).sort(function() { return Math.random() - 0.5; });
      var jugadoresReset = sala.jugadores.map(function(j) { return Object.assign({}, j, { apretadas: 0, eliminado: false }); });

      await updateDoc(doc(db, 'casino_salas', salaId), {
        estado: 'jugando',
        espaciosTotales: espacios,
        balaEnPosicion: balaPos,
        disparoActual: 0,
        turnoActual: 0,
        ordenTurnos: ordenAleatorio,
        jugadores: jugadoresReset,
        apretadasEsteTurno: 0,
        turnoTimer: new Date().toISOString()
      });
    });
  }
}

function renderEstadoJugando(container, sala, salaId, yoJugador) {
  var orden = sala.ordenTurnos || [];
  var turnoIdx = sala.turnoActual || 0;
  var uidEnTurno = orden[turnoIdx % orden.length];
  var esMiTurno = uidEnTurno === currentUser.uid;
  var jugadorEnTurno = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === uidEnTurno; });
  var disparoActual = sala.disparoActual || 0;
  var balaPos = sala.balaEnPosicion;
  var totalEspacios = sala.espaciosTotales;
  var probabilidad = ((1 / (totalEspacios - disparoActual)) * 100).toFixed(1);

  var apuestasTotal = 0;
  var apuestas = sala.apuestas || {};
  Object.values(apuestas).forEach(function(a) { apuestasTotal += a; });

  container.innerHTML =
    '<div class="card" style="margin-top:1rem;border-color:var(--accent)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">' +
        '<h3>🔫 Ruleta Rusa</h3>' +
        '<span style="color:var(--danger);font-weight:700;font-size:0.9rem">💷 £' + apuestasTotal.toLocaleString('es-CO') + ' en juego</span>' +
      '</div>' +
      '<div style="text-align:center;padding:1rem 0;background:var(--bg-primary);border-radius:12px;margin-bottom:0.75rem">' +
        '<p style="font-size:3rem;margin-bottom:0.3rem">🔫</p>' +
        '<p style="font-size:0.82rem;color:var(--text-secondary)">Disparo ' + (disparoActual + 1) + ' de ' + totalEspacios + '</p>' +
        '<p style="font-size:0.78rem;color:var(--danger)">Probabilidad de bala: ' + probabilidad + '%</p>' +
      '</div>' +
      '<div style="margin-bottom:0.75rem">' +
        sala.jugadores.filter(function(j) { return !j.eliminado; }).map(function(j) {
          var esTurnoEste = j.uid === uidEnTurno;
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.6rem;border-radius:8px;margin-bottom:0.3rem;background:' + (esTurnoEste ? 'rgba(233,69,96,0.15)' : 'var(--bg-primary)') + ';border:1px solid ' + (esTurnoEste ? 'var(--accent)' : 'transparent') + '">' +
            '<span style="font-size:0.88rem">' + (esTurnoEste ? '▶️ ' : '') + j.username + '</span>' +
            '<span style="font-size:0.78rem;color:var(--text-secondary)">🎯 ' + j.apretadas + ' apretadas</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      (esMiTurno
        ? '<div style="text-align:center;padding:1rem;background:rgba(233,69,96,0.1);border-radius:12px;border:2px solid var(--accent)">' +
            '<p style="color:var(--accent);font-weight:700;margin-bottom:0.75rem">¡ES TU TURNO! Tienes 15 segundos</p>' +
            '<div id="timer-ruleta" style="font-size:2rem;font-weight:900;color:var(--accent);margin-bottom:0.75rem">15</div>' +
            '<button class="btn btn-primary btn-full" id="btn-apretar-gatillo" style="font-size:1.1rem;padding:1rem;background:var(--danger)">🔫 Apretar gatillo</button>' +
            '<button class="btn btn-secondary btn-full" id="btn-pasar-turno" style="margin-top:0.5rem">Pasar turno (solo si ya apretaste)</button>' +
          '</div>'
        : '<p style="color:var(--text-secondary);text-align:center;font-size:0.9rem">Turno de <strong>' + (jugadorEnTurno ? jugadorEnTurno.username : '...') + '</strong></p>'
      ) +
    '</div>';

  if (esMiTurno) {
    var tiempoRestante = 15;
    var apretadasEsteTurno = sala.apretadasEsteTurno || 0;
    var timerEl = document.getElementById('timer-ruleta');
    var timerInterval = setInterval(function() {
      tiempoRestante--;
      if (timerEl) timerEl.textContent = tiempoRestante;
      if (tiempoRestante <= 0) {
        clearInterval(timerInterval);
        if (apretadasEsteTurno === 0) {
          apretarGatillo(salaId, sala, true);
        } else {
          pasarTurno(salaId, sala);
        }
      }
    }, 1000);

    document.getElementById('btn-apretar-gatillo').addEventListener('click', function() {
      clearInterval(timerInterval);
      apretarGatillo(salaId, sala, false);
    });

    document.getElementById('btn-pasar-turno').addEventListener('click', function() {
      if ((sala.apretadasEsteTurno || 0) === 0) {
        alert('Debes apretar al menos una vez');
        return;
      }
      clearInterval(timerInterval);
      pasarTurno(salaId, sala);
    });
  }
}

async function apretarGatillo(salaId, sala, forzado) {
  var nuevoDisparo = (sala.disparoActual || 0) + 1;
  var balaPos = sala.balaEnPosicion;
  var ordenTurnos = sala.ordenTurnos || [];
  var turnoIdx = sala.turnoActual || 0;
  var uidEnTurno = ordenTurnos[turnoIdx % ordenTurnos.length];

  var jugadoresActualizados = sala.jugadores.map(function(j) {
    if (j.uid === uidEnTurno) {
      return Object.assign({}, j, { apretadas: (j.apretadas || 0) + 1 });
    }
    return j;
  });

  if (nuevoDisparo === balaPos) {
    var perdedor = jugadoresActualizados.find(function(j) { return j.uid === uidEnTurno; });
    jugadoresActualizados = jugadoresActualizados.map(function(j) {
      if (j.uid === uidEnTurno) return Object.assign({}, j, { eliminado: true });
      return j;
    });

    var ganadores = jugadoresActualizados.filter(function(j) { return !j.eliminado; });

    if (ganadores.length <= 1 || sala.capacidad === 2) {
      await updateDoc(doc(db, 'casino_salas', salaId), {
        jugadores: jugadoresActualizados,
        disparoActual: nuevoDisparo,
        estado: 'terminado',
        perdedor: uidEnTurno,
        ganadores: ganadores.map(function(g) { return g.uid; }),
        apretadasEsteTurno: 0
      });
      await resolverPremios(salaId, sala, perdedor, ganadores, jugadoresActualizados);
    } else {
      var nuevaOrden = ordenTurnos.filter(function(uid) { return uid !== uidEnTurno; });
      await updateDoc(doc(db, 'casino_salas', salaId), {
        jugadores: jugadoresActualizados,
        disparoActual: nuevoDisparo,
        ordenTurnos: nuevaOrden,
        turnoActual: turnoIdx % nuevaOrden.length,
        apretadasEsteTurno: 0
      });
      await resolverPremios(salaId, sala, perdedor, ganadores, jugadoresActualizados);
      if (ganadores.length === 1) {
        await updateDoc(doc(db, 'casino_salas', salaId), { estado: 'terminado', ganadores: ganadores.map(function(g) { return g.uid; }) });
      }
    }
  } else {
    await updateDoc(doc(db, 'casino_salas', salaId), {
      jugadores: jugadoresActualizados,
      disparoActual: nuevoDisparo,
      apretadasEsteTurno: (sala.apretadasEsteTurno || 0) + 1
    });
  }
}

async function pasarTurno(salaId, sala) {
  var ordenTurnos = sala.ordenTurnos || [];
  var turnoIdx = sala.turnoActual || 0;
  var nuevoTurno = (turnoIdx + 1) % ordenTurnos.length;
  await updateDoc(doc(db, 'casino_salas', salaId), {
    turnoActual: nuevoTurno,
    apretadasEsteTurno: 0,
    turnoTimer: new Date().toISOString()
  });
}

async function resolverPremios(salaId, sala, perdedor, ganadores, jugadoresActualizados) {
  var apuestas = sala.apuestas || {};
  var montoPerdedor = apuestas[perdedor.uid] || 0;

  await updateDoc(doc(db, 'usuarios', perdedor.uid), { saldo: increment(-montoPerdedor) });
  await registrarTransaccion({
    tipo: 'casino_ruleta',
    de: perdedor.uid, deUsername: perdedor.username,
    para: 'sistema', paraUsername: 'Casino Estiria',
    monto: montoPerdedor,
    descripcion: 'Ruleta Rusa - Perdió la partida'
  });

  if (sala.capacidad === 2 || ganadores.length === 1) {
    var ganador = ganadores[0];
    await updateDoc(doc(db, 'usuarios', ganador.uid), { saldo: increment(montoPerdedor) });
    await registrarTransaccion({
      tipo: 'casino_ruleta',
      de: 'sistema', deUsername: 'Casino Estiria',
      para: ganador.uid, paraUsername: ganador.username,
      monto: montoPerdedor,
      descripcion: 'Ruleta Rusa - Ganó la partida'
    });
  } else {
    var totalApretadas = ganadores.reduce(function(s, g) { return s + (g.apretadas || 0); }, 0);
    if (totalApretadas === 0) totalApretadas = 1;
    for (var i = 0; i < ganadores.length; i++) {
      var g = ganadores[i];
      var porcentaje = (g.apretadas || 0) / totalApretadas;
      var premio = Math.floor(montoPerdedor * porcentaje);
      if (premio > 0) {
        await updateDoc(doc(db, 'usuarios', g.uid), { saldo: increment(premio) });
        await registrarTransaccion({
          tipo: 'casino_ruleta',
          de: 'sistema', deUsername: 'Casino Estiria',
          para: g.uid, paraUsername: g.username,
          monto: premio,
          descripcion: 'Ruleta Rusa - Premio (' + Math.round(porcentaje * 100) + '% por ' + (g.apretadas || 0) + ' apretadas)'
        });
      }
    }
  }
}

function renderEstadoTerminado(container, sala, salaId, yoJugador) {
  var perdedorUid = sala.perdedor;
  var perdedorData = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === perdedorUid; });
  var ganadoresUids = sala.ganadores || [];
  var ganadoresData = sala.jugadores ? sala.jugadores.filter(function(j) { return ganadoresUids.includes(j.uid); }) : [];
  var apuestas = sala.apuestas || {};
  var montoPerdedor = apuestas[perdedorUid] || 0;

  container.innerHTML =
    '<div class="card" style="margin-top:1rem;text-align:center">' +
      '<p style="font-size:3rem">💥</p>' +
      '<h3 style="margin-bottom:0.5rem">Partida terminada</h3>' +
      '<p style="color:var(--danger);font-size:1rem;margin-bottom:0.5rem">💀 ' + (perdedorData ? perdedorData.username : 'Alguien') + ' recibió el disparo</p>' +
      '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1rem">Perdió £' + montoPerdedor.toLocaleString('es-CO') + '</p>' +
      '<p style="color:var(--success);font-weight:700;margin-bottom:0.5rem">🏆 Ganadores:</p>' +
      ganadoresData.map(function(g) {
        var totalApretadas = ganadoresData.reduce(function(s, x) { return s + (x.apretadas || 0); }, 0) || 1;
        var pct = Math.round(((g.apretadas || 0) / totalApretadas) * 100);
        var premio = sala.capacidad === 2 ? montoPerdedor : Math.floor(montoPerdedor * (g.apretadas || 0) / totalApretadas);
        return '<p style="font-size:0.9rem;margin-bottom:0.3rem">' + g.username + ' — £' + premio.toLocaleString('es-CO') + (sala.capacidad > 2 ? ' (' + pct + '%)' : '') + '</p>';
      }).join('') +
      '<button class="btn btn-primary btn-full" id="btn-salir-terminado" style="margin-top:1rem">Salir</button>' +
    '</div>';

  document.getElementById('btn-salir-terminado').addEventListener('click', async function() {
    var nuevosJugadores = (sala.jugadores || []).filter(function(j) { return j.uid !== currentUser.uid; });
    var update = { jugadores: nuevosJugadores };
    if (nuevosJugadores.length === 0) {
      update.estado = 'esperando';
      update.apuestas = {};
      update.dadosLanzados = {};
      update.disparoActual = 0;
      update.balaEnPosicion = null;
      update.ordenTurnos = [];
      update.turnoActual = 0;
      update.ganadores = [];
      update.perdedor = null;
    }
    await updateDoc(doc(db, 'casino_salas', salaId), update);
    if (salaListener) { salaListener(); salaListener = null; }
    salaActualId = null;
    renderRuletaRusa();
  });
}

// ===== TRAGAPERRAS =====

function renderTragaperras() {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-casino-tragaperras">← Casino</button>' +
      '<h3>🎰 Máquina Tragaperras</h3>' +
    '</div>' +

    '<div class="card" style="text-align:center;border-color:var(--accent)">' +
      '<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.75rem">Saldo: £<span id="tragaperras-saldo">' + (currentUser.saldo || 0).toLocaleString('es-CO') + '</span></p>' +

      // Pantalla de carretes
      '<div id="tragaperras-pantalla" style="display:flex;justify-content:center;gap:0.5rem;margin-bottom:1rem">' +
        '<div class="carrete-box" id="carrete-0">🎰</div>' +
        '<div class="carrete-box" id="carrete-1">🎰</div>' +
        '<div class="carrete-box" id="carrete-2">🎰</div>' +
      '</div>' +

      // Resultado
      '<div id="tragaperras-resultado" style="min-height:2rem;margin-bottom:0.75rem"></div>' +

      // Apuesta
      '<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.4rem">Tu apuesta</p>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:0.75rem;margin-bottom:0.75rem">' +
        '<button class="btn-cantidad" id="tp-minus" style="width:36px;height:36px">−</button>' +
        '<span id="tp-apuesta-val" style="font-size:1.2rem;font-weight:700;color:var(--accent);min-width:80px;text-align:center">£100</span>' +
        '<button class="btn-cantidad" id="tp-plus" style="width:36px;height:36px">+</button>' +
      '</div>' +
      '<div style="display:flex;gap:0.4rem;justify-content:center;margin-bottom:0.75rem">' +
        '<button class="btn-apuesta-rapida" data-val="100">£100</button>' +
        '<button class="btn-apuesta-rapida" data-val="250">£250</button>' +
        '<button class="btn-apuesta-rapida" data-val="500">£500</button>' +
        '<button class="btn-apuesta-rapida" data-val="1000">£1k</button>' +
      '</div>' +
      '<button class="btn btn-primary btn-full" id="btn-girar" style="font-size:1.1rem;padding:1rem;letter-spacing:1px">🎰 GIRAR</button>' +
    '</div>' +

    // Tabla de premios
    '<div class="card" style="margin-top:0.5rem">' +
      '<p class="edit-section-title" style="margin-bottom:0.75rem">📋 Tabla de premios</p>' +
      '<div style="display:flex;flex-direction:column;gap:0.3rem">' +
        [
          ['💎💎💎', 'JACKPOT', '×500', 'gold'],
          ['7️⃣7️⃣7️⃣', 'Siete loco', '×100', '#ff9800'],
          ['⭐⭐⭐', 'Estrella triple', '×25', '#4fc3f7'],
          ['🔔🔔🔔', 'Campanas', '×10', '#81c784'],
          ['🍇🍇🍇', 'Uvas', '×5', '#ce93d8'],
          ['🍋🍋🍋', 'Limones', '×2', '#fff176'],
          ['❓❓—', '2 iguales', '×1.5', 'var(--text-secondary)']
        ].map(function(r) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.35rem 0.5rem;border-radius:8px;background:var(--bg-primary)">' +
            '<span style="font-size:1rem">' + r[0] + '</span>' +
            '<span style="font-size:0.78rem;color:var(--text-secondary)">' + r[1] + '</span>' +
            '<span style="font-size:0.85rem;font-weight:700;color:' + r[3] + '">' + r[2] + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';

  document.getElementById('back-casino-tragaperras').addEventListener('click', function() {
    panel.innerHTML = '';
    renderCasino();
  });

  // Estado de la máquina
  var apuesta = 100;
  girando = false;

  var pasos = [100, 250, 500, 1000, 2500];

  function actualizarApuesta() {
    document.getElementById('tp-apuesta-val').textContent = '£' + apuesta.toLocaleString('es-CO');
  }

  document.getElementById('tp-minus').addEventListener('click', function() {
    var idx = pasos.indexOf(apuesta);
    if (idx > 0) { apuesta = pasos[idx - 1]; actualizarApuesta(); }
  });

  document.getElementById('tp-plus').addEventListener('click', function() {
    var idx = pasos.indexOf(apuesta);
    if (idx < pasos.length - 1) { apuesta = pasos[idx + 1]; actualizarApuesta(); }
  });

  document.querySelectorAll('.btn-apuesta-rapida').forEach(function(btn) {
    btn.addEventListener('click', function() {
      apuesta = parseInt(btn.dataset.val);
      actualizarApuesta();
    });
  });

  document.getElementById('btn-girar').addEventListener('click', async function() {
    if (girando) return;

    // Validaciones
    var saldoActual = currentUser.saldo || 0;
    var resultadoEl = document.getElementById('tragaperras-resultado');

    if (apuesta > saldoActual) {
      resultadoEl.innerHTML = '<p style="color:var(--danger);font-size:0.9rem">Saldo insuficiente</p>';
      return;
    }
    if (apuesta < 100) {
      resultadoEl.innerHTML = '<p style="color:var(--danger);font-size:0.9rem">Apuesta mínima: £100</p>';
      return;
    }

    girando = true;
    var btnGirar = document.getElementById('btn-girar');
    btnGirar.disabled = true;
    btnGirar.textContent = '⏳ Girando...';
    resultadoEl.innerHTML = '';

    // Descontar apuesta inmediatamente
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { saldo: increment(-apuesta) });
    currentUser.saldo = saldoActual - apuesta;
    document.getElementById('tragaperras-saldo').textContent = currentUser.saldo.toLocaleString('es-CO');

    // Calcular resultado REAL (antes de la animación)
    var simbolos = ['🍋', '🍇', '🔔', '⭐', '7️⃣', '💎'];

    // Pesos de probabilidad (mayor = más común)
    // Total de pesos = 100
    // 🍋=36, 🍇=27, 🔔=16, ⭐=10, 7️⃣=7, 💎=4
    var pesos = [36, 27, 16, 10, 7, 4];
    var totalPeso = pesos.reduce(function(a, b) { return a + b; }, 0);

    function elegirSimbolo() {
      var rand = Math.random() * totalPeso;
      var acum = 0;
      for (var i = 0; i < simbolos.length; i++) {
        acum += pesos[i];
        if (rand < acum) return simbolos[i];
      }
      return simbolos[0];
    }

    // El casino tiene ventaja: 65% de probabilidad de que NO haya premio
    // Para lograr esto, re-evaluamos si "forzar" pérdida
    var forzarPerdida = Math.random() < 0.25;
    var resultado;

    if (forzarPerdida) {
      // Generar 3 símbolos que NO formen combinación ganadora
      var intentos = 0;
      do {
        resultado = [elegirSimbolo(), elegirSimbolo(), elegirSimbolo()];
        intentos++;
      } while (
        intentos < 50 &&
        (resultado[0] === resultado[1] || resultado[1] === resultado[2] || resultado[0] === resultado[2])
      );
    } else {
      resultado = [elegirSimbolo(), elegirSimbolo(), elegirSimbolo()];
    }

    // Calcular premio
    var multiplicador = calcularMultiplicador(resultado);
    var ganancia = multiplicador > 0 ? Math.floor(apuesta * multiplicador) : 0;

    // Animación de carretes
    var frames = ['🍋', '🍇', '🔔', '⭐', '7️⃣', '💎'];
    var duracion = 1800;
    var intervalos = [null, null, null];
    var detenidos = [false, false, false];
    var tiemposStop = [duracion * 0.5, duracion * 0.75, duracion];

    for (var c = 0; c < 3; c++) {
      (function(idx) {
        intervalos[idx] = setInterval(function() {
          if (!detenidos[idx]) {
            var r = frames[Math.floor(Math.random() * frames.length)];
            document.getElementById('carrete-' + idx).textContent = r;
          }
        }, 80);

        setTimeout(function() {
          detenidos[idx] = true;
          clearInterval(intervalos[idx]);
          document.getElementById('carrete-' + idx).textContent = resultado[idx];

          // Último carrete: mostrar resultado
          if (idx === 2) {
            setTimeout(function() {
              mostrarResultadoTragaperras(resultado, multiplicador, ganancia, apuesta).then(function() {
                girando = false;
                var btn = document.getElementById('btn-girar');
                if (btn) {
                  btn.disabled = false;
                  btn.textContent = '🎰 GIRAR';
                }
              });
            }, 300);
          }
        }, tiemposStop[idx]);
      })(c);
    }
  });
}

function calcularMultiplicador(resultado) {
  var a = resultado[0], b = resultado[1], c = resultado[2];

  // Triple
  if (a === b && b === c) {
    if (a === '💎') return 500;
    if (a === '7️⃣') return 100;
    if (a === '⭐') return 25;
    if (a === '🔔') return 10;
    if (a === '🍇') return 5;
    if (a === '🍋') return 2;
  }

  // Dos iguales (cualquier par) → x1.5
  if (a === b || b === c || a === c) {
    return 1.5;
  }

  return 0; // Sin premio
}

async function mostrarResultadoTragaperras(resultado, multiplicador, ganancia, apuesta) {
  var resultadoEl = document.getElementById('tragaperras-resultado');

  if (ganancia > 0) {
    try {
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { saldo: increment(ganancia) });
      currentUser.saldo = (currentUser.saldo || 0) + ganancia;
      document.getElementById('tragaperras-saldo').textContent = currentUser.saldo.toLocaleString('es-CO');

      await registrarTransaccion({
        tipo: 'casino_tragaperras',
        de: 'sistema',
        deUsername: 'Casino Tragaperras',
        para: currentUser.uid,
        paraUsername: currentUser.username,
        monto: ganancia - apuesta,
        descripcion: 'Tragaperras: ' + resultado.join('') + ' — Ganó £' + ganancia.toLocaleString('es-CO') + ' (apuesta £' + apuesta.toLocaleString('es-CO') + ')'
      });
    } catch(err) {
      console.log('Error al acreditar:', err.message);
    }

    var esJackpot = multiplicador === 500;
    var esGranPremio = multiplicador >= 25;

    resultadoEl.innerHTML =
      '<div style="padding:0.75rem;border-radius:12px;background:' + (esJackpot ? 'rgba(255,215,0,0.15)' : 'rgba(76,175,80,0.12)') + ';border:2px solid ' + (esJackpot ? 'gold' : 'var(--success)') + '">' +
        (esJackpot ? '<p style="font-size:1.5rem;margin-bottom:0.3rem">🎊 JACKPOT 🎊</p>' : esGranPremio ? '<p style="font-size:1.2rem;margin-bottom:0.3rem">🎉 ¡GRAN PREMIO!</p>' : '') +
        '<p style="color:var(--success);font-size:1rem;font-weight:700">+£' + ganancia.toLocaleString('es-CO') + '</p>' +
        '<p style="color:var(--text-secondary);font-size:0.75rem">×' + multiplicador + ' tu apuesta</p>' +
      '</div>';
  } else {
    try {
      await registrarTransaccion({
        tipo: 'casino_tragaperras',
        de: currentUser.uid,
        deUsername: currentUser.username,
        para: 'sistema',
        paraUsername: 'Casino Tragaperras',
        monto: apuesta,
        descripcion: 'Tragaperras: ' + resultado.join('') + ' — Sin premio'
      });
    } catch(err) {
      console.log('Error al registrar pérdida:', err.message);
    }

    resultadoEl.innerHTML =
      '<p style="color:var(--text-secondary);font-size:0.88rem">Sin suerte esta vez 😔</p>';
  }

  console.log('Llegué al final de mostrarResultadoTragaperras');
  girando = false;
  var btn = document.getElementById('btn-girar');
  console.log('btn-girar encontrado:', btn);
  if (btn) {
    btn.disabled = false;
    btn.textContent = '🎰 GIRAR';
    console.log('Botón rehabilitado');
  }
}

// ===== RULETA =====

var ruletaListener = null;
var ruletaSalaActualId = null;
var ruletaTimerInterval = null;

var NUMEROS_RULETA = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,
  24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];

var COLORES_RULETA = {
  0:'verde',1:'rojo',2:'negro',3:'rojo',4:'negro',5:'rojo',6:'negro',
  7:'rojo',8:'negro',9:'rojo',10:'negro',11:'negro',12:'rojo',13:'negro',
  14:'rojo',15:'negro',16:'rojo',17:'negro',18:'rojo',19:'rojo',20:'negro',
  21:'rojo',22:'negro',23:'rojo',24:'negro',25:'rojo',26:'negro',27:'rojo',
  28:'negro',29:'negro',30:'rojo',31:'negro',32:'rojo',33:'negro',34:'rojo',
  35:'negro',36:'rojo'
};

async function renderRuleta() {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-casino-ruleta">← Casino</button>' +
      '<h3>🎡 Ruleta de Estiria</h3>' +
    '</div>' +
    '<div class="salas-tabs" style="margin-bottom:0.75rem">' +
      '<button class="sala-tab active" data-tipo="normal">🎡 Normales</button>' +
      '<button class="sala-tab" data-tipo="vip">👑 VIP</button>' +
    '</div>' +
    '<div id="ruleta-salas-lista"></div>';

  document.getElementById('back-casino-ruleta').addEventListener('click', function() {
    if (ruletaListener) { ruletaListener(); ruletaListener = null; }
    if (ruletaTimerInterval) { clearInterval(ruletaTimerInterval); ruletaTimerInterval = null; }
    panel.innerHTML = '';
    renderCasino();
  });

  document.querySelectorAll('.sala-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.sala-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      cargarSalasRuleta(tab.dataset.tipo);
    });
  });

  await inicializarSalasRuleta();
  cargarSalasRuleta('normal');
}

async function inicializarSalasRuleta() {
  for (var i = 1; i <= 10; i++) {
    var id = 'ruleta_normal_' + i;
    var snap = await getDoc(doc(db, 'ruleta_salas', id));
    if (!snap.exists()) {
      await setDoc(doc(db, 'ruleta_salas', id), {
        id: id, tipo: 'normal', nombre: 'Sala ' + i,
        capacidad: 7, apuestaMin: 100, apuestaMax: null,
        estado: 'esperando', jugadores: [], espectadores: [],
        apuestas: {}, ultimoNumero: null, createdAt: new Date().toISOString()
      });
    }
  }
  for (var j = 1; j <= 2; j++) {
    var idVip = 'ruleta_vip_' + j;
    var snapVip = await getDoc(doc(db, 'ruleta_salas', idVip));
    if (!snapVip.exists()) {
      await setDoc(doc(db, 'ruleta_salas', idVip), {
        id: idVip, tipo: 'vip', nombre: 'Sala VIP ' + j,
        capacidad: 5, apuestaMin: 1000, apuestaMax: null,
        requiereSaldo: 100000, saldoMinimo: 50000,
        estado: 'esperando', jugadores: [], espectadores: [],
        apuestas: {}, ultimoNumero: null, createdAt: new Date().toISOString()
      });
    }
  }
}

function cargarSalasRuleta(tipo) {
  var lista = document.getElementById('ruleta-salas-lista');
  if (!lista) return;
  lista.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p>';

  onSnapshot(
    query(collection(db, 'ruleta_salas'), where('tipo', '==', tipo)),
    function(snap) {
      lista = document.getElementById('ruleta-salas-lista');
      if (!lista) return;
      var salas = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      salas.sort(function(a, b) {
  var numA = parseInt(a.id.replace(/\D/g, ''));
  var numB = parseInt(b.id.replace(/\D/g, ''));
  return numA - numB;
});

      lista.innerHTML = salas.map(function(sala) {
        var jugadores = sala.jugadores ? sala.jugadores.length : 0;
        var espectadores = sala.espectadores ? sala.espectadores.length : 0;
        var estado = sala.estado || 'esperando';
        var estadoColor = estado === 'girando' ? 'var(--danger)' : jugadores > 0 ? 'var(--warning)' : 'var(--success)';
        var estadoTexto = estado === 'girando' ? '🔴 Girando' : jugadores > 0 ? '🟡 Jugando (' + jugadores + '/' + sala.capacidad + ')' : '🟢 Vacía';
        var esVip = sala.tipo === 'vip';

        return '<div class="sala-card" style="' + (esVip ? 'border-color:gold' : '') + '">' +
          '<div class="sala-info">' +
            '<p class="sala-nombre">' + (esVip ? '👑 ' : '') + sala.nombre + '</p>' +
            '<p class="sala-estado" style="color:' + estadoColor + '">' + estadoTexto + '</p>' +
            (esVip ? '<p style="font-size:0.72rem;color:gold">Requiere £100.000 · Mín. £1.000</p>' : '<p style="font-size:0.72rem;color:var(--text-secondary)">Mín. £100 · Máx. £5.000</p>') +
            (espectadores > 0 ? '<p style="font-size:0.72rem;color:var(--text-secondary)">👁️ ' + espectadores + ' espectadores</p>' : '') +
          '</div>' +
          '<button class="btn btn-primary sala-btn" data-id="' + sala.id + '">Entrar</button>' +
        '</div>';
      }).join('');

      lista.querySelectorAll('.sala-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          mostrarModalEntradaRuleta(btn.dataset.id);
        });
      });
    }
  );
}

async function mostrarModalEntradaRuleta(salaId) {
  var snap = await getDoc(doc(db, 'ruleta_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();
  var saldo = currentUser.saldo || 0;
  var esVip = sala.tipo === 'vip';

  if (esVip && saldo < 100000) {
    alert('Necesitas al menos £100.000 para entrar a una sala VIP');
    return;
  }

  var panel = document.getElementById('casino-panel');
  var modalHtml =
    '<div id="modal-ruleta-entrada" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center">' +
      '<div style="background:var(--bg-secondary);border-radius:16px;padding:1.5rem;width:90%;max-width:340px;border:1px solid var(--bg-card)">' +
        '<h3 style="margin-bottom:0.5rem">' + (esVip ? '👑 ' : '') + sala.nombre + '</h3>' +
        '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1.25rem">¿Cómo quieres entrar?</p>' +
        '<button class="btn btn-primary btn-full" id="btn-entrar-jugador" style="margin-bottom:0.5rem">🎮 Entrar como jugador</button>' +
        '<button class="btn btn-secondary btn-full" id="btn-entrar-espectador">👁️ Entrar como espectador</button>' +
        '<button class="btn btn-secondary btn-full" id="btn-cancelar-entrada" style="margin-top:0.5rem;border-color:var(--danger);color:var(--danger)">Cancelar</button>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('btn-cancelar-entrada').addEventListener('click', function() {
    document.getElementById('modal-ruleta-entrada').remove();
  });

  document.getElementById('btn-entrar-espectador').addEventListener('click', function() {
    document.getElementById('modal-ruleta-entrada').remove();
    entrarSalaRuleta(salaId, 'espectador');
  });

  document.getElementById('btn-entrar-jugador').addEventListener('click', function() {
    document.getElementById('modal-ruleta-entrada').remove();
    if (saldo < 100) {
      alert('No tienes suficiente saldo para jugar. Entrarás como espectador.');
      entrarSalaRuleta(salaId, 'espectador');
      return;
    }
    entrarSalaRuleta(salaId, 'jugador');
  });
}

async function entrarSalaRuleta(salaId, modo) {
  var snap = await getDoc(doc(db, 'ruleta_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();

  if (modo === 'jugador') {
    var yaEsta = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });
    if (!yaEsta && (!sala.jugadores || sala.jugadores.length < sala.capacidad)) {
      var nuevosJugadores = (sala.jugadores || []).concat([{
        uid: currentUser.uid,
        username: currentUser.username,
        foto: currentUser.fotoPerfil || '',
        ganado: 0, perdido: 0, neto: 0
      }]);
      await updateDoc(doc(db, 'ruleta_salas', salaId), { jugadores: nuevosJugadores });
    }
  } else {
    var yaEstaEsp = sala.espectadores && sala.espectadores.find(function(e) { return e.uid === currentUser.uid; });
    if (!yaEstaEsp) {
      var nuevosEsp = (sala.espectadores || []).concat([{ uid: currentUser.uid, username: currentUser.username }]);
      await updateDoc(doc(db, 'ruleta_salas', salaId), { espectadores: nuevosEsp });
    }
  }

  ruletaSalaActualId = salaId;
  renderSalaRuleta(salaId, modo);
}

function renderSalaRuleta(salaId, modoInicial) {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML = '<div id="ruleta-sala-container"></div>';

  if (ruletaListener) { ruletaListener(); ruletaListener = null; }

  ruletaListener = onSnapshot(doc(db, 'ruleta_salas', salaId), function(snap) {
    if (!snap.exists()) return;
    var sala = snap.data();
    var container = document.getElementById('ruleta-sala-container');
    if (!container) return;

    var yoJugador = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });
    var yoEspectador = sala.espectadores && sala.espectadores.find(function(e) { return e.uid === currentUser.uid; });
    var miModo = yoJugador ? 'jugador' : 'espectador';

    var saldo = currentUser.saldo || 0;
    var esVip = sala.tipo === 'vip';

    // Verificar expulsión VIP
    if (esVip && yoJugador && saldo <= 50000) {
      salirSalaRuleta(salaId, miModo, sala);
      alert('Tu saldo bajó a £' + saldo.toLocaleString('es-CO') + '. Necesitas £100.000 para estar en sala VIP.');
      return;
    }

    // Verificar si quedó sin saldo mínimo
    if (yoJugador && saldo < 100) {
      convertirAEspectador(salaId, sala);
      return;
    }

    container.innerHTML =
      // Header
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">' +
        '<button class="btn-back" id="btn-salir-ruleta">← Salir</button>' +
        '<h3 style="font-size:0.95rem">' + (esVip ? '👑 ' : '🎡 ') + sala.nombre + '</h3>' +
        '<span style="font-size:0.8rem;color:var(--text-secondary)">£' + saldo.toLocaleString('es-CO') + '</span>' +
      '</div>' +

      // Layout principal
      '<div style="display:grid;grid-template-columns:1fr;gap:0.75rem">' +

        // Ranking + Apuestas actuales
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' +
          // Ranking
          '<div style="background:var(--bg-card);border-radius:12px;padding:0.6rem">' +
            '<p style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:0.4rem;font-weight:700">👥 JUGADORES</p>' +
            (sala.jugadores && sala.jugadores.length > 0
              ? sala.jugadores.map(function(j) {
                  return '<div style="font-size:0.7rem;padding:0.2rem 0;border-bottom:1px solid var(--bg-secondary)">' +
                    '<p style="color:var(--text-primary);font-weight:600">' + j.username + '</p>' +
                    '<p style="color:var(--success)">+£' + (j.ganado || 0).toLocaleString('es-CO') + '</p>' +
                    '<p style="color:var(--danger)">-£' + (j.perdido || 0).toLocaleString('es-CO') + '</p>' +
                    '<p style="color:' + ((j.neto || 0) >= 0 ? 'var(--success)' : 'var(--danger)') + ';font-weight:700">Neto: £' + (j.neto || 0).toLocaleString('es-CO') + '</p>' +
                  '</div>';
                }).join('')
              : '<p style="font-size:0.72rem;color:var(--text-secondary)">Sin jugadores</p>'
            ) +
          '</div>' +

          // Apuestas actuales
          '<div style="background:var(--bg-card);border-radius:12px;padding:0.6rem;max-height:160px;overflow-y:auto">' +
            '<p style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:0.4rem;font-weight:700">🎯 APUESTAS</p>' +
            (sala.apuestas && Object.keys(sala.apuestas).length > 0
              ? Object.values(sala.apuestas).map(function(ap) {
                  return '<div style="font-size:0.68rem;padding:0.2rem 0;border-bottom:1px solid var(--bg-secondary)">' +
                    '<p style="color:var(--text-primary);font-weight:600">' + ap.username + '</p>' +
                    '<p style="color:var(--accent)">£' + ap.monto.toLocaleString('es-CO') + ' — ' + ap.descripcion + '</p>' +
                  '</div>';
                }).join('')
              : '<p style="font-size:0.72rem;color:var(--text-secondary)">Sin apuestas aún</p>'
            ) +
          '</div>' +
        '</div>' +

        // Ruleta visual
        '<div style="display:flex;flex-direction:column;align-items:center">' +
          renderRuletaVisual(sala.ultimoNumero, sala.estado === 'girando') +
          (sala.ultimoNumero !== null
            ? '<div style="margin-top:0.5rem;text-align:center">' +
                '<span style="font-size:1.5rem;font-weight:900;color:' + (COLORES_RULETA[sala.ultimoNumero] === 'rojo' ? '#e74c3c' : COLORES_RULETA[sala.ultimoNumero] === 'negro' ? 'var(--text-primary)' : '#2ecc71') + '">' + sala.ultimoNumero + '</span>' +
                '<span style="font-size:0.8rem;color:var(--text-secondary);margin-left:0.5rem">' + (COLORES_RULETA[sala.ultimoNumero] === 'rojo' ? '🔴 Rojo' : COLORES_RULETA[sala.ultimoNumero] === 'negro' ? '⚫ Negro' : '🟢 Cero') + ' · ' + (sala.ultimoNumero === 0 ? '—' : sala.ultimoNumero % 2 === 0 ? 'Par' : 'Impar') + ' · ' + (sala.ultimoNumero === 0 ? '—' : sala.ultimoNumero <= 18 ? '1-18' : '19-36') + '</span>' +
              '</div>'
            : ''
          ) +
        '</div>' +

        // Timer
        (sala.estado === 'esperando' || sala.estado === 'apostando'
          ? '<div style="text-align:center;padding:0.5rem;background:var(--bg-card);border-radius:10px">' +
              '<p style="font-size:0.82rem;color:var(--text-secondary)">⏱️ Tiempo para apostar</p>' +
              '<p id="ruleta-timer-display" style="font-size:2rem;font-weight:900;color:var(--accent)">' + (sala.tiempoRestante || 15) + '</p>' +
            '</div>'
          : sala.estado === 'girando'
            ? '<div style="text-align:center;padding:0.5rem;background:var(--bg-card);border-radius:10px">' +
                '<p style="font-size:0.9rem;color:var(--accent);font-weight:700">🎡 Girando la ruleta...</p>' +
              '</div>'
            : ''
        ) +

        // Panel de apuesta (solo jugadores)
        (miModo === 'jugador' && sala.estado !== 'girando'
          ? renderPanelApuestaRuleta(salaId, sala, yoJugador, esVip)
          : miModo === 'espectador'
            ? '<div style="text-align:center;padding:0.75rem;background:var(--bg-card);border-radius:10px"><p style="color:var(--text-secondary);font-size:0.85rem">👁️ Modo espectador</p></div>'
            : '<div style="text-align:center;padding:0.75rem;background:var(--bg-card);border-radius:10px"><p style="color:var(--text-secondary);font-size:0.85rem">⏳ Esperando resultado...</p></div>'
        ) +

      '</div>';

    document.getElementById('btn-salir-ruleta').addEventListener('click', function() {
      salirSalaRuleta(salaId, miModo, sala);
    });

    // Iniciar timer si corresponde
    manejarTimerRuleta(salaId, sala);
  });
}

function renderRuletaVisual(ultimoNumero, girando) {
  var size = 200;
  var cx = size / 2, cy = size / 2, r = 90, rInterno = 55;
  var numeros = NUMEROS_RULETA;
  var total = numeros.length;
  var anguloPorNum = (2 * Math.PI) / total;

  var sectores = numeros.map(function(num, i) {
    var angIni = i * anguloPorNum - Math.PI / 2;
    var angFin = angIni + anguloPorNum;
    var x1 = cx + r * Math.cos(angIni);
    var y1 = cy + r * Math.sin(angIni);
    var x2 = cx + r * Math.cos(angFin);
    var y2 = cy + r * Math.sin(angFin);
    var xi1 = cx + rInterno * Math.cos(angIni);
    var yi1 = cy + rInterno * Math.sin(angIni);
    var xi2 = cx + rInterno * Math.cos(angFin);
    var yi2 = cy + rInterno * Math.sin(angFin);
    var color = COLORES_RULETA[num] === 'rojo' ? '#c0392b' : COLORES_RULETA[num] === 'negro' ? '#1a1a2e' : '#27ae60';
    var path = 'M ' + xi1 + ' ' + yi1 + ' L ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 0 1 ' + x2 + ' ' + y2 + ' L ' + xi2 + ' ' + yi2 + ' A ' + rInterno + ' ' + rInterno + ' 0 0 0 ' + xi1 + ' ' + yi1 + ' Z';
    var angMedio = angIni + anguloPorNum / 2;
    var rTexto = (r + rInterno) / 2;
    var tx = cx + rTexto * Math.cos(angMedio);
    var ty = cy + rTexto * Math.sin(angMedio);
    return { path: path, color: color, num: num, tx: tx, ty: ty, angMedio: angMedio };
  });

  // Calcular rotación si hay número ganador
  var rotacion = 0;
  if (ultimoNumero !== null && !girando) {
    var idxGanador = NUMEROS_RULETA.indexOf(ultimoNumero);
    rotacion = -(idxGanador * (360 / total));
  }

  var animStyle = girando
    ? 'animation: ruletaGirar 3s cubic-bezier(0.17,0.67,0.21,0.99) forwards;'
    : 'transform: rotate(' + rotacion + 'deg); transition: transform 3s cubic-bezier(0.17,0.67,0.21,0.99);';

  var svgSectores = sectores.map(function(s) {
    return '<path d="' + s.path + '" fill="' + s.color + '" stroke="#2d2d4e" stroke-width="0.5"/>' +
      '<text x="' + s.tx + '" y="' + s.ty + '" text-anchor="middle" dominant-baseline="middle" font-size="5" fill="white" font-weight="bold" transform="rotate(' + (s.angMedio * 180 / Math.PI + 90) + ' ' + s.tx + ' ' + s.ty + ')">' + s.num + '</text>';
  }).join('');

  return '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;margin:0 auto">' +
    '<svg width="' + size + '" height="' + size + '" style="' + animStyle + 'transform-origin:center center">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#2d2d4e"/>' +
      svgSectores +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + rInterno + '" fill="#1a1a2e"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="#d4af37" stroke="#f0c040" stroke-width="2"/>' +
      '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#1a1a2e" font-weight="bold">★</text>' +
    '</svg>' +
    // Indicador (triángulo arriba)
    '<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:16px solid #f0c040"></div>' +
  '</div>' +
  '<style>@keyframes ruletaGirar { 0%{transform:rotate(0deg)} 100%{transform:rotate(' + (720 + Math.random() * 360) + 'deg)} }</style>';
}

function renderPanelApuestaRuleta(salaId, sala, yoJugador, esVip) {
  var yaAposto = sala.apuestas && sala.apuestas[currentUser.uid];
  if (yaAposto) {
    return '<div style="text-align:center;padding:0.75rem;background:rgba(76,175,80,0.12);border-radius:10px;border:1px solid var(--success)">' +
      '<p style="color:var(--success);font-weight:700">✓ Apuesta confirmada</p>' +
      '<p style="font-size:0.82rem;color:var(--text-secondary)">£' + yaAposto.monto.toLocaleString('es-CO') + ' — ' + yaAposto.descripcion + '</p>' +
      '<button class="btn btn-secondary btn-full" id="btn-saltar-ronda" style="margin-top:0.5rem;font-size:0.82rem">Saltar ronda</button>' +
    '</div>';
  }

  var saldo = currentUser.saldo || 0;
  var maxApuesta = esVip ? saldo : 5000;

  return '<div style="background:var(--bg-card);border-radius:12px;padding:0.75rem">' +
    '<p style="font-size:0.82rem;font-weight:700;margin-bottom:0.5rem">🎯 Tu apuesta</p>' +

    // Monto
    '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">' +
      '<button class="btn-cantidad" id="ruleta-minus">−</button>' +
      '<input type="number" id="ruleta-monto" value="' + (esVip ? 1000 : 100) + '" min="' + (esVip ? 1000 : 100) + '" max="' + maxApuesta + '" style="flex:1;padding:0.5rem;border-radius:8px;border:1px solid var(--bg-secondary);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;text-align:center;outline:none"/>' +
      '<button class="btn-cantidad" id="ruleta-plus">+</button>' +
    '</div>' +

    // Tipo de apuesta
    '<p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.3rem">Tipo de apuesta</p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;margin-bottom:0.5rem">' +
      '<button class="ruleta-tipo-btn selected" data-tipo="color" data-valor="rojo" data-desc="Rojo 🔴" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:2px solid var(--accent);background:rgba(233,69,96,0.15);cursor:pointer;color:var(--text-primary)">🔴 Rojo ×2</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="color" data-valor="negro" data-desc="Negro ⚫" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)">⚫ Negro ×2</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="paridad" data-valor="par" data-desc="Par" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)">Par ×2</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="paridad" data-valor="impar" data-desc="Impar" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)">Impar ×2</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="mitad" data-valor="bajo" data-desc="1-18" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)">1-18 ×2</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="mitad" data-valor="alto" data-desc="19-36" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)">19-36 ×2</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="docena" data-valor="1" data-desc="Docena 1-12" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)">1-12 ×3</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="docena" data-valor="2" data-desc="Docena 13-24" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)">13-24 ×3</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="docena" data-valor="3" data-desc="Docena 25-36" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)" >25-36 ×3</button>' +
      '<button class="ruleta-tipo-btn" data-tipo="exacto" data-valor="" data-desc="Número exacto" style="padding:0.4rem;border-radius:8px;font-size:0.78rem;border:1px solid var(--bg-secondary);background:var(--bg-primary);cursor:pointer;color:var(--text-primary)">Nº exacto ×36</button>' +
    '</div>' +

    // Input número exacto (oculto por defecto)
    '<div id="ruleta-numero-exacto-wrap" style="display:none;margin-bottom:0.5rem">' +
      '<input type="number" id="ruleta-numero-exacto" placeholder="0-36" min="0" max="36" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--bg-secondary);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;box-sizing:border-box"/>' +
    '</div>' +

    '<button class="btn btn-primary btn-full" id="btn-confirmar-apuesta-ruleta">✅ Confirmar apuesta</button>' +
    '<button class="btn btn-secondary btn-full" id="btn-saltar-ronda" style="margin-top:0.4rem;font-size:0.8rem">Saltar ronda</button>' +
    '<div id="ruleta-apuesta-msg" style="margin-top:0.4rem;font-size:0.82rem"></div>' +
  '</div>';
}

function manejarTimerRuleta(salaId, sala) {
  if (ruletaTimerInterval) { clearInterval(ruletaTimerInterval); ruletaTimerInterval = null; }

  // Attach listeners dinámicos
  setTimeout(function() {
    // Botón saltar
    var btnSaltar = document.getElementById('btn-saltar-ronda');
    if (btnSaltar) {
      btnSaltar.addEventListener('click', async function() {
        var apuestas = sala.apuestas || {};
        apuestas[currentUser.uid] = { uid: currentUser.uid, username: currentUser.username, monto: 0, tipo: 'saltar', descripcion: 'Salta ronda', saltó: true };
        await updateDoc(doc(db, 'ruleta_salas', salaId), { apuestas: apuestas });
      });
    }

    // Botones tipo apuesta
    var tipoBtns = document.querySelectorAll('.ruleta-tipo-btn');
    tipoBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        tipoBtns.forEach(function(b) {
          b.style.border = '1px solid var(--bg-secondary)';
          b.style.background = 'var(--bg-primary)';
        });
        btn.style.border = '2px solid var(--accent)';
        btn.style.background = 'rgba(233,69,96,0.15)';
        var wrap = document.getElementById('ruleta-numero-exacto-wrap');
        if (wrap) wrap.style.display = btn.dataset.tipo === 'exacto' ? 'block' : 'none';
      });
    });

    // Botones +/-
    var btnMinus = document.getElementById('ruleta-minus');
    var btnPlus = document.getElementById('ruleta-plus');
    var esVip = sala.tipo === 'vip';
    var paso = esVip ? 1000 : 100;
    var minVal = esVip ? 1000 : 100;
    var maxVal = esVip ? (currentUser.saldo || 0) : 5000;

    if (btnMinus) {
      btnMinus.addEventListener('click', function() {
        var input = document.getElementById('ruleta-monto');
        if (input) { var v = parseInt(input.value) - paso; input.value = Math.max(minVal, v); }
      });
    }
    if (btnPlus) {
      btnPlus.addEventListener('click', function() {
        var input = document.getElementById('ruleta-monto');
        if (input) { var v = parseInt(input.value) + paso; input.value = Math.min(maxVal, v); }
      });
    }

    // Confirmar apuesta
    var btnConfirmar = document.getElementById('btn-confirmar-apuesta-ruleta');
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', async function() {
        var msg = document.getElementById('ruleta-apuesta-msg');
        var montoInput = document.getElementById('ruleta-monto');
        var monto = parseInt(montoInput ? montoInput.value : 0);
        var saldo = currentUser.saldo || 0;
        var tipoBtn = document.querySelector('.ruleta-tipo-btn[style*="var(--accent)"]');

        if (!tipoBtn) { if (msg) { msg.textContent = 'Selecciona un tipo de apuesta'; msg.style.color = 'var(--danger)'; } return; }
        if (!monto || monto < minVal) { if (msg) { msg.textContent = 'Mínimo £' + minVal.toLocaleString('es-CO'); msg.style.color = 'var(--danger)'; } return; }
        if (monto > saldo) { if (msg) { msg.textContent = 'Saldo insuficiente'; msg.style.color = 'var(--danger)'; } return; }

        var tipo = tipoBtn.dataset.tipo;
        var valor = tipoBtn.dataset.valor;
        var desc = tipoBtn.dataset.desc;

        if (tipo === 'exacto') {
          var numExacto = parseInt(document.getElementById('ruleta-numero-exacto').value);
          if (isNaN(numExacto) || numExacto < 0 || numExacto > 36) { if (msg) { msg.textContent = 'Ingresa un número entre 0 y 36'; msg.style.color = 'var(--danger)'; } return; }
          valor = numExacto.toString();
          desc = 'Número ' + numExacto;
        }

        var apuestas = sala.apuestas || {};
        apuestas[currentUser.uid] = { uid: currentUser.uid, username: currentUser.username, monto: monto, tipo: tipo, valor: valor, descripcion: desc };

        var update = { apuestas: apuestas };

        // Si solo hay un jugador, girar inmediatamente
        var jugadoresActivos = sala.jugadores ? sala.jugadores.length : 0;
        if (jugadoresActivos === 1) {
          update.estado = 'girando';
        } else {
          // Verificar si todos apostaron
          var todosApostaron = sala.jugadores && sala.jugadores.every(function(j) {
            return apuestas[j.uid] !== undefined;
          });
          if (todosApostaron) update.estado = 'girando';
        }

        await updateDoc(doc(db, 'ruleta_salas', salaId), update);

        if (update.estado === 'girando') {
          if (ruletaTimerInterval) { clearInterval(ruletaTimerInterval); ruletaTimerInterval = null; }
          setTimeout(function() { ejecutarGiroRuleta(salaId, sala); }, 500);
        }
      });
    }

    // Timer countdown
    if ((sala.estado === 'apostando' || sala.estado === 'esperando') && sala.jugadores && sala.jugadores.length > 0) {
      var tiempoInicio = sala.timerInicio ? new Date(sala.timerInicio).getTime() : Date.now();
      ruletaTimerInterval = setInterval(async function() {
        var transcurrido = Math.floor((Date.now() - tiempoInicio) / 1000);
        var restante = Math.max(0, 15 - transcurrido);
        var timerEl = document.getElementById('ruleta-timer-display');
        if (timerEl) timerEl.textContent = restante;

        if (restante <= 0) {
          clearInterval(ruletaTimerInterval); ruletaTimerInterval = null;
          // Solo el primer jugador en la lista ejecuta el giro para evitar duplicados
          var snapActual = await getDoc(doc(db, 'ruleta_salas', salaId));
          var salaActual = snapActual.data();
          if (salaActual.estado !== 'girando') {
            await updateDoc(doc(db, 'ruleta_salas', salaId), { estado: 'girando' });
            setTimeout(function() { ejecutarGiroRuleta(salaId, salaActual); }, 500);
          }
        }
      }, 1000);
    }
  }, 100);
}

async function ejecutarGiroRuleta(salaId, sala) {
  var snapActual = await getDoc(doc(db, 'ruleta_salas', salaId));
  if (!snapActual.exists()) return;
  var salaActual = snapActual.data();
  if (salaActual.estado !== 'girando') return;

  // Generar número ganador
  var numeroGanador = Math.floor(Math.random() * 37);
  var colorGanador = COLORES_RULETA[numeroGanador];

  // Esperar animación
  await new Promise(function(resolve) { setTimeout(resolve, 3500); });

  // Calcular resultados
  var apuestas = salaActual.apuestas || {};
  var jugadoresActualizados = (salaActual.jugadores || []).map(function(j) {
    var apuesta = apuestas[j.uid];
    if (!apuesta || apuesta.saltó || apuesta.monto === 0) return j;

    var monto = apuesta.monto;
    var ganancia = 0;
    var esApuestaSimple = apuesta.tipo === 'color' || apuesta.tipo === 'paridad' || apuesta.tipo === 'mitad';

    if (numeroGanador === 0) {
      if (esApuestaSimple) {
        // Pierde
        ganancia = -monto;
      } else {
        // Docena o exacto: devuelve la apuesta
        ganancia = 0;
      }
    } else {
      var gano = false;
      if (apuesta.tipo === 'color') gano = colorGanador === apuesta.valor;
      else if (apuesta.tipo === 'paridad') gano = apuesta.valor === 'par' ? numeroGanador % 2 === 0 : numeroGanador % 2 !== 0;
      else if (apuesta.tipo === 'mitad') gano = apuesta.valor === 'bajo' ? numeroGanador <= 18 : numeroGanador >= 19;
      else if (apuesta.tipo === 'docena') {
        var doc = parseInt(apuesta.valor);
        if (doc === 1) gano = numeroGanador >= 1 && numeroGanador <= 12;
        else if (doc === 2) gano = numeroGanador >= 13 && numeroGanador <= 24;
        else if (doc === 3) gano = numeroGanador >= 25 && numeroGanador <= 36;
      }
      else if (apuesta.tipo === 'exacto') gano = numeroGanador === parseInt(apuesta.valor);

      if (gano) {
        var mult = apuesta.tipo === 'color' || apuesta.tipo === 'paridad' || apuesta.tipo === 'mitad' ? 2 : apuesta.tipo === 'docena' ? 3 : 36;
        ganancia = monto * mult - monto;
      } else {
        ganancia = -monto;
      }
    }

    return Object.assign({}, j, {
      ganado: (j.ganado || 0) + (ganancia > 0 ? ganancia : 0),
      perdido: (j.perdido || 0) + (ganancia < 0 ? Math.abs(ganancia) : 0),
      neto: (j.neto || 0) + ganancia
    });
  });

  // Aplicar cambios de saldo en Firebase
  for (var i = 0; i < jugadoresActualizados.length; i++) {
    var jActual = jugadoresActualizados[i];
    var jOriginal = (salaActual.jugadores || []).find(function(j) { return j.uid === jActual.uid; });
    if (!jOriginal) continue;
    var apuesta = apuestas[jActual.uid];
    if (!apuesta || apuesta.saltó || apuesta.monto === 0) continue;

    var diferenciaGanado = (jActual.ganado || 0) - (jOriginal.ganado || 0);
    var diferenciaPerdido = (jActual.perdido || 0) - (jOriginal.perdido || 0);
    var cambioSaldo = diferenciaGanado - diferenciaPerdido;

    try {
      await updateDoc(doc(db, 'usuarios', jActual.uid), { saldo: increment(cambioSaldo) });
      if (jActual.uid === currentUser.uid) currentUser.saldo = (currentUser.saldo || 0) + cambioSaldo;
      await registrarTransaccion({
        tipo: 'casino_ruleta',
        de: cambioSaldo < 0 ? jActual.uid : 'sistema',
        deUsername: cambioSaldo < 0 ? jActual.username : 'Casino Ruleta',
        para: cambioSaldo >= 0 ? jActual.uid : 'sistema',
        paraUsername: cambioSaldo >= 0 ? jActual.username : 'Casino Ruleta',
        monto: Math.abs(cambioSaldo),
        descripcion: 'Ruleta: salió ' + numeroGanador + ' — ' + apuesta.descripcion + (cambioSaldo >= 0 ? ' — Ganó' : ' — Perdió')
      });
    } catch(err) { console.log('Error saldo ruleta:', err.message); }
  }

  // Reiniciar sala para próxima ronda
  await updateDoc(doc(db, 'ruleta_salas', salaId), {
    estado: sala.jugadores && sala.jugadores.length > 0 ? 'apostando' : 'esperando',
    ultimoNumero: numeroGanador,
    apuestas: {},
    jugadores: jugadoresActualizados,
    timerInicio: new Date().toISOString(),
    tiempoRestante: 15
  });
}

async function salirSalaRuleta(salaId, modo, sala) {
  if (ruletaListener) { ruletaListener(); ruletaListener = null; }
  if (ruletaTimerInterval) { clearInterval(ruletaTimerInterval); ruletaTimerInterval = null; }

  if (modo === 'jugador') {
    var nuevosJugadores = (sala.jugadores || []).filter(function(j) { return j.uid !== currentUser.uid; });
    var update = { jugadores: nuevosJugadores };
    if (nuevosJugadores.length === 0) {
      update.estado = 'esperando';
      update.apuestas = {};
      update.timerInicio = null;
    }
    await updateDoc(doc(db, 'ruleta_salas', salaId), update);
  } else {
    var nuevosEsp = (sala.espectadores || []).filter(function(e) { return e.uid !== currentUser.uid; });
    await updateDoc(doc(db, 'ruleta_salas', salaId), { espectadores: nuevosEsp });
  }

  ruletaSalaActualId = null;
  renderRuleta();
}

async function convertirAEspectador(salaId, sala) {
  var nuevosJugadores = (sala.jugadores || []).filter(function(j) { return j.uid !== currentUser.uid; });
  var nuevosEsp = (sala.espectadores || []).concat([{ uid: currentUser.uid, username: currentUser.username }]);
  await updateDoc(doc(db, 'ruleta_salas', salaId), { jugadores: nuevosJugadores, espectadores: nuevosEsp });
}

// ===== DADOS =====

var dadosListener = null;
var dadosSalaActualId = null;
var dadosTimerInterval = null;

var CATEGORIAS_DADOS = [
  { id: 'pequena', nombre: 'Pequeña', emoji: '🎲', apuesta: 100, color: 'var(--text-secondary)' },
  { id: 'media', nombre: 'Media', emoji: '🎯', apuesta: 1500, color: '#4fc3f7' },
  { id: 'grande', nombre: 'Grande', emoji: '💰', apuesta: 25000, color: '#81c784' },
  { id: 'elite', nombre: 'Elite', emoji: '👑', apuesta: 100000, color: '#ff9800' },
  { id: 'legendaria', nombre: 'Legendaria', emoji: '💎', apuesta: 500000, color: 'gold' }
];

async function renderDados() {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-casino-dados">← Casino</button>' +
      '<h3>🎲 Dados</h3>' +
    '</div>' +
    '<div class="salas-tabs" style="flex-wrap:wrap;gap:0.3rem;margin-bottom:0.75rem">' +
      CATEGORIAS_DADOS.map(function(cat) {
        return '<button class="sala-tab" data-cat="' + cat.id + '" style="color:' + cat.color + '">' + cat.emoji + ' ' + cat.nombre + '</button>';
      }).join('') +
      '<button class="sala-tab" data-cat="privada">🔒 Privada</button>' +
    '</div>' +
    '<div id="dados-salas-lista"></div>';

  document.getElementById('back-casino-dados').addEventListener('click', function() {
    if (dadosListener) { dadosListener(); dadosListener = null; }
    if (dadosTimerInterval) { clearInterval(dadosTimerInterval); dadosTimerInterval = null; }
    panel.innerHTML = '';
    renderCasino();
  });

  var tabs = document.querySelectorAll('.sala-tab[data-cat]');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      if (tab.dataset.cat === 'privada') {
        mostrarFormCrearSalaPrivadaDados();
      } else {
        cargarSalasDados(tab.dataset.cat);
      }
    });
  });

  await inicializarSalasDados();
  tabs[0].classList.add('active');
  cargarSalasDados('pequena');
}

async function inicializarSalasDados() {
  for (var c = 0; c < CATEGORIAS_DADOS.length; c++) {
    var cat = CATEGORIAS_DADOS[c];
    for (var i = 1; i <= 4; i++) {
      var id = 'dados_' + cat.id + '_' + i;
      var snap = await getDoc(doc(db, 'dados_salas', id));
      if (!snap.exists()) {
        await setDoc(doc(db, 'dados_salas', id), {
          id: id, tipo: 'publica', categoria: cat.id,
          nombre: cat.nombre + ' — Sala ' + i,
          apuesta: cat.apuesta, capacidad: 5,
          estado: 'esperando', jugadores: [], espectadores: [],
          dados: {}, createdAt: new Date().toISOString()
        });
      }
    }
  }
}

function cargarSalasDados(categoriaId) {
  var lista = document.getElementById('dados-salas-lista');
  if (!lista) return;
  lista.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p>';

  var cat = CATEGORIAS_DADOS.find(function(c) { return c.id === categoriaId; });

  onSnapshot(
    query(collection(db, 'dados_salas'), where('categoria', '==', categoriaId), where('tipo', '==', 'publica')),
    function(snap) {
      lista = document.getElementById('dados-salas-lista');
      if (!lista) return;
      var salas = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      salas.sort(function(a, b) {
        var numA = parseInt(a.id.replace(/\D/g, ''));
        var numB = parseInt(b.id.replace(/\D/g, ''));
        return numA - numB;
      });

      lista.innerHTML =
        '<div style="background:var(--bg-card);border-radius:10px;padding:0.6rem;margin-bottom:0.75rem;text-align:center">' +
          '<p style="font-size:0.85rem;color:' + cat.color + ';font-weight:700">' + cat.emoji + ' Apuesta fija: £' + cat.apuesta.toLocaleString('es-CO') + ' por jugador</p>' +
        '</div>' +
        salas.map(function(sala) {
          var jugadores = sala.jugadores ? sala.jugadores.length : 0;
          var estado = sala.estado || 'esperando';
          var estadoColor = estado === 'tirando' ? 'var(--danger)' : jugadores > 0 ? 'var(--warning)' : 'var(--success)';
          var estadoTexto = estado === 'tirando' ? '🔴 Tirando dados' : jugadores > 0 ? '🟡 Esperando (' + jugadores + '/5)' : '🟢 Vacía';
          return '<div class="sala-card">' +
            '<div class="sala-info">' +
              '<p class="sala-nombre">' + sala.nombre + '</p>' +
              '<p class="sala-estado" style="color:' + estadoColor + '">' + estadoTexto + '</p>' +
            '</div>' +
            '<button class="btn btn-primary sala-btn" data-id="' + sala.id + '">Entrar</button>' +
          '</div>';
        }).join('');

      lista.querySelectorAll('.sala-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          mostrarModalEntradaDados(btn.dataset.id);
        });
      });
    }
  );
}

function mostrarFormCrearSalaPrivadaDados() {
  var lista = document.getElementById('dados-salas-lista');
  lista.innerHTML =
    '<div class="card">' +
      '<h3 style="margin-bottom:0.75rem">🔒 Sala privada de dados</h3>' +
      '<label class="form-label">Apuesta por jugador (£)</label>' +
      '<input type="number" id="privada-apuesta" placeholder="Mínimo £100" min="100" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;outline:none;font-family:inherit;display:block;box-sizing:border-box;margin-bottom:0.5rem"/>' +
      '<label class="form-label">Máximo de jugadores</label>' +
      '<div class="citas-opciones" id="privada-capacidad">' +
        [2,3,4,5].map(function(n) {
          return '<button class="citas-opcion" data-val="' + n + '">' + n + '</button>';
        }).join('') +
      '</div>' +
      '<button class="btn btn-primary btn-full" id="btn-crear-privada-dados" style="margin-top:0.75rem">Crear sala</button>' +
      '<div id="privada-msg" style="margin-top:0.4rem;font-size:0.85rem"></div>' +
    '</div>';

  document.getElementById('privada-capacidad').querySelectorAll('.citas-opcion').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#privada-capacidad .citas-opcion').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
    });
  });

  document.getElementById('btn-crear-privada-dados').addEventListener('click', async function() {
    var apuesta = parseInt(document.getElementById('privada-apuesta').value);
    var capBtn = document.querySelector('#privada-capacidad .citas-opcion.selected');
    var msg = document.getElementById('privada-msg');
    if (!apuesta || apuesta < 100) { msg.textContent = 'Apuesta mínima £100'; msg.style.color = 'var(--danger)'; return; }
    if (!capBtn) { msg.textContent = 'Selecciona capacidad'; msg.style.color = 'var(--danger)'; return; }
    var capacidad = parseInt(capBtn.dataset.val);
    var codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    var salaId = 'dados_privada_' + codigo;
    await setDoc(doc(db, 'dados_salas', salaId), {
      id: salaId, tipo: 'privada', categoria: 'privada',
      nombre: 'Sala Privada', codigo: codigo,
      apuesta: apuesta, capacidad: capacidad,
      estado: 'esperando', jugadores: [], espectadores: [],
      dados: {}, creadoPor: currentUser.uid,
      createdAt: new Date().toISOString()
    });
    msg.textContent = '✓ Sala creada — Código: ' + codigo; msg.style.color = 'var(--success)';
    setTimeout(function() { mostrarModalEntradaDados(salaId); }, 800);
  });
}

async function mostrarModalEntradaDados(salaId) {
  var snap = await getDoc(doc(db, 'dados_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();
  var saldo = currentUser.saldo || 0;

  var modalHtml =
    '<div id="modal-dados-entrada" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center">' +
      '<div style="background:var(--bg-secondary);border-radius:16px;padding:1.5rem;width:90%;max-width:340px;border:1px solid var(--bg-card)">' +
        '<h3 style="margin-bottom:0.5rem">' + sala.nombre + '</h3>' +
        '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.25rem">Apuesta: <strong style="color:var(--accent)">£' + sala.apuesta.toLocaleString('es-CO') + '</strong></p>' +
        '<p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:1rem">Tu saldo: £' + saldo.toLocaleString('es-CO') + '</p>' +
        (sala.codigo ? '<p style="color:var(--accent);font-size:0.85rem;margin-bottom:0.75rem">Código: <strong>' + sala.codigo + '</strong></p>' : '') +
        '<button class="btn btn-primary btn-full" id="btn-dados-jugador" style="margin-bottom:0.5rem">🎲 Entrar como jugador</button>' +
        '<button class="btn btn-secondary btn-full" id="btn-dados-espectador">👁️ Entrar como espectador</button>' +
        '<button class="btn btn-secondary btn-full" id="btn-dados-cancelar" style="margin-top:0.5rem;border-color:var(--danger);color:var(--danger)">Cancelar</button>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('btn-dados-cancelar').addEventListener('click', function() {
    document.getElementById('modal-dados-entrada').remove();
  });

  document.getElementById('btn-dados-espectador').addEventListener('click', function() {
    document.getElementById('modal-dados-entrada').remove();
    entrarSalaDados(salaId, 'espectador');
  });

  document.getElementById('btn-dados-jugador').addEventListener('click', function() {
    document.getElementById('modal-dados-entrada').remove();
    if (saldo < sala.apuesta) {
      alert('No tienes suficiente saldo (£' + sala.apuesta.toLocaleString('es-CO') + '). Entrarás como espectador.');
      entrarSalaDados(salaId, 'espectador');
      return;
    }
    entrarSalaDados(salaId, 'jugador');
  });
}

async function entrarSalaDados(salaId, modo) {
  var snap = await getDoc(doc(db, 'dados_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();

  if (modo === 'jugador') {
    var yaEsta = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });
    if (!yaEsta && (!sala.jugadores || sala.jugadores.length < sala.capacidad)) {
      var nuevosJugadores = (sala.jugadores || []).concat([{
        uid: currentUser.uid,
        username: currentUser.username,
        foto: currentUser.fotoPerfil || '',
        ganado: 0, perdido: 0, neto: 0
      }]);
      var update = { jugadores: nuevosJugadores };
      if (sala.estado === 'esperando' && nuevosJugadores.length >= 2) {
        update.estado = 'apostando';
        update.timerInicio = new Date().toISOString();
      }
      await updateDoc(doc(db, 'dados_salas', salaId), update);
    }
  } else {
    var yaEstaEsp = sala.espectadores && sala.espectadores.find(function(e) { return e.uid === currentUser.uid; });
    if (!yaEstaEsp) {
      await updateDoc(doc(db, 'dados_salas', salaId), {
        espectadores: (sala.espectadores || []).concat([{ uid: currentUser.uid, username: currentUser.username }])
      });
    }
  }

  dadosSalaActualId = salaId;
  renderSalaDados(salaId, modo);
}

function renderSalaDados(salaId, modoInicial) {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML = '<div id="dados-sala-container"></div>';

  if (dadosListener) { dadosListener(); dadosListener = null; }
  if (dadosTimerInterval) { clearInterval(dadosTimerInterval); dadosTimerInterval = null; }

  dadosListener = onSnapshot(doc(db, 'dados_salas', salaId), function(snap) {
    if (!snap.exists()) return;
    var sala = snap.data();
    var container = document.getElementById('dados-sala-container');
    if (!container) return;

    var yoJugador = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });
    var miModo = yoJugador ? 'jugador' : 'espectador';
    var saldo = currentUser.saldo || 0;
    var numJugadores = sala.jugadores ? sala.jugadores.length : 0;
    var numDados = numJugadores <= 3 ? 1 : 2;
    var yaTire = sala.dados && sala.dados[currentUser.uid] !== undefined;

    // Auto espectador si no tiene saldo
    if (yoJugador && saldo < sala.apuesta && sala.estado === 'apostando') {
      convertirAEspectadorDados(salaId, sala);
      return;
    }

    container.innerHTML =
      // Header
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">' +
        '<button class="btn-back" id="btn-salir-dados">← Salir</button>' +
        '<h3 style="font-size:0.9rem">🎲 ' + sala.nombre + '</h3>' +
        '<span style="font-size:0.78rem;color:var(--accent)">£' + sala.apuesta.toLocaleString('es-CO') + '</span>' +
      '</div>' +

      // Ranking
      '<div style="background:var(--bg-card);border-radius:12px;padding:0.6rem;margin-bottom:0.5rem">' +
        '<p style="font-size:0.72rem;color:var(--text-secondary);font-weight:700;margin-bottom:0.4rem">👥 JUGADORES EN SALA</p>' +
        (sala.jugadores && sala.jugadores.length > 0
          ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem">' +
            sala.jugadores.map(function(j) {
              return '<div style="background:var(--bg-secondary);border-radius:8px;padding:0.4rem;font-size:0.7rem">' +
                '<p style="font-weight:700;color:var(--text-primary)">' + j.username + '</p>' +
                '<p style="color:var(--success)">+£' + (j.ganado || 0).toLocaleString('es-CO') + '</p>' +
                '<p style="color:var(--danger)">-£' + (j.perdido || 0).toLocaleString('es-CO') + '</p>' +
                '<p style="color:' + ((j.neto || 0) >= 0 ? 'var(--success)' : 'var(--danger)') + ';font-weight:700">£' + (j.neto || 0).toLocaleString('es-CO') + '</p>' +
              '</div>';
            }).join('') +
            '</div>'
          : '<p style="font-size:0.72rem;color:var(--text-secondary)">Sin jugadores</p>'
        ) +
      '</div>' +

      // Área principal de dados
      '<div style="background:var(--bg-card);border-radius:12px;padding:0.75rem;margin-bottom:0.5rem;text-align:center">' +
        (sala.estado === 'esperando'
          ? '<p style="color:var(--text-secondary);padding:1rem">⏳ Esperando jugadores...</p>'
          : sala.estado === 'tirando'
            ? renderAnimacionDados(sala, numDados)
            : sala.estado === 'resultado'
              ? renderResultadoDados(sala)
              : renderAreaTiroDados(sala, yoJugador, yaTire, numDados, miModo)
        ) +
      '</div>' +

      // Timer
      (sala.estado === 'apostando'
        ? '<div style="text-align:center;padding:0.5rem;background:var(--bg-card);border-radius:10px;margin-bottom:0.5rem">' +
            '<p style="font-size:0.78rem;color:var(--text-secondary)">⏱️ Tiempo para tirar</p>' +
            '<p id="dados-timer-display" style="font-size:2rem;font-weight:900;color:var(--accent)">10</p>' +
          '</div>'
        : ''
      ) +

      // Modo espectador
      (miModo === 'espectador'
        ? '<div style="text-align:center;padding:0.5rem;background:var(--bg-card);border-radius:10px">' +
            '<p style="color:var(--text-secondary);font-size:0.82rem">👁️ Modo espectador</p>' +
          '</div>'
        : ''
      );

    document.getElementById('btn-salir-dados').addEventListener('click', function() {
      salirSalaDados(salaId, miModo, sala);
    });

    // Botón tirar dado
    setTimeout(function() {
      var btnTirar = document.getElementById('btn-tirar-dado-dados');
      if (btnTirar) {
        btnTirar.addEventListener('click', async function() {
          await tirarDadosDados(salaId, sala, numDados);
        });
      }
      manejarTimerDados(salaId, sala, numDados);
    }, 100);
  });
}

function renderAreaTiroDados(sala, yoJugador, yaTire, numDados, miModo) {
  if (miModo === 'espectador') return '';
  var dados = sala.dados || {};
  var jugadores = sala.jugadores || [];

  var estadoJugadores = jugadores.map(function(j) {
    var tiro = dados[j.uid];
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;font-size:0.82rem">' +
      '<span>' + j.username + '</span>' +
      '<span style="color:' + (tiro !== undefined ? 'var(--success)' : 'var(--text-secondary)') + '">' +
        (tiro !== undefined ? '✓ Lanzado' : '⏳ Esperando') +
      '</span>' +
    '</div>';
  }).join('');

  return '<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.5rem">Dados por jugador: <strong>' + numDados + 'D20</strong></p>' +
    estadoJugadores +
    (!yaTire
      ? '<div class="dados-container" style="margin:0.75rem 0">' +
          Array(numDados).fill('<span class="dado-animando">🎲</span>').join('') +
        '</div>' +
        '<button class="btn btn-primary btn-full" id="btn-tirar-dado-dados" style="font-size:1rem;padding:0.85rem">🎲 Tirar ' + (numDados > 1 ? 'dados' : 'dado') + '</button>'
      : '<div class="dados-container" style="margin:0.75rem 0">' +
          '<span class="dado-resultado">✅</span>' +
        '</div>' +
        '<p style="color:var(--success);font-weight:700">Ya tiraste, esperando a los demás...</p>'
    );
}

function renderAnimacionDados(sala, numDados) {
  return '<p style="color:var(--accent);font-weight:700;margin-bottom:0.75rem">🎲 Tirando dados...</p>' +
    '<div class="dados-container">' +
      Array(numDados * 2).fill('<span class="dado-animando">🎲</span>').join('') +
    '</div>';
}

function renderResultadoDados(sala) {
  var resultados = sala.resultados || {};
  var jugadores = sala.jugadores || [];
  var ranking = sala.rankingRonda || [];

  var html = '<p style="font-weight:700;font-size:0.95rem;margin-bottom:0.75rem">🏆 Resultados de la ronda</p>';

  html += jugadores.map(function(j) {
    var res = resultados[j.uid] || [];
    var suma = res.reduce(function(a, b) { return a + b; }, 0);
    var pos = ranking.indexOf(j.uid) + 1;
    var emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '💀';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.5rem;border-radius:8px;background:var(--bg-primary);margin-bottom:0.3rem">' +
      '<span style="font-size:0.85rem">' + emoji + ' ' + j.username + '</span>' +
      '<span style="font-size:0.85rem;font-weight:700">' + res.join(' + ') + (res.length > 1 ? ' = ' + suma : '') + '</span>' +
    '</div>';
  }).join('');

  html += '<p style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.5rem">Próxima ronda en breve...</p>';
  return html;
}

async function tirarDadosDados(salaId, sala, numDados) {
  var resultados = [];
  for (var i = 0; i < numDados; i++) {
    resultados.push(Math.floor(Math.random() * 20) + 1);
  }

  var nuevosDados = Object.assign({}, sala.dados || {});
  nuevosDados[currentUser.uid] = resultados;

  var update = { dados: nuevosDados };
  var jugadores = sala.jugadores || [];
  var todosLanzaron = jugadores.every(function(j) { return nuevosDados[j.uid] !== undefined; });

  if (todosLanzaron) {
    update.estado = 'tirando';
  }

  await updateDoc(doc(db, 'dados_salas', salaId), update);

  if (todosLanzaron) {
    if (dadosTimerInterval) { clearInterval(dadosTimerInterval); dadosTimerInterval = null; }
    setTimeout(function() { resolverRondaDados(salaId); }, 2000);
  }
}

async function resolverRondaDados(salaId) {
  var snap = await getDoc(doc(db, 'dados_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();
  var jugadores = sala.jugadores || [];
  var dados = sala.dados || {};
  var apuesta = sala.apuesta;

  // Calcular sumas
  var sumas = jugadores.map(function(j) {
    var tiro = dados[j.uid] || [Math.floor(Math.random() * 20) + 1];
    return { uid: j.uid, username: j.username, suma: tiro.reduce(function(a, b) { return a + b; }, 0), dados: tiro };
  });

  // Ordenar de mayor a menor, manejar empates relanzando
  sumas.sort(function(a, b) { return b.suma - a.suma; });

  // Detectar empates en primer lugar y relanzar si es necesario
  var maxSuma = sumas[0].suma;
  var empatadosPrimero = sumas.filter(function(s) { return s.suma === maxSuma; });
  if (empatadosPrimero.length > 1) {
    // Relanzar para todos los empatados
    empatadosPrimero.forEach(function(s) {
      var numDados = jugadores.length <= 3 ? 1 : 2;
      var nuevoTiro = [];
      for (var i = 0; i < numDados; i++) nuevoTiro.push(Math.floor(Math.random() * 20) + 1);
      s.suma = nuevoTiro.reduce(function(a, b) { return a + b; }, 0);
      s.dados = nuevoTiro;
      dados[s.uid] = nuevoTiro;
    });
    sumas.sort(function(a, b) { return b.suma - a.suma; });
  }

  var rankingRonda = sumas.map(function(s) { return s.uid; });
  var resultados = {};
  sumas.forEach(function(s) { resultados[s.uid] = s.dados; });

  // Calcular cambios de saldo según número de jugadores
  var cambios = {};
  jugadores.forEach(function(j) { cambios[j.uid] = 0; });

  var n = jugadores.length;

  if (n === 2) {
    cambios[rankingRonda[0]] = apuesta;
    cambios[rankingRonda[1]] = -apuesta;
  } else if (n === 3) {
    cambios[rankingRonda[0]] = apuesta;
    cambios[rankingRonda[1]] = 0;
    cambios[rankingRonda[2]] = -apuesta;
  } else if (n === 4) {
    var pozo4 = apuesta * 2;
    cambios[rankingRonda[0]] = Math.floor(pozo4 * 0.75);
    cambios[rankingRonda[1]] = Math.floor(pozo4 * 0.25);
    cambios[rankingRonda[2]] = -apuesta;
    cambios[rankingRonda[3]] = -apuesta;
  } else if (n === 5) {
    var pozo5 = apuesta * 3;
    cambios[rankingRonda[0]] = Math.floor(pozo5 * 0.75);
    cambios[rankingRonda[1]] = Math.floor(pozo5 * 0.25);
    cambios[rankingRonda[2]] = -Math.floor(apuesta * 0.5);
    cambios[rankingRonda[3]] = -apuesta;
    cambios[rankingRonda[4]] = -apuesta;
  }

  // Actualizar saldos y ranking
  var jugadoresActualizados = jugadores.map(function(j) {
    var cambio = cambios[j.uid] || 0;
    return Object.assign({}, j, {
      ganado: (j.ganado || 0) + (cambio > 0 ? cambio : 0),
      perdido: (j.perdido || 0) + (cambio < 0 ? Math.abs(cambio) : 0),
      neto: (j.neto || 0) + cambio
    });
  });

  // Aplicar cambios en Firebase
  for (var i = 0; i < jugadoresActualizados.length; i++) {
    var j = jugadoresActualizados[i];
    var cambio = cambios[j.uid] || 0;
    if (cambio === 0) continue;
    try {
      await updateDoc(doc(db, 'usuarios', j.uid), { saldo: increment(cambio) });
      if (j.uid === currentUser.uid) currentUser.saldo = (currentUser.saldo || 0) + cambio;
      await registrarTransaccion({
        tipo: 'casino_dados',
        de: cambio < 0 ? j.uid : 'sistema',
        deUsername: cambio < 0 ? j.username : 'Casino Dados',
        para: cambio >= 0 ? j.uid : 'sistema',
        paraUsername: cambio >= 0 ? j.username : 'Casino Dados',
        monto: Math.abs(cambio),
        descripcion: 'Dados: ' + j.username + ' — ' + (cambio >= 0 ? 'Ganó' : 'Perdió') + ' £' + Math.abs(cambio).toLocaleString('es-CO')
      });
    } catch(err) { console.log('Error saldo dados:', err.message); }
  }

  // Mostrar resultado y preparar siguiente ronda
  await updateDoc(doc(db, 'dados_salas', salaId), {
    estado: 'resultado',
    jugadores: jugadoresActualizados,
    dados: dados,
    resultados: resultados,
    rankingRonda: rankingRonda
  });

  // Pasar a siguiente ronda automáticamente
  setTimeout(async function() {
    var snapActual = await getDoc(doc(db, 'dados_salas', salaId));
    if (!snapActual.exists()) return;
    var salaActual = snapActual.data();
    if (salaActual.estado !== 'resultado') return;

    // Verificar jugadores con saldo suficiente
    var jugadoresValidos = [];
    var nuevosEspectadores = salaActual.espectadores || [];

    for (var k = 0; k < (salaActual.jugadores || []).length; k++) {
      var jug = salaActual.jugadores[k];
      var snapUser = await getDoc(doc(db, 'usuarios', jug.uid));
      var saldoActual = snapUser.exists() ? (snapUser.data().saldo || 0) : 0;
      if (saldoActual >= salaActual.apuesta) {
        jugadoresValidos.push(jug);
      } else {
        nuevosEspectadores.push({ uid: jug.uid, username: jug.username });
      }
    }

    var nuevoEstado = jugadoresValidos.length >= 2 ? 'apostando' : 'esperando';
    await updateDoc(doc(db, 'dados_salas', salaId), {
      estado: nuevoEstado,
      jugadores: jugadoresValidos,
      espectadores: nuevosEspectadores,
      dados: {},
      resultados: {},
      rankingRonda: [],
      timerInicio: new Date().toISOString()
    });
  }, 3000);
}

function manejarTimerDados(salaId, sala, numDados) {
  if (dadosTimerInterval) { clearInterval(dadosTimerInterval); dadosTimerInterval = null; }
  if (sala.estado !== 'apostando') return;

  var tiempoInicio = sala.timerInicio ? new Date(sala.timerInicio).getTime() : Date.now();

  dadosTimerInterval = setInterval(async function() {
    var transcurrido = Math.floor((Date.now() - tiempoInicio) / 1000);
    var restante = Math.max(0, 10 - transcurrido);
    var timerEl = document.getElementById('dados-timer-display');
    if (timerEl) timerEl.textContent = restante;

    if (restante <= 0) {
      clearInterval(dadosTimerInterval); dadosTimerInterval = null;
      var snapActual = await getDoc(doc(db, 'dados_salas', salaId));
      if (!snapActual.exists()) return;
      var salaActual = snapActual.data();
      if (salaActual.estado !== 'apostando') return;

      // Tirar dados automáticamente para los que no tiraron
      var nuevosDados = Object.assign({}, salaActual.dados || {});
      var jugadores = salaActual.jugadores || [];
      jugadores.forEach(function(j) {
        if (nuevosDados[j.uid] === undefined) {
          var tiros = [];
          for (var i = 0; i < numDados; i++) tiros.push(Math.floor(Math.random() * 20) + 1);
          nuevosDados[j.uid] = tiros;
        }
      });

      await updateDoc(doc(db, 'dados_salas', salaId), { dados: nuevosDados, estado: 'tirando' });
      setTimeout(function() { resolverRondaDados(salaId); }, 2000);
    }
  }, 1000);
}

async function salirSalaDados(salaId, modo, sala) {
  if (dadosListener) { dadosListener(); dadosListener = null; }
  if (dadosTimerInterval) { clearInterval(dadosTimerInterval); dadosTimerInterval = null; }

  if (modo === 'jugador') {
    var nuevosJugadores = (sala.jugadores || []).filter(function(j) { return j.uid !== currentUser.uid; });
    var update = { jugadores: nuevosJugadores };
    if (nuevosJugadores.length < 2) {
      update.estado = 'esperando';
      update.dados = {};
      update.timerInicio = null;
    }
    await updateDoc(doc(db, 'dados_salas', salaId), update);
  } else {
    var nuevosEsp = (sala.espectadores || []).filter(function(e) { return e.uid !== currentUser.uid; });
    await updateDoc(doc(db, 'dados_salas', salaId), { espectadores: nuevosEsp });
  }

  dadosSalaActualId = null;
  renderDados();
}

async function convertirAEspectadorDados(salaId, sala) {
  var nuevosJugadores = (sala.jugadores || []).filter(function(j) { return j.uid !== currentUser.uid; });
  var nuevosEsp = (sala.espectadores || []).concat([{ uid: currentUser.uid, username: currentUser.username }]);
  var update = { jugadores: nuevosJugadores, espectadores: nuevosEsp };
  if (nuevosJugadores.length < 2) { update.estado = 'esperando'; update.dados = {}; }
  await updateDoc(doc(db, 'dados_salas', salaId), update);
}

// ===== BLACKJACK =====

var bjListener = null;
var bjSalaActualId = null;
var bjTimerInterval = null;

var CATEGORIAS_BJ = [
  { id: 'bj100', nombre: 'Principiante', emoji: '🃏', apuesta: 100, color: 'var(--text-secondary)' },
  { id: 'bj1500', nombre: 'Aficionado', emoji: '🎯', apuesta: 1500, color: '#4fc3f7' },
  { id: 'bj25000', nombre: 'Experto', emoji: '💰', apuesta: 25000, color: '#81c784' },
  { id: 'bj100000', nombre: 'Elite', emoji: '👑', apuesta: 100000, color: '#ff9800' },
  { id: 'bj250000', nombre: 'Legendario', emoji: '💎', apuesta: 250000, color: 'gold' }
];

var PALOS = ['♠', '♥', '♦', '♣'];
var VALORES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function crearMazo() {
  var mazo = [];
  PALOS.forEach(function(palo) {
    VALORES.forEach(function(valor) {
      mazo.push({ valor: valor, palo: palo });
    });
  });
  // Mezclar
  for (var i = mazo.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = mazo[i]; mazo[i] = mazo[j]; mazo[j] = temp;
  }
  return mazo;
}

function valorCarta(carta) {
  if (carta.valor === 'A') return 11;
  if (['J','Q','K'].includes(carta.valor)) return 10;
  return parseInt(carta.valor);
}

function calcularMano(cartas) {
  var total = 0;
  var ases = 0;
  cartas.forEach(function(c) {
    if (c.oculta) return;
    total += valorCarta(c);
    if (c.valor === 'A') ases++;
  });
  while (total > 21 && ases > 0) {
    total -= 10;
    ases--;
  }
  return total;
}

function esBlackjackNatural(cartas) {
  if (cartas.length !== 2) return false;
  var valores = cartas.map(function(c) { return c.valor; });
  var tieneAs = valores.includes('A');
  var tieneDiez = cartas.some(function(c) { return ['10','J','Q','K'].includes(c.valor); });
  return tieneAs && tieneDiez;
}

function renderCartaSVG(carta, esNueva, esRevelando) {
  if (carta.oculta) {
    return '<div class="bj-carta oculta' + (esNueva ? ' nueva' : '') + '">' +
      '<div style="width:100%;height:100%;border-radius:6px;background:repeating-linear-gradient(45deg,#1a1a6e,#1a1a6e 5px,#2d2d9e 5px,#2d2d9e 10px);display:flex;align-items:center;justify-content:center;font-size:1.5rem">🂠</div>' +
    '</div>';
  }
  var esRoja = carta.palo === '♥' || carta.palo === '♦';
  var clase = 'bj-carta ' + (esRoja ? 'roja' : 'negra') + (esNueva ? ' nueva' : '') + (esRevelando ? ' revelando' : '');
  return '<div class="' + clase + '">' +
    '<div>' +
      '<div class="bj-carta-valor-top">' + carta.valor + '</div>' +
      '<div class="bj-carta-palo-top">' + carta.palo + '</div>' +
    '</div>' +
    '<div class="bj-carta-centro">' + carta.palo + '</div>' +
    '<div>' +
      '<div class="bj-carta-palo-bot">' + carta.palo + '</div>' +
      '<div class="bj-carta-valor-bot">' + carta.valor + '</div>' +
    '</div>' +
  '</div>';
}

async function renderBlackjack() {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML =
    '<div class="tienda-seccion-header" style="margin-top:1rem">' +
      '<button class="btn-back" id="back-casino-bj">← Casino</button>' +
      '<h3>🃏 Blackjack</h3>' +
    '</div>' +
    '<div class="salas-tabs" style="flex-wrap:wrap;gap:0.3rem;margin-bottom:0.75rem">' +
      CATEGORIAS_BJ.map(function(cat) {
        return '<button class="sala-tab" data-cat="' + cat.id + '" style="color:' + cat.color + '">' + cat.emoji + ' ' + cat.nombre + '</button>';
      }).join('') +
    '</div>' +
    '<div id="bj-salas-lista"></div>';

  document.getElementById('back-casino-bj').addEventListener('click', function() {
    if (bjListener) { bjListener(); bjListener = null; }
    if (bjTimerInterval) { clearInterval(bjTimerInterval); bjTimerInterval = null; }
    panel.innerHTML = '';
    renderCasino();
  });

  var tabs = document.querySelectorAll('.sala-tab[data-cat]');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      cargarSalasBJ(tab.dataset.cat);
    });
  });

  await inicializarSalasBJ();
  tabs[0].classList.add('active');
  cargarSalasBJ('bj100');
}

async function inicializarSalasBJ() {
  for (var c = 0; c < CATEGORIAS_BJ.length; c++) {
    var cat = CATEGORIAS_BJ[c];
    for (var i = 1; i <= 5; i++) {
      var id = 'bj_' + cat.id + '_' + i;
      var snap = await getDoc(doc(db, 'blackjack_salas', id));
      if (!snap.exists()) {
        await setDoc(doc(db, 'blackjack_salas', id), {
          id: id, categoria: cat.id, nombre: cat.nombre + ' — Sala ' + i,
          apuesta: cat.apuesta, capacidad: 5,
          estado: 'esperando', jugadores: [], espectadores: [],
          mazo: [], cartasCasino: [], turnoActual: -1,
          plantados: [], eliminados: [], createdAt: new Date().toISOString()
        });
      }
    }
  }
}

function cargarSalasBJ(categoriaId) {
  var lista = document.getElementById('bj-salas-lista');
  if (!lista) return;
  lista.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem">Cargando...</p>';
  var cat = CATEGORIAS_BJ.find(function(c) { return c.id === categoriaId; });

  onSnapshot(
    query(collection(db, 'blackjack_salas'), where('categoria', '==', categoriaId)),
    function(snap) {
      lista = document.getElementById('bj-salas-lista');
      if (!lista) return;
      var salas = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      salas.sort(function(a, b) {
        var na = parseInt(a.id.replace(/\D/g, ''));
        var nb = parseInt(b.id.replace(/\D/g, ''));
        return na - nb;
      });

      lista.innerHTML =
        '<div style="background:var(--bg-card);border-radius:10px;padding:0.6rem;margin-bottom:0.75rem;text-align:center">' +
          '<p style="font-size:0.85rem;color:' + cat.color + ';font-weight:700">' + cat.emoji + ' ' + cat.nombre + ' — Apuesta: £' + cat.apuesta.toLocaleString('es-CO') + '</p>' +
        '</div>' +
        salas.map(function(sala) {
          var jugadores = sala.jugadores ? sala.jugadores.length : 0;
          var estado = sala.estado || 'esperando';
          var estadoColor = ['repartiendo','turnos','casino','resultado'].includes(estado) ? 'var(--danger)' : jugadores > 0 ? 'var(--warning)' : 'var(--success)';
          var estadoTexto = estado === 'esperando' ? '🟢 Vacía' : estado === 'repartiendo' ? '🔴 Repartiendo' : estado === 'turnos' ? '🔴 En juego' : estado === 'casino' ? '🔴 Turno casino' : estado === 'resultado' ? '🔴 Resultado' : '🟡 Esperando (' + jugadores + '/5)';
          return '<div class="sala-card">' +
            '<div class="sala-info">' +
              '<p class="sala-nombre">' + sala.nombre + '</p>' +
              '<p class="sala-estado" style="color:' + estadoColor + '">' + estadoTexto + '</p>' +
            '</div>' +
            '<button class="btn btn-primary sala-btn" data-id="' + sala.id + '">Entrar</button>' +
          '</div>';
        }).join('');

      lista.querySelectorAll('.sala-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { mostrarModalEntradaBJ(btn.dataset.id); });
      });
    }
  );
}

async function mostrarModalEntradaBJ(salaId) {
  var snap = await getDoc(doc(db, 'blackjack_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();
  var saldo = currentUser.saldo || 0;
  var enRonda = ['repartiendo','turnos','casino','resultado'].includes(sala.estado);

  var modalHtml =
    '<div id="modal-bj-entrada" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center">' +
      '<div style="background:var(--bg-secondary);border-radius:16px;padding:1.5rem;width:90%;max-width:340px;border:1px solid var(--bg-card)">' +
        '<h3 style="margin-bottom:0.5rem">🃏 ' + sala.nombre + '</h3>' +
        '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.25rem">Apuesta: <strong style="color:var(--accent)">£' + sala.apuesta.toLocaleString('es-CO') + '</strong></p>' +
        '<p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:0.75rem">Tu saldo: £' + saldo.toLocaleString('es-CO') + '</p>' +
        (enRonda ? '<p style="color:var(--warning);font-size:0.82rem;margin-bottom:0.75rem">⚠️ Hay una ronda en curso. Entrarás como espectador hasta que termine.</p>' : '') +
        '<button class="btn btn-primary btn-full" id="btn-bj-jugador" style="margin-bottom:0.5rem">🃏 Entrar como jugador</button>' +
        '<button class="btn btn-secondary btn-full" id="btn-bj-espectador">👁️ Entrar como espectador</button>' +
        '<button class="btn btn-secondary btn-full" id="btn-bj-cancelar" style="margin-top:0.5rem;border-color:var(--danger);color:var(--danger)">Cancelar</button>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('btn-bj-cancelar').addEventListener('click', function() {
    document.getElementById('modal-bj-entrada').remove();
  });

  document.getElementById('btn-bj-espectador').addEventListener('click', function() {
    document.getElementById('modal-bj-entrada').remove();
    entrarSalaBJ(salaId, 'espectador');
  });

  document.getElementById('btn-bj-jugador').addEventListener('click', function() {
    document.getElementById('modal-bj-entrada').remove();
    if (saldo < sala.apuesta) {
      alert('Saldo insuficiente. Necesitas £' + sala.apuesta.toLocaleString('es-CO'));
      entrarSalaBJ(salaId, 'espectador');
      return;
    }
    entrarSalaBJ(salaId, enRonda ? 'espectador_a_jugador' : 'jugador');
  });
}

async function entrarSalaBJ(salaId, modo) {
  var snap = await getDoc(doc(db, 'blackjack_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();

  if (modo === 'jugador') {
    var yaEsta = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });
    if (!yaEsta && (!sala.jugadores || sala.jugadores.length < sala.capacidad)) {
      var nuevosJugadores = (sala.jugadores || []).concat([{
        uid: currentUser.uid, username: currentUser.username,
        foto: currentUser.fotoPerfil || '',
        cartas: [], ganado: 0, perdido: 0, neto: 0,
        estado: 'esperando'
      }]);
      var update = { jugadores: nuevosJugadores };
      if (sala.estado === 'esperando' && nuevosJugadores.length >= 1) {
        update.estado = 'lobby';
        update.lobbyInicio = new Date().toISOString();
      }
      await updateDoc(doc(db, 'blackjack_salas', salaId), update);
    }
  } else {
    var modoReal = modo === 'espectador_a_jugador' ? 'espectador_a_jugador' : 'espectador';
    var yaEstaEsp = sala.espectadores && sala.espectadores.find(function(e) { return e.uid === currentUser.uid; });
    if (!yaEstaEsp) {
      await updateDoc(doc(db, 'blackjack_salas', salaId), {
        espectadores: (sala.espectadores || []).concat([{
          uid: currentUser.uid, username: currentUser.username,
          modoFuturo: modoReal
        }])
      });
    }
  }

  bjSalaActualId = salaId;
  renderSalaBJ(salaId);
}

function renderSalaBJ(salaId) {
  var panel = document.getElementById('casino-panel');
  panel.innerHTML = '<div id="bj-sala-container"></div>';

  if (bjListener) { bjListener(); bjListener = null; }
  if (bjTimerInterval) { clearInterval(bjTimerInterval); bjTimerInterval = null; }

  bjListener = onSnapshot(doc(db, 'blackjack_salas', salaId), function(snap) {
    if (!snap.exists()) return;
    var sala = snap.data();
    var container = document.getElementById('bj-sala-container');
    if (!container) return;

    var yoJugador = sala.jugadores && sala.jugadores.find(function(j) { return j.uid === currentUser.uid; });
    var yoEspectador = sala.espectadores && sala.espectadores.find(function(e) { return e.uid === currentUser.uid; });
    var miModo = yoJugador ? 'jugador' : 'espectador';
    var saldo = currentUser.saldo || 0;

    // Si la ronda terminó y era espectador_a_jugador, convertir
    if (sala.estado === 'esperando' || sala.estado === 'lobby') {
      if (yoEspectador && yoEspectador.modoFuturo === 'espectador_a_jugador') {
        convertirEspectadorAJugadorBJ(salaId, sala);
        return;
      }
    }

    var ordenTurnos = sala.ordenTurnos || [];
    var turnoIdx = sala.turnoActual !== undefined ? sala.turnoActual : -1;
    var uidEnTurno = turnoIdx >= 0 && turnoIdx < ordenTurnos.length ? ordenTurnos[turnoIdx] : null;
    var esMiTurno = uidEnTurno === currentUser.uid && miModo === 'jugador';

    container.innerHTML =
      // Header
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">' +
        '<button class="btn-back" id="btn-salir-bj">← Salir</button>' +
        '<h3 style="font-size:0.88rem">🃏 ' + sala.nombre + '</h3>' +
        '<span style="font-size:0.78rem;color:var(--accent)">£' + (currentUser.saldo || 0).toLocaleString('es-CO') + '</span>' +
      '</div>' +

      // Casino
      '<div style="background:linear-gradient(135deg,#0d4f2f,#1a7a4a);border-radius:12px;padding:0.75rem;margin-bottom:0.5rem">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">' +
          '<p style="color:#90ee90;font-size:0.78rem;font-weight:700">🏦 CASINO</p>' +
          (sala.cartasCasino && sala.cartasCasino.length > 0
            ? '<span class="bj-puntos" style="background:rgba(0,0,0,0.3);color:white">' + calcularMano(sala.cartasCasino) + ' pts</span>'
            : ''
          ) +
        '</div>' +
        '<div class="bj-mano">' +
          (sala.cartasCasino && sala.cartasCasino.length > 0
            ? sala.cartasCasino.map(function(c) { return renderCartaSVG(c, false, false); }).join('')
            : '<p style="color:rgba(255,255,255,0.5);font-size:0.82rem">Sin cartas aún</p>'
          ) +
        '</div>' +
      '</div>' +

      // Jugadores
      '<div id="bj-jugadores-area">' +
        (sala.jugadores && sala.jugadores.length > 0
          ? sala.jugadores.map(function(j) {
              var esTurno = j.uid === uidEnTurno;
              var puntos = calcularMano(j.cartas || []);
              var estadoJ = j.estado || 'esperando';
              var clasePanel = 'bj-jugador-panel' + (esTurno ? ' turno-activo' : '') + (estadoJ === 'eliminado' ? ' eliminado' : estadoJ === 'ganador' ? ' ganador' : estadoJ === 'perdedor' ? ' perdedor' : '');
              var esMio = j.uid === currentUser.uid;

              return '<div class="' + clasePanel + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem">' +
                  '<p style="font-size:0.8rem;font-weight:700;color:' + (esTurno ? 'var(--accent)' : 'var(--text-primary)') + '">' +
                    (esTurno ? '▶️ ' : '') + j.username +
                    (estadoJ === 'plantado' ? ' 🛑' : estadoJ === 'eliminado' ? ' 💀' : '') +
                  '</p>' +
                  (j.cartas && j.cartas.length > 0 && (esMio || sala.estado === 'resultado' || sala.estado === 'casino')
                    ? '<span class="bj-puntos">' + puntos + ' pts</span>'
                    : ''
                  ) +
                '</div>' +
                '<div class="bj-mano">' +
                  (j.cartas && j.cartas.length > 0
                    ? j.cartas.map(function(c) {
                        // Solo mostrar cartas propias, resto ocultas hasta resultado
                        if (!esMio && sala.estado !== 'resultado' && sala.estado !== 'casino') {
                          return renderCartaSVG({ oculta: true }, false, false);
                        }
                        return renderCartaSVG(c, false, false);
                      }).join('')
                    : '<p style="color:var(--text-secondary);font-size:0.75rem">Sin cartas</p>'
                  ) +
                '</div>' +
                // Mis acciones si es mi turno
                (esMiTurno && esMio && estadoJ === 'jugando'
                  ? '<div class="bj-acciones">' +
                      '<button class="bj-btn-pedir" id="btn-bj-pedir">🃏 Pedir carta</button>' +
                      '<button class="bj-btn-plantar" id="btn-bj-plantar">🛑 Plantarme</button>' +
                    '</div>'
                  : ''
                ) +
              '</div>';
            }).join('')
          : '<p style="color:var(--text-secondary);text-align:center;padding:1rem">Sin jugadores</p>'
        ) +
      '</div>' +

      // Estado / Timer
      '<div style="margin-top:0.5rem">' +
        renderEstadoBJ(sala, miModo, esMiTurno) +
      '</div>' +

      // Ranking
      '<div style="background:var(--bg-card);border-radius:10px;padding:0.6rem;margin-top:0.5rem">' +
        '<p style="font-size:0.72rem;color:var(--text-secondary);font-weight:700;margin-bottom:0.4rem">📊 RANKING SESIÓN</p>' +
        (sala.jugadores && sala.jugadores.length > 0
          ? sala.jugadores.slice().sort(function(a,b) { return (b.neto||0)-(a.neto||0); }).map(function(j,idx) {
              return '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:0.2rem 0">' +
                '<span>' + (idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':'  ') + ' ' + j.username + '</span>' +
                '<span style="color:' + ((j.neto||0)>=0?'var(--success)':'var(--danger)') + ';font-weight:700">£' + (j.neto||0).toLocaleString('es-CO') + '</span>' +
              '</div>';
            }).join('')
          : '<p style="font-size:0.72rem;color:var(--text-secondary)">Sin datos</p>'
        ) +
      '</div>' +

      // Espectador
      (miModo === 'espectador'
        ? '<div style="text-align:center;padding:0.5rem;background:var(--bg-card);border-radius:10px;margin-top:0.5rem">' +
            '<p style="color:var(--text-secondary);font-size:0.82rem">👁️ Modo espectador' + (yoEspectador && yoEspectador.modoFuturo === 'espectador_a_jugador' ? ' — Entrarás en la próxima ronda' : '') + '</p>' +
          '</div>'
        : ''
      );

    document.getElementById('btn-salir-bj').addEventListener('click', function() {
      salirSalaBJ(salaId, miModo, sala);
    });

    // Acciones del turno
    setTimeout(function() {
      var btnPedir = document.getElementById('btn-bj-pedir');
      var btnPlantar = document.getElementById('btn-bj-plantar');
      if (btnPedir) btnPedir.addEventListener('click', function() { accionBJ(salaId, sala, 'pedir'); });
      if (btnPlantar) btnPlantar.addEventListener('click', function() { accionBJ(salaId, sala, 'plantar'); });
      manejarTimerBJ(salaId, sala);
      manejarEstadoBJ(salaId, sala);
    }, 100);
  });
}

function renderEstadoBJ(sala, miModo, esMiTurno) {
  switch(sala.estado) {
    case 'esperando':
      return '<div style="text-align:center;padding:0.75rem;background:var(--bg-card);border-radius:10px"><p style="color:var(--text-secondary)">⏳ Esperando jugadores...</p></div>';
    case 'lobby':
      return '<div style="text-align:center;padding:0.75rem;background:var(--bg-card);border-radius:10px">' +
        '<p style="color:var(--accent);font-weight:700">🃏 Iniciando partida...</p>' +
        '<p style="font-size:0.78rem;color:var(--text-secondary)">Repartiendo cartas</p>' +
      '</div>';
    case 'turnos':
      return esMiTurno
        ? '<div style="text-align:center;padding:0.5rem;background:rgba(233,69,96,0.1);border-radius:10px;border:1px solid var(--accent)">' +
            '<p style="color:var(--accent);font-weight:700;font-size:0.85rem">¡Es tu turno!</p>' +
            '<p id="bj-timer-display" class="bj-timer">15</p>' +
          '</div>'
        : '<div style="text-align:center;padding:0.5rem;background:var(--bg-card);border-radius:10px">' +
            '<p style="color:var(--text-secondary);font-size:0.82rem">Esperando turno...</p>' +
          '</div>';
    case 'casino':
      return '<div style="text-align:center;padding:0.75rem;background:rgba(0,100,50,0.2);border-radius:10px;border:1px solid #2ecc71">' +
        '<p style="color:#2ecc71;font-weight:700">🏦 Turno del casino...</p>' +
      '</div>';
    case 'resultado':
      return '<div style="text-align:center;padding:0.75rem;background:var(--bg-card);border-radius:10px">' +
        '<p style="color:var(--accent);font-weight:700">🏆 ¡Ronda terminada!</p>' +
        '<p style="font-size:0.75rem;color:var(--text-secondary)">Nueva ronda en breve...</p>' +
      '</div>';
    default:
      return '';
  }
}

function manejarEstadoBJ(salaId, sala) {
  // Solo el primer jugador de la lista maneja los estados automáticos
  var jugadores = sala.jugadores || [];
  if (!jugadores.length) return;
  var primerJugador = jugadores[0];
  var soyPrimero = primerJugador.uid === currentUser.uid;

  if (sala.estado === 'lobby' && soyPrimero) {
    setTimeout(function() { iniciarRondaBJ(salaId, sala); }, 1500);
  }

  if (sala.estado === 'casino' && soyPrimero) {
    setTimeout(function() { turnosCasinoBJ(salaId); }, 1000);
  }
}

async function iniciarRondaBJ(salaId, sala) {
  var snapActual = await getDoc(doc(db, 'blackjack_salas', salaId));
  if (!snapActual.exists()) return;
  var salaActual = snapActual.data();
  if (salaActual.estado !== 'lobby') return;

  var mazo = crearMazo();
  var jugadores = salaActual.jugadores || [];

  // Repartir 2 cartas a cada jugador y al casino
  var jugadoresConCartas = jugadores.map(function(j) {
    return Object.assign({}, j, {
      cartas: [mazo.pop(), mazo.pop()],
      estado: 'jugando'
    });
  });

  var cartasCasino = [mazo.pop(), Object.assign(mazo.pop(), { oculta: true })];

  // Orden de turnos aleatorio
  var orden = jugadores.map(function(j) { return j.uid; });
  for (var i = orden.length - 1; i > 0; i--) {
    var j2 = Math.floor(Math.random() * (i + 1));
    var tmp = orden[i]; orden[i] = orden[j2]; orden[j2] = tmp;
  }

  // Verificar blackjack naturales
  var naturales = jugadoresConCartas.filter(function(j) { return esBlackjackNatural(j.cartas); });
  naturales.forEach(function(j) { j.estado = 'blackjack'; });

  await updateDoc(doc(db, 'blackjack_salas', salaId), {
    estado: 'turnos',
    mazo: mazo,
    jugadores: jugadoresConCartas,
    cartasCasino: cartasCasino,
    ordenTurnos: orden,
    turnoActual: 0,
    plantados: [],
    eliminados: [],
    timerInicio: new Date().toISOString()
  });

  // Si todos tienen blackjack natural, ir directo a resultado
  if (naturales.length === jugadores.length) {
    setTimeout(function() { resolverRondaBJ(salaId); }, 1000);
  }
}

async function accionBJ(salaId, sala, accion) {
  if (bjTimerInterval) { clearInterval(bjTimerInterval); bjTimerInterval = null; }

  var snapActual = await getDoc(doc(db, 'blackjack_salas', salaId));
  if (!snapActual.exists()) return;
  var salaActual = snapActual.data();
  if (salaActual.estado !== 'turnos') return;

  var ordenTurnos = salaActual.ordenTurnos || [];
  var turnoIdx = salaActual.turnoActual || 0;
  var uidEnTurno = ordenTurnos[turnoIdx];
  if (uidEnTurno !== currentUser.uid) return;

  var mazo = salaActual.mazo || [];
  var jugadores = salaActual.jugadores.map(function(j) { return Object.assign({}, j); });
  var yoIdx = jugadores.findIndex(function(j) { return j.uid === currentUser.uid; });
  var yo = jugadores[yoIdx];

  if (accion === 'pedir') {
    if (mazo.length === 0) mazo = crearMazo();
    var nuevaCarta = mazo.pop();
    yo.cartas = yo.cartas.concat([nuevaCarta]);
    var puntos = calcularMano(yo.cartas);

    if (puntos > 21) {
      yo.estado = 'eliminado';
      jugadores[yoIdx] = yo;
      var update = { jugadores: jugadores, mazo: mazo };
      update = Object.assign(update, avanzarTurnoBJ(salaActual, turnoIdx, ordenTurnos, jugadores));
      await updateDoc(doc(db, 'blackjack_salas', salaId), update);
    } else if (puntos === 21) {
      yo.estado = 'plantado';
      jugadores[yoIdx] = yo;
      var update2 = { jugadores: jugadores, mazo: mazo };
      update2 = Object.assign(update2, avanzarTurnoBJ(salaActual, turnoIdx, ordenTurnos, jugadores));
      await updateDoc(doc(db, 'blackjack_salas', salaId), update2);
    } else {
      jugadores[yoIdx] = yo;
      await updateDoc(doc(db, 'blackjack_salas', salaId), {
        jugadores: jugadores, mazo: mazo,
        timerInicio: new Date().toISOString()
      });
    }
  } else {
    yo.estado = 'plantado';
    jugadores[yoIdx] = yo;
    var update3 = { jugadores: jugadores };
    update3 = Object.assign(update3, avanzarTurnoBJ(salaActual, turnoIdx, ordenTurnos, jugadores));
    await updateDoc(doc(db, 'blackjack_salas', salaId), update3);
  }
}

function avanzarTurnoBJ(sala, turnoIdx, ordenTurnos, jugadores) {
  // Buscar siguiente jugador que no esté eliminado/plantado/blackjack
  var siguiente = turnoIdx + 1;
  while (siguiente < ordenTurnos.length) {
    var uid = ordenTurnos[siguiente];
    var jug = jugadores.find(function(j) { return j.uid === uid; });
    if (jug && jug.estado === 'jugando') break;
    siguiente++;
  }

  if (siguiente >= ordenTurnos.length) {
    // Todos terminaron, turno del casino
    return { estado: 'casino', turnoActual: siguiente };
  }

  return { turnoActual: siguiente, timerInicio: new Date().toISOString() };
}

async function turnosCasinoBJ(salaId) {
  var snapActual = await getDoc(doc(db, 'blackjack_salas', salaId));
  if (!snapActual.exists()) return;
  var salaActual = snapActual.data();
  if (salaActual.estado !== 'casino') return;

  var mazo = salaActual.mazo || [];
  if (mazo.length === 0) mazo = crearMazo();

  // Revelar carta oculta
  var cartasCasino = salaActual.cartasCasino.map(function(c) {
    return Object.assign({}, c, { oculta: false });
  });

  await updateDoc(doc(db, 'blackjack_salas', salaId), { cartasCasino: cartasCasino });
  await new Promise(function(r) { setTimeout(r, 1000); });

  // Casino pide cartas según reglas
  var puntosCasino = calcularMano(cartasCasino);
  while (puntosCasino <= 16) {
    if (mazo.length === 0) mazo = crearMazo();
    cartasCasino = cartasCasino.concat([mazo.pop()]);
    puntosCasino = calcularMano(cartasCasino);
    await updateDoc(doc(db, 'blackjack_salas', salaId), { cartasCasino: cartasCasino, mazo: mazo });
    await new Promise(function(r) { setTimeout(r, 800); });
  }

  await updateDoc(doc(db, 'blackjack_salas', salaId), { cartasCasino: cartasCasino, mazo: mazo });
  setTimeout(function() { resolverRondaBJ(salaId); }, 800);
}

async function resolverRondaBJ(salaId) {
  var snap = await getDoc(doc(db, 'blackjack_salas', salaId));
  if (!snap.exists()) return;
  var sala = snap.data();
  var jugadores = sala.jugadores || [];
  var apuesta = sala.apuesta;
  var cartasCasino = sala.cartasCasino || [];
  var puntosCasino = calcularMano(cartasCasino);
  var casinoBJ = esBlackjackNatural(cartasCasino);
  var casinoSePaso = puntosCasino > 21;

  // Clasificar jugadores
  var perdedores = [];
  var ganadores = [];
  var empatados = [];
  var naturales = [];

  jugadores.forEach(function(j) {
    var puntos = calcularMano(j.cartas || []);
    var jBJ = esBlackjackNatural(j.cartas || []);

    if (j.estado === 'eliminado' || puntos > 21) {
      perdedores.push(j);
    } else if (jBJ && !casinoBJ) {
      naturales.push(j);
    } else if (casinoBJ && !jBJ) {
      perdedores.push(j);
    } else if (casinoSePaso) {
      ganadores.push(j);
    } else if (puntos > puntosCasino) {
      ganadores.push(j);
    } else if (puntos === puntosCasino) {
      empatados.push(j);
    } else {
      perdedores.push(j);
    }
  });

  // Calcular pozo
  var pozoTotal = perdedores.length * apuesta;
  var cambios = {};
  jugadores.forEach(function(j) { cambios[j.uid] = 0; });

  // Perdedores pierden su apuesta
  perdedores.forEach(function(j) { cambios[j.uid] = -apuesta; });

  // Empatados no ganan ni pierden
  empatados.forEach(function(j) { cambios[j.uid] = 0; });

  // Ganadores se reparten el pozo
  if (ganadores.length > 0 && pozoTotal > 0) {
    var parteGanador = Math.floor(pozoTotal / ganadores.length);
    ganadores.forEach(function(j) { cambios[j.uid] = parteGanador; });
  }

  // Naturales: mitad del pozo + 50% extra del casino
  if (naturales.length > 0) {
    var parteNatural = pozoTotal > 0 ? Math.floor(pozoTotal / naturales.length) : 0;
    naturales.forEach(function(j) {
      var extra = Math.floor(apuesta * 0.5);
      cambios[j.uid] = parteNatural + extra;
    });
  }

  // Actualizar jugadores con estados finales
  var jugadoresActualizados = jugadores.map(function(j) {
    var cambio = cambios[j.uid] || 0;
    var estadoFinal = perdedores.find(function(p) { return p.uid === j.uid; }) ? 'perdedor'
      : ganadores.find(function(g) { return g.uid === j.uid; }) ? 'ganador'
      : naturales.find(function(n) { return n.uid === j.uid; }) ? 'ganador'
      : 'empate';
    return Object.assign({}, j, {
      estado: estadoFinal,
      ganado: (j.ganado || 0) + (cambio > 0 ? cambio : 0),
      perdido: (j.perdido || 0) + (cambio < 0 ? Math.abs(cambio) : 0),
      neto: (j.neto || 0) + cambio
    });
  });

  // Aplicar cambios de saldo
  for (var i = 0; i < jugadoresActualizados.length; i++) {
    var j = jugadoresActualizados[i];
    var cambio = cambios[j.uid] || 0;
    if (cambio === 0) continue;
    try {
      await updateDoc(doc(db, 'usuarios', j.uid), { saldo: increment(cambio) });
      if (j.uid === currentUser.uid) currentUser.saldo = (currentUser.saldo || 0) + cambio;
      await registrarTransaccion({
        tipo: 'casino_blackjack',
        de: cambio < 0 ? j.uid : 'sistema',
        deUsername: cambio < 0 ? j.username : 'Casino Blackjack',
        para: cambio >= 0 ? j.uid : 'sistema',
        paraUsername: cambio >= 0 ? j.username : 'Casino Blackjack',
        monto: Math.abs(cambio),
        descripcion: 'Blackjack: ' + j.username + (cambio >= 0 ? ' ganó' : ' perdió') + ' £' + Math.abs(cambio).toLocaleString('es-CO')
      });
    } catch(err) { console.log('Error saldo BJ:', err.message); }
  }

  await updateDoc(doc(db, 'blackjack_salas', salaId), {
    estado: 'resultado',
    jugadores: jugadoresActualizados,
    cartasCasino: cartasCasino
  });

  // Nueva ronda automáticamente
  setTimeout(async function() {
    var snapNuevo = await getDoc(doc(db, 'blackjack_salas', salaId));
    if (!snapNuevo.exists()) return;
    var salaNueva = snapNuevo.data();
    if (salaNueva.estado !== 'resultado') return;

    // Convertir espectadores_a_jugador
    var espectadoresRestantes = [];
    var jugadoresNuevos = (salaNueva.jugadores || []).map(function(j) {
      return Object.assign({}, j, { cartas: [], estado: 'esperando' });
    });

    for (var k = 0; k < (salaNueva.espectadores || []).length; k++) {
      var esp = salaNueva.espectadores[k];
      if (esp.modoFuturo === 'espectador_a_jugador' && jugadoresNuevos.length < salaNueva.capacidad) {
        var snapUser = await getDoc(doc(db, 'usuarios', esp.uid));
        var saldoEsp = snapUser.exists() ? (snapUser.data().saldo || 0) : 0;
        if (saldoEsp >= salaNueva.apuesta) {
          jugadoresNuevos.push({
            uid: esp.uid, username: esp.username,
            foto: esp.foto || '', cartas: [],
            ganado: 0, perdido: 0, neto: 0, estado: 'esperando'
          });
        } else {
          espectadoresRestantes.push(Object.assign({}, esp, { modoFuturo: 'espectador' }));
        }
      } else {
        espectadoresRestantes.push(esp);
      }
    }

    var nuevoEstado = jugadoresNuevos.length >= 1 ? 'lobby' : 'esperando';
    await updateDoc(doc(db, 'blackjack_salas', salaId), {
      estado: nuevoEstado,
      jugadores: jugadoresNuevos,
      espectadores: espectadoresRestantes,
      cartasCasino: [],
      mazo: [],
      ordenTurnos: [],
      turnoActual: 0,
      lobbyInicio: new Date().toISOString()
    });
  }, 4000);
}

function manejarTimerBJ(salaId, sala) {
  if (bjTimerInterval) { clearInterval(bjTimerInterval); bjTimerInterval = null; }
  if (sala.estado !== 'turnos') return;

  var ordenTurnos = sala.ordenTurnos || [];
  var turnoIdx = sala.turnoActual || 0;
  var uidEnTurno = ordenTurnos[turnoIdx];
  if (uidEnTurno !== currentUser.uid) return;

  var tiempoInicio = sala.timerInicio ? new Date(sala.timerInicio).getTime() : Date.now();

  bjTimerInterval = setInterval(async function() {
    var transcurrido = Math.floor((Date.now() - tiempoInicio) / 1000);
    var restante = Math.max(0, 15 - transcurrido);
    var timerEl = document.getElementById('bj-timer-display');
    if (timerEl) timerEl.textContent = restante;

    if (restante <= 0) {
      clearInterval(bjTimerInterval); bjTimerInterval = null;
      // Acción aleatoria automática
      var accion = Math.random() < 0.5 ? 'pedir' : 'plantar';
      await accionBJ(salaId, sala, accion);
    }
  }, 1000);
}

async function salirSalaBJ(salaId, modo, sala) {
  if (bjListener) { bjListener(); bjListener = null; }
  if (bjTimerInterval) { clearInterval(bjTimerInterval); bjTimerInterval = null; }

  if (modo === 'jugador') {
    var nuevosJugadores = (sala.jugadores || []).filter(function(j) { return j.uid !== currentUser.uid; });
    var update = { jugadores: nuevosJugadores };
    if (nuevosJugadores.length === 0) {
      update.estado = 'esperando';
      update.cartasCasino = [];
      update.mazo = [];
      update.ordenTurnos = [];
    }
    await updateDoc(doc(db, 'blackjack_salas', salaId), update);
  } else {
    var nuevosEsp = (sala.espectadores || []).filter(function(e) { return e.uid !== currentUser.uid; });
    await updateDoc(doc(db, 'blackjack_salas', salaId), { espectadores: nuevosEsp });
  }

  bjSalaActualId = null;
  renderBlackjack();
}

async function convertirEspectadorAJugadorBJ(salaId, sala) {
  var nuevosEsp = (sala.espectadores || []).filter(function(e) { return e.uid !== currentUser.uid; });
  var saldo = currentUser.saldo || 0;
  if (saldo < sala.apuesta) {
    await updateDoc(doc(db, 'blackjack_salas', salaId), { espectadores: nuevosEsp });
    return;
  }
  var nuevosJugadores = (sala.jugadores || []).concat([{
    uid: currentUser.uid, username: currentUser.username,
    foto: currentUser.fotoPerfil || '',
    cartas: [], ganado: 0, perdido: 0, neto: 0, estado: 'esperando'
  }]);
  var update = { jugadores: nuevosJugadores, espectadores: nuevosEsp };
  if (sala.estado === 'esperando') { update.estado = 'lobby'; update.lobbyInicio = new Date().toISOString(); }
  await updateDoc(doc(db, 'blackjack_salas', salaId), update);
}

function showError(msg) { loginError.textContent = msg; loginError.classList.remove('hidden'); }
function hideError() { loginError.classList.add('hidden'); }