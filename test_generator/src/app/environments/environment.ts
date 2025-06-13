import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";


export const enviroment = {
    apiKey: "AIzaSyD78KCszHNZOAaYmMHbWBQiJ3pdTkDyDos",
    authDomain: "b25-examenes.firebaseapp.com",
    projectId: "b25-examenes",
    storageBucket: "b25-examenes.firebasestorage.app",
    messagingSenderId: "1022556442367",
    appId: "1:1022556442367:web:b038b4af6e103e242046ca",
    measurementId: "G-ZTHP3M6TZ6"
};

const app = initializeApp(enviroment);

// Exportar Firestore, Storage y Auth
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
