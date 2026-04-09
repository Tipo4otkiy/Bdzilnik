import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Додано export для конфігу
export const firebaseConfig = {
    apiKey: "AIzaSyCja_u7pHTeT5nqWCFUtqP9H1dYXmvRcks",
    authDomain: "crm-base-249a8.firebaseapp.com",
    projectId: "crm-base-249a8",
    storageBucket: "crm-base-249a8.firebasestorage.app",
    messagingSenderId: "842519637385",
    appId: "1:842519637385:web:730662c5aa45d396964558"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);