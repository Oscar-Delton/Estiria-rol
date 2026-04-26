// Importamos Firebase desde CDN (no necesita npm)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBFQ3R0cFt9-0t6Mv5ZBsaoBb6-B5tN4os",
    authDomain: "estiria-rol.firebaseapp.com",
      projectId: "estiria-rol",
        storageBucket: "estiria-rol.firebasestorage.app",
          messagingSenderId: "2513815308",
            appId: "1:2513815308:web:f706629fd0fc2f3ed82b29"
            };

            // Inicializar Firebase
            const app = initializeApp(firebaseConfig);

            // Exportar servicios para usar en el resto de la app
            export const db = getFirestore(app);
            export const auth = getAuth(app);
            export default app;