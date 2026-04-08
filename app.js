import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// --- 1. АВТОРИЗАЦІЯ ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        renderOrders();
    } else {
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
});

document.getElementById('authBtn').onclick = async () => {
    const phone = document.getElementById('phoneInput').value.trim();
    const pass = document.getElementById('passwordInput').value.trim();
    const btn = document.getElementById('authBtn');
    
    if (phone.length < 10 || pass.length < 6) return alert("Неправильний формат");
    
    btn.disabled = true;
    btn.innerText = "Завантаження...";
    try {
        await signInWithEmailAndPassword(auth, phone + "@crm.com", pass);
    } catch (err) {
        document.getElementById('authError').innerText = "Неправильний номер або пароль";
        document.getElementById('authError').style.display = "block";
        btn.disabled = false;
        btn.innerText = "Увійти";
    }
};

// --- 2. ВІДОБРАЖЕННЯ ЗАМОВЛЕНЬ ---
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

    container.innerHTML = orders.length ? orders.sort((a,b) => b.createdAt - a.createdAt).map(o => `
        <div class="card">
            <strong>${o.customerName}</strong> <span style="float:right; color:#ffca28; font-weight:bold;">${o.totalPrice} грн</span><br>
            <small>${o.customerPhone}</small><br>
            <small style="color:gray;">${o.items.map(i => `${i.name} (x${i.qty})`).join(', ')}</small>
            <div class="timeline">
                • Статус: <b>${o.status}</b><br>
                ${o.ttn ? `• ТТН: ${o.ttn}` : '• Чекає відправки'}
            </div>
        </div>
    `).join('') : '<p style="text-align:center">Замовлень поки немає</p>';
}

document.getElementById('universalSearch').oninput = (e) => renderOrders(e.target.value);

// --- 3. ЛОГІКА СТВОРЕННЯ ЗАМОВЛЕННЯ ---
const modal = document.getElementById('orderModal');
document.getElementById('fabBtn').onclick = () => {
    modal.style.display = 'flex';
    calculateTotal(); // обнулити суму
};

document.getElementById('closeModalBtn').onclick = () => {
    modal.style.display = 'none';
};

// Додавання нового рядка товару
document.getElementById('addItemBtn').onclick = () => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style = 'display: flex; gap: 5px; margin-top: 10px;';
    row.innerHTML = `
        <input type="text" placeholder="Що продаємо?" style="flex: 2;" class="item-name">
        <input type="number" placeholder="К-ть" style="flex: 1;" class="item-qty" value="1">
        <input type="number" placeholder="Ціна" style="flex: 1.5;" class="item-price">
    `;
    document.getElementById('itemsContainer').appendChild(row);
    attachCalcEvent(row);
};

// Автопідрахунок суми
function attachCalcEvent(row) {
    row.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('input', calculateTotal);
    });
}
document.querySelectorAll('.item-row').forEach(attachCalcEvent);

function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        total += qty * price;
    });
    document.getElementById('orderTotal').innerText = total + ' грн';
    return total;
}

// Автопідстановка імені клієнта, якщо він вже є в базі
document.getElementById('newPhone').addEventListener('blur', async (e) => {
    const phone = e.target.value.trim();
    if (phone.length >= 10) {
        const clientDoc = await getDoc(doc(db, "clients", phone));
        if (clientDoc.exists()) {
            document.getElementById('newName').value = clientDoc.data().name;
        }
    }
});

// ЗБЕРЕЖЕННЯ В БАЗУ
document.getElementById('saveOrderBtn').onclick = async () => {
    const phone = document.getElementById('newPhone').value.trim();
    const name = document.getElementById('newName').value.trim();
    const address = document.getElementById('newAddress').value.trim();
    const comment = document.getElementById('newComment').value.trim();
    const btn = document.getElementById('saveOrderBtn');

    if (!phone || !name) return alert("Введіть телефон та ім'я");

    // Збираємо товари
    const items = [];
    document.querySelectorAll('.item-row').forEach(row => {
        const itemName = row.querySelector('.item-name').value.trim();
        const itemQty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const itemPrice = parseFloat(row.querySelector('.item-price').value) || 0;
        if (itemName && itemQty > 0) {
            items.push({ name: itemName, qty: itemQty, price: itemPrice });
        }
    });

    if (items.length === 0) return alert("Додайте хоча б один товар");

    btn.disabled = true;
    btn.innerText = "Зберігаємо...";

    try {
        // 1. Зберігаємо/Оновлюємо клієнта в загальній базі
        await setDoc(doc(db, "clients", phone), { name: name }, { merge: true });

        // 2. Створюємо приватне замовлення
        await addDoc(collection(db, "orders"), {
            sellerId: currentUser.uid,
            customerPhone: phone,
            customerName: name,
            address: address,
            comment: comment,
            items: items,
            totalPrice: calculateTotal(),
            status: "Готується", // Чернетка
            ttn: "",
            createdAt: Date.now()
        });

        // Закриваємо вікно і оновлюємо список
        modal.style.display = 'none';
        btn.disabled = false;
        btn.innerText = "Зберегти";
        
        // Очищаємо форму
        document.getElementById('newPhone').value = "";
        document.getElementById('newName').value = "";
        document.getElementById('newAddress').value = "";
        document.getElementById('newComment').value = "";
        document.getElementById('itemsContainer').innerHTML = `
            <strong>Товари</strong>
            <div class="item-row" style="display: flex; gap: 5px; margin-top: 10px;">
                <input type="text" placeholder="Що продаємо?" style="flex: 2;" class="item-name">
                <input type="number" placeholder="К-ть" style="flex: 1;" class="item-qty" value="1">
                <input type="number" placeholder="Ціна" style="flex: 1.5;" class="item-price">
            </div>
        `;
        document.querySelectorAll('.item-row').forEach(attachCalcEvent);
        calculateTotal();

        renderOrders();
    } catch (err) {
        console.error(err);
        alert("Помилка збереження!");
        btn.disabled = false;
    }
};