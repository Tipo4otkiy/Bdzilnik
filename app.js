import { db, auth } from './js/firebase.js';
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AuthManager } from './js/Auth.js';
import { SettingsManager } from './js/Settings.js';
import { BlacklistManager } from './js/Blacklist.js';
import { LocationManager } from './js/Location.js';
import { OrderForm } from './js/OrderForm.js';
import { OrderList } from './js/OrderList.js';

class CRMApp {
    constructor() {
        this.db = db;
        this.auth = auth;
        
        // Глобальний стан
        this.currentUser = null;
        this.userRole = 'seller';
        this.presets = [];
        this.clients = [];
        this.blacklistData = [];

        // Ініціалізація модулів
        this.settings = new SettingsManager(this);
        this.blacklist = new BlacklistManager(this);
        this.location = new LocationManager();
        this.orderForm = new OrderForm(this);
        this.orderList = new OrderList(this);
        
        // Авторизація стартує останньою
        this.authManager = new AuthManager(this);
    }

    // БРОНЬОВАНИЙ ЗАПУСК (Гарантує, що замовлення відмалюються завжди)
    async startApp() {
        try { await this.settings.load(); } catch(e) { console.warn("Settings skip", e); }
        try { await this.loadClients(); } catch(e) { console.warn("Clients skip", e); }
        try { await this.blacklist.load(); } catch(e) { console.warn("Blacklist skip", e); }
        
        // Рендер замовлень спрацює у будь-якому випадку
        try { this.orderList.render(); } catch(e) { console.error("Помилка рендеру замовлень", e); }
    }

    async loadClients() {
        const snap = await getDocs(collection(this.db, "clients"));
        this.clients = snap.docs.map(d => ({ phone: d.id, name: d.data().name }));
    }
}

// Запуск
new CRMApp();