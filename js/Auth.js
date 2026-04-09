import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { setupPhoneMask } from "./Utils.js";

export class AuthManager {
    constructor(core) {
        this.core = core;
        this.bindEvents();
        this.init();
    }

    bindEvents() {
        setupPhoneMask('phoneInput');

        document.getElementById('authBtn').addEventListener('click', async () => {
            const btn = document.getElementById('authBtn');
            const phone = document.getElementById('phoneInput').value.trim();
            const pass = document.getElementById('passwordInput').value.trim();

            if (!phone || !pass) return alert("Введіть дані для входу");

            // Витягуємо чисті цифри, прибираємо код країни 380
            let digits = phone.replace(/\D/g, '');
            if (digits.startsWith('380')) digits = digits.substring(3);

            // Email будується з 10 цифр (починаються з 0)
            const email = digits + "@crm.com";

            btn.innerText = "Вхід...";
            btn.disabled = true;

            try { 
                await signInWithEmailAndPassword(this.core.auth, email, pass); 
            } catch(e) { 
                console.error("Login error:", e.code, email);
                alert("Помилка входу. Перевірте номер та пароль.");
            } finally {
                btn.innerText = "Увійти";
                btn.disabled = false;
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm("Вийти з системи?")) {
                await signOut(this.core.auth);
                window.location.reload(); 
            }
        });
    }

    init() {
        onAuthStateChanged(this.core.auth, async (user) => {
            const adminPanel = document.getElementById('adminPanel');

            if (user) {
                this.core.currentUser = user;
                
                // Скидаємо роль і панель за замовчуванням
                this.core.userRole = 'seller';
                if (adminPanel) adminPanel.style.display = 'none';

                let displayName = user.email.split('@')[0]; 
                
                try {
                    const userDoc = await getDoc(doc(this.core.db, "users", user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        this.core.userRole = data.role || 'seller';
                        this.core.userName = data.name || displayName;
                        displayName = this.core.userName; 
                    } else {
                        this.core.userName = displayName;
                    }
                } catch (e) { 
                    this.core.userName = displayName;
                }

                document.getElementById('displayUserName').innerText = displayName;
                
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                
                await this.core.startApp();
            } else {
                document.getElementById('loginScreen').style.display = 'block';
                document.getElementById('mainApp').style.display = 'none';
                if (adminPanel) adminPanel.style.display = 'none';
                this.core.currentUser = null;
                this.core.userName = '';
                this.core.userRole = 'seller';
            }
        });
    }
}
