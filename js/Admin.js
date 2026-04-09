import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
        setupPhoneMask('adminNewPhone');

        document.getElementById('adminRegBtn').addEventListener('click', () => this.registerSeller());
        
        document.getElementById('adminShowAllBtn').addEventListener('click', () => {
            this.currentSellerFilter = null;
            this.renderSellersList();
            this.core.orderList.render();
        });

        document.getElementById('adminSellersList').addEventListener('click', (e) => {
            if (e.target.classList.contains('seller-chip')) {
                this.currentSellerFilter = e.target.dataset.id;
                this.renderSellersList(); 
                this.core.orderList.render(); 
            }
        });
    }

    async init() {
        const adminPanel = document.getElementById('adminPanel');
        
        // ПРЕДОХРАНИТЕЛЬ: если не админ, глушим модуль и скрываем панель
        if (this.core.userRole !== 'admin') {
            if (adminPanel) adminPanel.style.display = 'none';
            return;
        }
        
        // Включаем панель только если проверка пройдена
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
                👤 ${s.name} <span style="font-size:11px; opacity:0.7; pointer-events:none;">${s.phone}</span>
            </div>
        `).join('');
    }

    async registerSeller() {
        const name = document.getElementById('adminNewName').value.trim();
        const phone = document.getElementById('adminNewPhone').value.trim();
        const pass = document.getElementById('adminNewPass').value.trim();
        const btn = document.getElementById('adminRegBtn');

        if (!name || !phone || !pass) return alert("Заповніть всі поля для реєстрації!");
        if (pass.length < 6) return alert("Пароль має бути мінімум 6 символів!");

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('38')) cleanPhone = cleanPhone.substring(2);
        const email = cleanPhone + "@crm.com";

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

            alert(`Продавця ${name} успішно створено!`);
            
            document.getElementById('adminNewName').value = '';
            document.getElementById('adminNewPhone').value = '';
            document.getElementById('adminNewPass').value = '';
            
            await this.loadSellers(); 
        } catch (e) {
            console.error(e);
            alert("Помилка реєстрації. Можливо, такий номер вже існує.");
        } finally {
            btn.innerText = "Створити"; btn.disabled = false;
        }
    }
}