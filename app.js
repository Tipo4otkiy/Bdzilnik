import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
let userPresets = []; // Список товаров из настроек

// --- АВТОРИЗАЦИЯ ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const phone = user.email.split('@')[0];
        document.getElementById('displayUserName').innerText = phone;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        await loadSettings();
        renderOrders();
    } else {
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
});

document.getElementById('authBtn').onclick = async () => {
    const p = document.getElementById('phoneInput').value.trim();
    const s = document.getElementById('passwordInput').value.trim();
    try { await signInWithEmailAndPassword(auth, p + "@crm.com", s); } catch(e) { alert("Ошибка входа"); }
};

document.getElementById('logoutBtn').onclick = () => signOut(auth);

// --- НАСТРОЙКИ И ПРЕСЕТЫ ---
const settingsModal = document.getElementById('settingsModal');
document.getElementById('openSettingsBtn').onclick = () => settingsModal.style.display = 'flex';
document.getElementById('closeSettingsBtn').onclick = () => settingsModal.style.display = 'none';

async function loadSettings() {
    const d = await getDoc(doc(db, "users", currentUser.uid));
    if (d.exists() && d.data().presets) {
        userPresets = d.data().presets;
        renderPresetsUI();
    }
}

function renderPresetsUI() {
    const container = document.getElementById('presetsList');
    container.innerHTML = userPresets.map((p, i) => `
        <div class="preset-item">
            <input type="text" value="${p.name}" placeholder="Название" class="p-name" data-idx="${i}">
            <input type="number" value="${p.price}" placeholder="Цена" class="p-price" data-idx="${i}" style="width:100px">
            <button class="btn-danger" onclick="this.parentElement.remove()">✕</button>
        </div>
    `).join('');
}

document.getElementById('addPresetBtn').onclick = () => {
    const div = document.createElement('div');
    div.className = 'preset-item';
    div.innerHTML = `<input type="text" placeholder="Название" class="p-name"> <input type="number" placeholder="Цена" class="p-price" style="width:100px"> <button class="btn-danger" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById('presetsList').appendChild(div);
};

document.getElementById('saveSettingsBtn').onclick = async () => {
    const newPresets = [];
    document.querySelectorAll('.preset-item').forEach(row => {
        const n = row.querySelector('.p-name').value;
        const p = row.querySelector('.p-price').value;
        if(n) newPresets.push({ name: n, price: parseFloat(p) || 0 });
    });
    await setDoc(doc(db, "users", currentUser.uid), { presets: newPresets }, { merge: true });
    userPresets = newPresets;
    alert("Сохранено!");
    settingsModal.style.display = 'none';
};

// --- СОЗДАНИЕ ЗАКАЗА ---
const orderModal = document.getElementById('orderModal');
document.getElementById('fabBtn').onclick = () => {
    document.getElementById('itemsContainer').innerHTML = '<strong>Товары:</strong>';
    addItemRow();
    orderModal.style.display = 'flex';
};

function addItemRow() {
    const row = document.createElement('div');
    row.className = 'item-row';
    
    // Создаем выпадающий список из пресетов + возможность своего ввода
    let options = userPresets.map(p => `<option value="${p.name}" data-price="${p.price}">${p.name} (${p.price} грн)</option>`).join('');
    
    row.innerHTML = `
        <input type="text" list="presetData" placeholder="Товар" class="i-name" style="flex:2">
        <datalist id="presetData">${options}</datalist>
        <input type="number" placeholder="К-во" class="i-qty" value="1" style="flex:0.8">
        <input type="number" placeholder="Цена" class="i-price" style="flex:1.2">
        <button class="btn-danger" style="width:40px">✕</button>
    `;

    // Автоподстановка цены
    row.querySelector('.i-name').addEventListener('input', (e) => {
        const found = userPresets.find(p => p.name === e.target.value);
        if (found) row.querySelector('.i-price').value = found.price;
        calculateTotal();
    });

    row.querySelectorAll('input').forEach(i => i.oninput = calculateTotal);
    row.querySelector('.btn-danger').onclick = () => { row.remove(); calculateTotal(); };
    
    document.getElementById('itemsContainer').appendChild(row);
}

document.getElementById('addItemBtn').onclick = addItemRow;

function calculateTotal() {
    let t = 0;
    document.querySelectorAll('.item-row').forEach(r => {
        const q = parseFloat(r.querySelector('.i-qty').value) || 0;
        const p = parseFloat(r.querySelector('.i-price').value) || 0;
        t += q * p;
    });
    document.getElementById('orderTotal').innerText = t + ' грн';
    return t;
}

// Поиск клиента
document.getElementById('newPhone').onblur = async (e) => {
    const p = e.target.value.trim();
    if(p.length > 9) {
        const d = await getDoc(doc(db, "clients", p));
        if(d.exists()) document.getElementById('newName').value = d.data().name;
    }
};

document.getElementById('saveOrderBtn').onclick = async () => {
    const phone = document.getElementById('newPhone').value.trim();
    const name = document.getElementById('newName').value.trim();
    if(!phone || !name) return alert("Заполни данные");

    const items = [];
    document.querySelectorAll('.item-row').forEach(r => {
        items.push({ name: r.querySelector('.i-name').value, qty: r.querySelector('.i-qty').value, price: r.querySelector('.i-price').value });
    });

    await addDoc(collection(db, "orders"), {
        sellerId: currentUser.uid,
        customerPhone: phone,
        customerName: name,
        address: document.getElementById('newAddress').value,
        items: items,
        totalPrice: calculateTotal(),
        status: "Новый",
        createdAt: Date.now()
    });
    
    await setDoc(doc(db, "clients", phone), { name }, { merge: true });
    orderModal.style.display = 'none';
    renderOrders();
};

async function renderOrders(filter = "") {
    const container = document.getElementById('appContent');
    const q = query(collection(db, "orders"), where("sellerId", "==", currentUser.uid));
    const snap = await getDocs(q);
    let list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));

    if(filter) {
        const f = filter.toLowerCase();
        list = list.filter(o => o.customerName.toLowerCase().includes(f) || o.customerPhone.includes(f));
    }

    container.innerHTML = list.sort((a,b) => b.createdAt - a.createdAt).map(o => `
        <div class="card">
            <div style="display:flex; justify-content:space-between">
                <b>${o.customerName}</b>
                <span style="color:#ffca28">${o.totalPrice} грн</span>
            </div>
            <div style="font-size:12px; color:#666">${o.customerPhone}</div>
            <div style="font-size:13px; margin:5px 0">${o.items.map(i => i.name).join(', ')}</div>
            <div style="font-size:11px; border-top:1px solid #eee; padding-top:5px">📍 ${o.address || 'Адрес не указан'}</div>
        </div>
    `).join('');
}

document.getElementById('universalSearch').oninput = (e) => renderOrders(e.target.value);
document.getElementById('closeOrderBtn').onclick = () => orderModal.style.display = 'none';