import { db, auth } from './js/firebase.js';
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AuthManager } from './js/Auth.js';
import { SettingsManager } from './js/Settings.js';
import { BlacklistManager } from './js/Blacklist.js';
import { LocationManager } from './js/Location.js';
import { OrderForm } from './js/OrderForm.js';
import { OrderList } from './js/OrderList.js';
import { AdminManager } from './js/Admin.js';

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
        this.admin = new AdminManager(this); 
        
        this.authManager = new AuthManager(this);

        // Активуємо наш фікс для клавіатури при старті
        this.setupMobileKeyboardFix();
        this.setupIosPrompt();
    }

    // НОВИЙ МЕТОД ДЛЯ ПЛАВНОГО ПІДЙОМУ ЕКРАНА
    setupMobileKeyboardFix() {
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                // Чекаємо 300 мілісекунд, поки анімація клавіатури завершиться
                setTimeout(() => {
                    e.target.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' // Прокручує так, щоб поле було по центру екрана
                    });
                }, 300); 
            }
        });
    }
    // ДЕТЕКТОР iPHONE ДЛЯ ПІДКАЗКИ ВСТАНОВЛЕННЯ
    setupIosPrompt() {
        const isIos = () => {
            const userAgent = window.navigator.userAgent.toLowerCase();
            return /iphone|ipad|ipod/.test(userAgent);
        };

        // Перевіряємо, чи додаток ВЖЕ встановлено (працює в standalone режимі)
        const isStandalone = ('standalone' in window.navigator) && (window.navigator.standalone);

        // Якщо це iOS, додаток ще не встановлено, і користувач ще не закривав цю підказку
        if (isIos() && !isStandalone && !localStorage.getItem('iosPromptDismissed')) {
            const prompt = document.getElementById('iosInstallPrompt');
            if (prompt) {
                // Показуємо з невеличкою затримкою для краси
                setTimeout(() => prompt.style.display = 'block', 2000);
                
                document.getElementById('closeIosPrompt').addEventListener('click', () => {
                    prompt.style.display = 'none';
                    // Запам'ятовуємо, що користувач закрив підказку, щоб не дратувати його знову
                    localStorage.setItem('iosPromptDismissed', 'true');
                });
            }
        }
    }

    async startApp() {
        try { await this.settings.load(); } catch(e) { console.warn("Settings skip", e); }
        try { await this.loadClients(); } catch(e) { console.warn("Clients skip", e); }
        try { await this.blacklist.load(); } catch(e) { console.warn("Blacklist skip", e); }
        try { await this.admin.init(); } catch(e) { console.warn("Admin init skip", e); } 
        
        try { this.orderList.render(); } catch(e) { console.error("Помилка рендеру замовлень", e); }
    }

    async loadClients() {
        const snap = await getDocs(collection(this.db, "clients"));
        this.clients = [];
        snap.forEach(d => {
            const data = d.data();
            this.clients.push({
                phone: data.phone,
                name: data.name,
                knownNames: data.knownNames || [] // 👈 ДОДАЙ ЦЕЙ РЯДОК
            });
        });
    }
}

new CRMApp();