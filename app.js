import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCja_u7pHTeT5nqWCFUtqP9H1dYXmvRcks",
  authDomain: "crm-base-249a8.firebaseapp.com",
  projectId: "crm-base-249a8",
  storageBucket: "crm-base-249a8.firebasestorage.app",
  messagingSenderId: "842519637385",
  appId: "1:842519637385:web:730662c5aa45d396964558"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let isLoginMode = true;

const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const authBtn = document.getElementById('authBtn');
const authError = document.getElementById('authError');
const toggleMode = document.getElementById('toggleMode');

// 1. ПРОВЕРКА ВХОДА (Запоминает пользователя)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        renderOrders();
    } else {
        loginScreen.style.display = 'block';
        mainApp.style.display = 'none';
    }
});

// 2. ЛОГИКА ВХОДА И РЕГИСТРАЦИИ
toggleMode.onclick = (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    document.getElementById('authTitle').innerText = isLoginMode ? "Вход в CRM" : "Регистрация";
    authBtn.innerText = isLoginMode ? "Войти" : "Создать аккаунт";
    document.getElementById('toggleText').innerText = isLoginMode ? "Нет аккаунта?" : "Уже есть аккаунт?";
    toggleMode.innerText = isLoginMode ? "Создать" : "Войти";
};

authBtn.onclick = async () => {
    const phone = document.getElementById('phoneInput').value.trim();
    const pass = document.getElementById('passwordInput').value.trim();
    if (phone.length < 10 || pass.length < 6) return alert("Введите корректные данные");

    const email = phone + "@crm.com";
    authBtn.disabled = true;

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await setDoc(doc(db, "users", res.user.uid), { phone, role: "seller" });
        }
    } catch (err) {
        authError.innerText = "Ошибка: проверьте данные";
        authError.style.display = "block";
    }
    authBtn.disabled = false;
};

// 3. ПОЛУЧЕНИЕ ЗАКАЗОВ
async function renderOrders(filterText = "") {
    const container = document.getElementById('appContent');
    const q = query(collection(db, "orders"), where("sellerId", "==", currentUser.uid));
    const snap = await getDocs(q);
    
    let orders = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() }));

    if (filterText) {
        const s = filterText.toLowerCase();
        orders = orders.filter(o => 
            o.customerName.toLowerCase().includes(s) || 
            o.customerPhone.includes(s) || 
            o.ttn?.includes(s)
        );
    }

    container.innerHTML = orders.length ? orders.map(o => `
        <div class="card">
            <strong>${o.customerName}</strong> <span style="float:right">${o.totalPrice} грн</span><br>
            <small>${o.customerPhone}</small>
            <div class="timeline">
                • Создано: ${o.createdAt}<br>
                ${o.ttn ? `• ТТН: ${o.ttn} (${o.status})` : '• Ожидает отправки'}
            </div>
        </div>
    `).join('') : '<p style="text-align:center">Заказов пока нет</p>';
}

document.getElementById('universalSearch').oninput = (e) => renderOrders(e.target.value);