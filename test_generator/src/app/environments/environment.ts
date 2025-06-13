import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";


export const enviroment = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
};

const app = initializeApp(enviroment);

// Exportar Firestore, Storage y Auth
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
