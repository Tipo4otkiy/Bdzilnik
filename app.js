import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, addDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let userPresets = [];
let npKey = ""; 
let upBearer = "";
let allClients = [];

// --- АВТОРИЗАЦІЯ ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('displayUserName').innerText = user.email.split('@')[0];
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        await loadSettings();
        await loadAllClients();
        renderOrders();
    } else {
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
});

document.getElementById('authBtn').onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById('phoneInput').value.trim() + "@crm.com", document.getElementById('passwordInput').value.trim()); } catch(e) { alert("Помилка входу"); }
};
document.getElementById('logoutBtn').onclick = () => signOut(auth);

// --- НАЛАШТУВАННЯ ---
const settingsModal = document.getElementById('settingsModal');
document.getElementById('openSettingsBtn').onclick = () => settingsModal.style.display = 'flex';
document.getElementById('closeSettingsBtn').onclick = () => settingsModal.style.display = 'none';

async function loadSettings() {
    const d = await getDoc(doc(db, "users", currentUser.uid));
    if (d.exists()) {
        userPresets = d.data().presets || [];
        npKey = d.data().npKey || "";
        upBearer = d.data().upBearer || "";
        document.getElementById('npKeyInput').value = npKey;
        document.getElementById('upBearerInput').value = upBearer;
        renderPresetsUI();
    }
}

function renderPresetsUI() {
    document.getElementById('presetsList').innerHTML = userPresets.map((p) => `
        <div class="preset-item item-row">
            <input type="text" value="${p.name}" class="p-name">
            <input type="number" value="${p.price}" class="p-price" style="width:100px">
            <button class="btn-danger" onclick="this.parentElement.remove()">✕</button>
        </div>
    `).join('');
}

document.getElementById('addPresetBtn').onclick = () => {
    const div = document.createElement('div');
    div.className = 'preset-item item-row';
    div.innerHTML = `<input type="text" placeholder="Назва" class="p-name"> <input type="number" placeholder="Ціна" class="p-price" style="width:100px"> <button class="btn-danger" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById('presetsList').appendChild(div);
};

document.getElementById('saveSettingsBtn').onclick = async () => {
    const newPresets = [];
    document.querySelectorAll('.preset-item').forEach(row => {
        const n = row.querySelector('.p-name').value.trim();
        if(n) newPresets.push({ name: n, price: parseFloat(row.querySelector('.p-price').value) || 0 });
    });
    npKey = document.getElementById('npKeyInput').value.trim();
    upBearer = document.getElementById('upBearerInput').value.trim();
    await setDoc(doc(db, "users", currentUser.uid), { presets: newPresets, npKey, upBearer }, { merge: true });
    userPresets = newPresets;
    alert("Збережено!");
    settingsModal.style.display = 'none';
};

// --- РОЗУМНИЙ ПОШУК КЛІЄНТІВ ТА МІСТ (Скорочено для економії місця, працює як раніше) ---
async function loadAllClients() {
    const snap = await getDocs(collection(db, "clients"));
    allClients = snap.docs.map(d => ({ phone: d.id, name: d.data().name }));
}

function setupAutocomplete(inputId, boxId, searchField, fillLogic) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    input.addEventListener('input', () => {
        const val = input.value.toLowerCase().trim();
        box.innerHTML = '';
        if (val.length < 2) { box.style.display = 'none'; return; }
        const matches = allClients.filter(c => c[searchField].toLowerCase().includes(val)).slice(0, 5);
        if (matches.length > 0) {
            box.style.display = 'block';
            matches.forEach(m => {
                const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<b>${m.name}</b> (${m.phone})`;
                div.onclick = () => { fillLogic(m); box.style.display = 'none'; }; box.appendChild(div);
            });
        } else { box.style.display = 'none'; }
    });
    document.addEventListener('click', (e) => { if(e.target !== input) box.style.display = 'none'; });
}
setupAutocomplete('newPhone', 'phoneSuggestions', 'phone', (m) => { document.getElementById('newPhone').value = m.phone; document.getElementById('newName').value = m.name; });
setupAutocomplete('newName', 'nameSuggestions', 'name', (m) => { document.getElementById('newPhone').value = m.phone; document.getElementById('newName').value = m.name; });

