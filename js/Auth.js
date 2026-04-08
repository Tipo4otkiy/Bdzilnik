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
        // Подключаем маску к полю номера телефона на экране логина
        setupPhoneMask('phoneInput');

        document.getElementById('authBtn').addEventListener('click', async () => {
            const btn = document.getElementById('authBtn');
            const phone = document.getElementById('phoneInput').value.trim();
            const pass = document.getElementById('passwordInput').value.trim();

            if (!phone || !pass) return alert("Введите данные для входа");

            btn.innerText = "Вход...";
            btn.disabled = true;

            try { 
                // Используем формат email для Firebase Auth
                await signInWithEmailAndPassword(this.core.auth, phone + "@crm.com", pass); 
            } catch(e) { 
                alert("Ошибка входа. Проверьте номер и пароль.");
                console.error(e);
            } finally {
                btn.innerText = "Войти";
                btn.disabled = false;
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Выйти из системы?")) signOut(this.core.auth);
        });
    }

    init() {
        onAuthStateChanged(this.core.auth, async (user) => {
            if (user) {
                this.core.currentUser = user;
                // Отображаем имя пользователя (номер без домена)
                document.getElementById('displayUserName').innerText = user.email.split('@')[0];
                
                try {
                    // Проверка роли пользователя в коллекции "users"
                    const userDoc = await getDoc(doc(this.core.db, "users", user.uid));
                    if (userDoc.exists()) {
                        this.core.userRole = userDoc.data().role || 'seller';
                        // Показываем админ-панель, если роль соответствует
                        if (this.core.userRole === 'admin') {
                            const adminPanel = document.getElementById('adminPanel');
                            if (adminPanel) adminPanel.style.display = 'block';
                        }
                    }
                } catch (e) { 
                    console.warn("Документ пользователя не найден, установлена роль по умолчанию"); 
                }

                // Переход к основному интерфейсу
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                
                // Запуск загрузки данных в главном классе
                await this.core.startApp();
            } else {
                // Возврат к экрану входа
                document.getElementById('loginScreen').style.display = 'block';
                document.getElementById('mainApp').style.display = 'none';
                this.core.currentUser = null;
            }
        });
    }
}