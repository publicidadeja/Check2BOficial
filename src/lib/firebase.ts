// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider, AppCheck } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let authInstance: Auth | null = null;
let appCheckInstance: AppCheck | null = null;

const requiredConfigKeysForInit: (keyof typeof firebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
];

// This function now encapsulates the entire initialization logic for clarity.
const initializeFirebaseServices = () => {
    if (typeof window === 'undefined') {
        console.log("[Firebase Lib] Skipping client-side Firebase initialization (not in browser).");
        return;
    }

    console.log("[Firebase Lib] Running in browser environment.");

    const allRequiredPresent = requiredConfigKeysForInit.every(key => firebaseConfig[key]);

    if (!allRequiredPresent) {
        const missingCriticalKeys = requiredConfigKeysForInit.filter(key => !firebaseConfig[key]);
        console.error("[Firebase Lib] Firebase Web App initialization SKIPPED due to missing CRITICAL configuration keys:", missingCriticalKeys.join(', '));
        // alert(`Erro de configuração do Firebase: Chaves CRÍTICAS ausentes: ${missingCriticalKeys.join(', ')}. Verifique suas variáveis de ambiente e recarregue a página.`);
        return;
    }

    try {
        if (!getApps().length) {
            console.log("[Firebase Lib] Initializing Firebase app for project:", firebaseConfig.projectId);
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp();
            console.log("[Firebase Lib] Firebase app already initialized for project:", app.options.projectId);
        }

        if (app) {
            // Initialize services immediately after app is available
            db = getFirestore(app);
            authInstance = getAuth(app);

            // --- APP CHECK INITIALIZATION ---
            // Only initialize App Check once.
            if (!appCheckInstance) {
                const urlParams = new URLSearchParams(window.location.search);
                const debugTokenFromUrl = urlParams.get('appCheckDebugToken');

                if (debugTokenFromUrl) {
                    // This is the CRITICAL path for the Flutter WebView in debug mode.
                    console.log("[Firebase Lib] App Check: Using CustomProvider with DEBUG TOKEN from URL.");
                    // Assign the token to window for persistence across re-renders in dev mode
                    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugTokenFromUrl;
                    appCheckInstance = initializeAppCheck(app, {
                        provider: new CustomProvider({
                            getToken: () => Promise.resolve({
                                token: debugTokenFromUrl,
                                expireTimeMillis: Date.now() + 60 * 60 * 1000, // 1 hour
                            }),
                        }),
                        isTokenAutoRefreshEnabled: false // No need to refresh a static debug token
                    });
                } else if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN) {
                    // This is for local web development (`localhost`)
                    console.log("[Firebase Lib] App Check: Using CustomProvider with DEBUG TOKEN from environment variables for localhost.");
                    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
                    appCheckInstance = initializeAppCheck(app, {
                        provider: new CustomProvider({
                           getToken: () => Promise.resolve({
                                token: process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN!,
                                expireTimeMillis: Date.now() + 60 * 60 * 1000, // 1 hour
                            }),
                        }),
                        isTokenAutoRefreshEnabled: false
                    });
                } else if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
                    // This is for PRODUCTION environment
                    console.log("[Firebase Lib] App Check: Initializing with ReCaptcha for PRODUCTION.");
                    appCheckInstance = initializeAppCheck(app, {
                        provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
                        isTokenAutoRefreshEnabled: true
                    });
                } else {
                    console.error("[Firebase Lib CRITICAL] App Check NOT INITIALIZED. ReCaptcha key is missing for production, and no debug token was provided.");
                }
            }

            console.log("[Firebase Lib] Firebase App, Firestore, and Auth setup completed.");
        }

    } catch (error) {
        console.error("[Firebase Lib] Firebase initialization failed:", error);
        // alert("Falha ao inicializar a conexão com o servidor. Verifique a configuração do Firebase e o console (F12).");
    }
};

// Run initialization logic immediately upon import on the client-side.
initializeFirebaseServices();


export const getFirebaseApp = (): FirebaseApp | null => {
    if (!app && typeof window !== 'undefined' && getApps().length > 0) {
        app = getApp();
    }
    return app;
};

export const getDb = (): Firestore | null => {
    // No need to re-initialize here, it's handled above.
    return db;
}

export const getAuthInstance = (): Auth | null => {
    // No need to re-initialize here.
    return authInstance;
}

export const getAppCheckInstance = (): AppCheck | null => {
    // No need to re-initialize here.
    return appCheckInstance;
}