// Автозаповнення міст (Укрпошта)
let currentUpCityId = ""; let currentUpCityData = [];
document.getElementById('newCity').addEventListener('input', async (e) => {
    const val = e.target.value.trim(); const box = document.getElementById('citySuggestions');
    if (val.length < 2) { box.style.display = 'none'; return; }
    const res = await fetch(`https://www.ukrposhta.ua/address-classifier-ws/get_city_by_region_id_and_district_id_and_city_ua?city_ua=${val}`, { headers: { 'Accept': 'application/json' } }).then(r => r.json());
    box.innerHTML = '';
    if (res.Entries && res.Entries.Entry) {
        box.style.display = 'block';
        const entries = Array.isArray(res.Entries.Entry) ? res.Entries.Entry : [res.Entries.Entry];
        entries.slice(0, 5).forEach(city => {
            const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerText = `${city.CITY_UA} (${city.REGION_UA} обл)`;
            div.onclick = () => {
                document.getElementById('newCity').value = `${city.CITY_UA} (${city.REGION_UA} обл)`;
                currentUpCityId = city.CITY_ID; box.style.display = 'none'; document.getElementById('newBranch').focus();
                fetch(`https://www.ukrposhta.ua/address-classifier-ws/get_postoffices_by_city_id?city_id=${currentUpCityId}`, { headers: { 'Accept': 'application/json' } }).then(r => r.json()).then(r => { currentUpCityData = Array.isArray(r.Entries?.Entry) ? r.Entries.Entry : [r.Entries?.Entry]; });
            }; box.appendChild(div);
        });
    }
});

document.getElementById('newBranch').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim(); const box = document.getElementById('branchSuggestions');
    box.innerHTML = '';
    if (!currentUpCityId || currentUpCityData.length === 0) return;
    const matches = currentUpCityData.filter(po => po && po.POSTCODE && (po.POSTCODE.includes(val) || (po.STREET_UA && po.STREET_UA.toLowerCase().includes(val))));
    if (matches.length > 0) {
        box.style.display = 'block';
        matches.slice(0, 5).forEach(po => {
            const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerText = `Індекс: ${po.POSTCODE} (${po.STREET_UA_VPZ || ''})`;
            div.onclick = () => { document.getElementById('newBranch').value = `Індекс: ${po.POSTCODE}`; box.style.display = 'none'; }; box.appendChild(div);
        });
    }
});


// --- СТВОРЕННЯ ЗАМОВЛЕННЯ ---
const orderModal = document.getElementById('orderModal');
document.getElementById('fabBtn').onclick = () => {
    document.getElementById('newPhone').value = ''; document.getElementById('newName').value = ''; document.getElementById('newCity').value = ''; document.getElementById('newBranch').value = '';
    document.getElementById('itemsContainer').innerHTML = ''; addItemRow(); orderModal.style.display = 'flex';
};
document.getElementById('closeOrderBtn').onclick = () => orderModal.style.display = 'none';

function addItemRow() {
    const row = document.createElement('div'); row.className = 'item-row';
    row.innerHTML = `<input type="text" list="presetData" placeholder="Товар" class="i-name" style="flex:2">
        <datalist id="presetData">${userPresets.map(p => `<option value="${p.name}"></option>`).join('')}</datalist>
        <input type="number" placeholder="К-во" class="i-qty" value="1" style="flex:0.8">
        <input type="number" placeholder="Ціна" class="i-price" style="flex:1.2"><button class="btn-danger" style="width:40px">✕</button>`;
    row.querySelector('.i-name').addEventListener('input', (e) => { const f = userPresets.find(p => p.name === e.target.value); if(f) row.querySelector('.i-price').value = f.price; calculateTotal(); });
    row.querySelectorAll('input').forEach(i => i.oninput = calculateTotal);
    row.querySelector('.btn-danger').onclick = () => { row.remove(); calculateTotal(); };
    document.getElementById('itemsContainer').appendChild(row);
}
document.getElementById('addItemBtn').onclick = addItemRow;

function calculateTotal() {
    let t = 0; document.querySelectorAll('.item-row').forEach(r => { t += (parseFloat(r.querySelector('.i-qty').value) || 0) * (parseFloat(r.querySelector('.i-price').value) || 0); });
    document.getElementById('orderTotal').innerText = t + ' грн'; return t;
}

document.getElementById('saveOrderBtn').onclick = async () => {
    const phone = document.getElementById('newPhone').value.trim(); const name = document.getElementById('newName').value.trim();
    if(!phone || !name) return alert("Заповни телефон та ім'я!");
    const items = []; document.querySelectorAll('.item-row').forEach(r => { if(r.querySelector('.i-name').value) items.push({ name: r.querySelector('.i-name').value, qty: r.querySelector('.i-qty').value, price: r.querySelector('.i-price').value }); });

    await addDoc(collection(db, "orders"), {
        sellerId: currentUser.uid, customerPhone: phone, customerName: name, city: document.getElementById('newCity').value, branch: document.getElementById('newBranch').value,
        items: items, totalPrice: calculateTotal(), status: "Готується до відправки", ttn: "", trackingInfo: null, createdAt: Date.now()
    });
    
    await setDoc(doc(db, "clients", phone), { name: name }, { merge: true });
    if(!allClients.find(c => c.phone === phone)) allClients.push({phone, name});
    orderModal.style.display = 'none'; renderOrders();
};


