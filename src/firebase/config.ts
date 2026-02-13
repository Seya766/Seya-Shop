import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC2Id4VWXAIZnVMwu_y5EA2PHoS8oPB_cc",
  authDomain: "see3-a2d24.firebaseapp.com",
  projectId: "see3-a2d24",
  storageBucket: "see3-a2d24.firebasestorage.app",
  messagingSenderId: "167183009346",
  appId: "1:167183009346:web:e71d3a57420225298dcfdb",
  measurementId: "G-M1HC7QTTJR"
};

const app = initializeApp(firebaseConfig);
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const auth = getAuth(app);

// ⚠️ TEMPORAL: Forzar el userId correcto con tus datos
const CORRECT_USER_ID = 'T8lrzfd7vFfab9SXAgMjl1AIHv33';

export const initAuth = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Verificar si hay un override en localStorage
    const forceUserId = localStorage.getItem('FORCE_USER_ID');
    if (forceUserId) {
      console.log('🔓 Usando userId forzado desde localStorage:', forceUserId);
      resolve(forceUserId);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        // Si el usuario actual NO es el correcto, forzar el correcto
        if (user.uid !== CORRECT_USER_ID) {
          console.log('⚠️ Usuario incorrecto detectado:', user.uid);
          console.log('✅ Forzando usuario correcto:', CORRECT_USER_ID);
          localStorage.setItem('FORCE_USER_ID', CORRECT_USER_ID);
          resolve(CORRECT_USER_ID);
        } else {
          console.log('✅ Usuario correcto ya autenticado:', user.uid);
          resolve(user.uid);
        }
      } else {
        try {
          const result = await signInAnonymously(auth);
          // Después de autenticar, forzar el userId correcto
          console.log('⚠️ Nuevo usuario creado:', result.user.uid);
          console.log('✅ Forzando usuario correcto:', CORRECT_USER_ID);
          localStorage.setItem('FORCE_USER_ID', CORRECT_USER_ID);
          resolve(CORRECT_USER_ID);
        } catch (error) {
          reject(error);
        }
      }
    });
  });
};

export default app;