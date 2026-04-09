import { db, auth } from './js/firebase.js';
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AuthManager } from './js/Auth.js';
import { SettingsManager } from './js/Settings.js';
import { BlacklistManager } from './js/Blacklist.js';
import { LocationManager } from './js/Location.js';
import { OrderForm } from './js/OrderForm.js';
import { OrderList } from './js/OrderList.js';
import { AdminManager } from './js/Admin.js'; // Підключаємо Адміна

class CRMApp {
    constructor() {
        this.db = db;
        this.auth = auth;
        
        this.currentUser = null;
        this.userRole = 'seller';
        this.userName = ''; 
        this.presets = [];
        this.clients = [];
        this.blacklistData = [];

        this.settings = new SettingsManager(this);
        this.blacklist = new BlacklistManager(this);
        this.location = new LocationManager();
        this.orderForm = new OrderForm(this);
        this.orderList = new OrderList(this);
        this.admin = new AdminManager(this); // Ініціалізуємо модуль Адміна
        
        this.authManager = new AuthManager(this);
    }

    async startApp() {
        try { await this.settings.load(); } catch(e) { console.warn("Settings skip", e); }
        try { await this.loadClients(); } catch(e) { console.warn("Clients skip", e); }
        try { await this.blacklist.load(); } catch(e) { console.warn("Blacklist skip", e); }
        try { await this.admin.init(); } catch(e) { console.warn("Admin init skip", e); } // Запускаємо адмінку
        
        try { this.orderList.render(); } catch(e) { console.error("Помилка рендеру замовлень", e); }
    }

    async loadClients() {
        const snap = await getDocs(collection(this.db, "clients"));
        this.clients = snap.docs.map(d => ({ phone: d.id, name: d.data().name }));
    }
}

new CRMApp();