// --- ТРЕКІНГ (Введення ТТН та перевірка статусу) ---
let currentOrderIdForTtn = null;
const ttnModal = document.getElementById('ttnModal');

window.openTtnModal = (orderId) => {
    currentOrderIdForTtn = orderId;
    document.getElementById('ttnInput').value = '';
    ttnModal.style.display = 'flex';
};
document.getElementById('closeTtnBtn').onclick = () => ttnModal.style.display = 'none';

document.getElementById('saveTtnBtn').onclick = async () => {
    const ttn = document.getElementById('ttnInput').value.trim().toUpperCase();
    if (ttn.length < 10) return alert("Занадто короткий ТТН");
    await updateDoc(doc(db, "orders", currentOrderIdForTtn), { ttn: ttn });
    ttnModal.style.display = 'none';
    renderOrders();
};

window.checkDeliveryStatus = async (orderId, ttn) => {
    const btn = document.getElementById(`btn-${orderId}`);
    btn.innerText = "⏳...";
    btn.disabled = true;

    // Автовизначення служби
    const isNovaPoshta = /^\d{14}$/.test(ttn); // 14 цифр
    let trackingResult = null;

    try {
        if (isNovaPoshta && npKey) {
            const res = await fetch("https://api.novaposhta.ua/v2.0/json/", { method: "POST", body: JSON.stringify({ apiKey: npKey, modelName: "TrackingDocument", calledMethod: "getStatusDocuments", methodProperties: { Documents: [{ DocumentNumber: ttn }] } }) }).then(r => r.json());
            if (res.data && res.data[0]) {
                trackingResult = {
                    statusDesc: res.data[0].Status,
                    sentDate: res.data[0].DateCreated || "-",
                    receivedDate: res.data[0].ActualDeliveryDate || "-"
                };
            }
        } else {
            // Укрпошта (Для прямого запиту часто потрібен бекенд, тому ми даємо пряме посилання)
            // Відкриваємо сторінку відстеження в новій вкладці як запасний варіант
             window.open(`https://track.ukrposhta.ua/tracking_UA.html?barcode=${ttn}`, '_blank');
             btn.innerText = "🔄 Оновити";
             btn.disabled = false;
             return;
        }

        if (trackingResult) {
            await updateDoc(doc(db, "orders", orderId), { trackingInfo: trackingResult });
            renderOrders();
        } else {
            alert("Не вдалося знайти інформацію");
        }
    } catch(e) {
        alert("Помилка зв'язку з сервером пошти");
    }
    btn.innerText = "🔄 Оновити";
    btn.disabled = false;
};

// --- ВІДОБРАЖЕННЯ СПИСКУ ---
async function renderOrders(filter = "") {
    const container = document.getElementById('appContent');
    const q = query(collection(db, "orders"), where("sellerId", "==", currentUser.uid));
    const snap = await getDocs(q);
    let list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));

    if(filter) {
        const f = filter.toLowerCase();
        list = list.filter(o => o.customerName.toLowerCase().includes(f) || o.customerPhone.includes(f) || o.ttn?.includes(f));
    }

    container.innerHTML = list.sort((a,b) => b.createdAt - a.createdAt).map(o => `
        <div class="card">
            <div style="display:flex; justify-content:space-between"><b>${o.customerName}</b> <span style="color:#ffca28">${o.totalPrice} грн</span></div>
            <div style="font-size:12px; color:#666">${o.customerPhone}</div>
            <div style="font-size:13px; margin:5px 0">${o.items.map(i => i.name).join(', ')}</div>
            <div style="font-size:11px; border-top:1px solid #eee; padding-top:5px; color:#555;">📍 ${o.city ? o.city + ', ' + o.branch : 'Адресу не вказано'}</div>
            
            <div style="margin-top: 10px;">
                ${o.ttn 
                    ? `
                       <div style="font-size: 13px; font-weight: bold;">📦 ТТН: ${o.ttn}</div>
                       ${o.trackingInfo ? `
                           <div class="status-box">
                               <b>Статус:</b> ${o.trackingInfo.statusDesc}<br>
                               <b>Створено:</b> ${o.trackingInfo.sentDate}<br>
                               <b>Отримано:</b> ${o.trackingInfo.receivedDate}
                           </div>
                       ` : ''}
                       <button class="btn-secondary btn-small" id="btn-${o.id}" onclick="checkDeliveryStatus('${o.id}', '${o.ttn}')">🔄 Оновити статус</button>
                      ` 
                    : `<button class="btn-secondary btn-small" onclick="openTtnModal('${o.id}')">+ Додати ТТН</button>`
                }
            </div>
        </div>
    `).join('');
}

document.getElementById('universalSearch').oninput = (e) => renderOrders(e.target.value);