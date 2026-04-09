import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, setDoc, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";
import { setupPhoneMask } from "./Utils.js";

export class AdminManager {
    constructor(core) {
        this.core = core;
        this.sellers = [];
        this.currentSellerFilter = null; 
        
        this.adminApp = initializeApp(firebaseConfig, "AdminRegistrationApp");
        this.adminAuth = getAuth(this.adminApp);

        this.bindEvents();
    }

    bindEvents() {

        const adminHeader = document.getElementById('adminPanelHeader');
        const adminContent = document.getElementById('adminPanelContent');
        const adminIcon = document.getElementById('adminToggleIcon');

        if (adminHeader) {
            adminHeader.addEventListener('click', () => {
                if (adminContent.style.display === 'none') {
                    adminContent.style.display = 'block';
                    adminIcon.innerHTML = '🔼 Згорнути';
                    adminIcon.style.background = '#e0e0e0';
                } else {
                    adminContent.style.display = 'none';
                    adminIcon.innerHTML = '🔽 Розгорнути';
                    adminIcon.style.background = '#f4f4f9';
                }
            });
        }
        
        setupPhoneMask('adminNewPhone');

        document.getElementById('adminRegBtn').addEventListener('click', () => this.registerSeller());
        
        document.getElementById('adminShowAllBtn').addEventListener('click', () => {
            this.currentSellerFilter = null;
            this.renderSellersList();
            this.core.orderList.render();
        });

        document.getElementById('adminSellersList').addEventListener('click', (e) => {
            const chip = e.target.closest('.seller-chip');
            if (chip) {
                this.currentSellerFilter = chip.dataset.id;
                this.renderSellersList(); 
                this.core.orderList.render(); 
            }
        });

        // Біндимо кнопку перенесення
        const transferBtn = document.getElementById('adminTransferBtn');
        if (transferBtn) {
            transferBtn.addEventListener('click', () => this.transferOrders());
        }
    }

    async init() {
        const adminPanel = document.getElementById('adminPanel');
        
        if (this.core.userRole !== 'admin') {
            if (adminPanel) adminPanel.style.display = 'none';
            return;
        }
        
        if (adminPanel) adminPanel.style.display = 'block';
        await this.loadSellers();
    }

    async loadSellers() {
        try {
            const snap = await getDocs(collection(this.core.db, "users"));
            this.sellers = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.role === 'seller' || data.role === 'admin') {
                    this.sellers.push({ id: d.id, name: data.name, phone: data.phone });
                }
            });
            this.renderSellersList();
            this.updateTransferSelects(); // Оновлюємо випадаючі списки перенесення
        } catch (e) {
            console.error("Помилка завантаження продавців:", e);
        }
    }

    renderSellersList() {
        const container = document.getElementById('adminSellersList');
        if (this.sellers.length === 0) {
            container.innerHTML = "<span style='color:#888; font-size:13px;'>Немає зареєстрованих продавців</span>";
            return;
        }

        container.innerHTML = this.sellers.map(s => `
            <div class="seller-chip ${this.currentSellerFilter === s.id ? 'active' : ''}" data-id="${s.id}">
                👤 ${s.name} <span style="font-size:11px; opacity:0.7; pointer-events:none;">${s.phone || ''}</span>
            </div>
        `).join('');
    }

    updateTransferSelects() {
        const fromSel = document.getElementById('transferFrom');
        const toSel = document.getElementById('transferTo');
        if (!fromSel || !toSel) return;

        let options = '';
        this.sellers.forEach(s => {
            // Додаємо шматочок ID, щоб легко відрізнити старий акаунт від нового
            options += `<option value="${s.id}">${s.name} (${s.phone}) [ID:${s.id.substring(0,4)}]</option>`;
        });

        fromSel.innerHTML = '<option value="">Від кого (старий)...</option>' + options;
        toSel.innerHTML = '<option value="">Кому (новий)...</option>' + options;
    }

    async transferOrders() {
        const oldId = document.getElementById('transferFrom').value;
        const newId = document.getElementById('transferTo').value;

        if (!oldId || !newId) return alert("Оберіть обох продавців зі списку!");
        if (oldId === newId) return alert("Не можна перенести замовлення на того ж самого продавця!");

        if (!confirm("Увага! Всі замовлення старого профілю будуть закріплені за новим.\n\nПродовжити?")) return;

        const btn = document.getElementById('adminTransferBtn');
        btn.innerText = "⏳..."; btn.disabled = true;

        try {
            // 1. Шукаємо всі замовлення старого продавця
            const q = query(collection(this.core.db, "orders"), where("sellerId", "==", oldId));
            const snap = await getDocs(q);

            if (snap.empty) {
                alert("У старого продавця немає замовлень для перенесення.");
            } else {
                // 2. Перезаписуємо sellerId у кожному замовленні
                let count = 0;
                const promises = [];
                snap.forEach(d => {
                    promises.push(updateDoc(doc(this.core.db, "orders", d.id), { sellerId: newId }));
                    count++;
                });

                await Promise.all(promises);
                alert(`Успіх! Перенесено замовлень: ${count}`);
            }

            // 3. Підчищаємо базу від старого "привида"
            if (confirm("Видалити старий профіль продавця з бази?\n(Рекомендується, щоб він більше не дублювався у списках)")) {
                await deleteDoc(doc(this.core.db, "users", oldId));
                await this.loadSellers();
            }

            document.getElementById('transferFrom').value = '';
            document.getElementById('transferTo').value = '';
            this.core.orderList.render(); 

        } catch (e) {
            console.error(e);
            alert("Помилка перенесення: " + e.message);
        } finally {
            btn.innerText = "Перенести"; btn.disabled = false;
        }
    }

    async registerSeller() {
        const name = document.getElementById('adminNewName').value.trim();
        const phone = document.getElementById('adminNewPhone').value.trim();
        const pass = document.getElementById('adminNewPass').value.trim();
        const btn = document.getElementById('adminRegBtn');

        if (!name || !phone || !pass) return alert("Заповніть всі поля для реєстрації!");
        if (pass.length < 6) return alert("Пароль має бути мінімум 6 символів!");

        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('380')) digits = digits.substring(3);

        if (digits.length !== 10) return alert("Введіть коректний номер (10 цифр, починається з 0)!");

        const email = digits + "@crm.com";

        btn.innerText = "⏳..."; btn.disabled = true;

        try {
            const userCred = await createUserWithEmailAndPassword(this.adminAuth, email, pass);
            
            await setDoc(doc(this.core.db, "users", userCred.user.uid), {
                name: name,
                phone: phone,
                role: 'seller',
                presets: []
            });

            await signOut(this.adminAuth);

            alert(`Продавця ${name} успішно створено!\nЛогін: ${phone}\nПароль: ${pass}`);
            
            document.getElementById('adminNewName').value = '';
            document.getElementById('adminNewPhone').value = '';
            document.getElementById('adminNewPass').value = '';
            
            await this.loadSellers(); 
        } catch (e) {
            console.error(e);
            if (e.code === 'auth/email-already-in-use') {
                alert("Помилка: продавець з таким номером вже існує!");
            } else {
                alert("Помилка реєстрації: " + e.message);
            }
        } finally {
            btn.innerText = "Створити"; btn.disabled = false;
        }
    }
}