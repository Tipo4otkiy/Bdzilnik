import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { setupPhoneMask } from "./Utils.js";

export class BlacklistManager {
    constructor(core) {
        this.core = core;
        this.modal = document.getElementById('blacklistModal');
        this.bindEvents();
    }

    bindEvents() {
        // Подключаем маску к полю ввода номера в ЧС
        setupPhoneMask('blPhoneInput');

        document.getElementById('openBlacklistBtn').onclick = () => { 
            this.renderUI(); 
            document.getElementById('addBlForm').style.display = 'none'; 
            this.modal.style.display = 'flex'; 
        };
        
        document.getElementById('closeBlacklistBtn').onclick = () => this.modal.style.display = 'none';
        document.getElementById('showAddBlFormBtn').onclick = () => this.showForm();
        document.getElementById('cancelBlBtn').onclick = () => document.getElementById('addBlForm').style.display = 'none';
        
        document.getElementById('blPhoneInput').addEventListener('input', (e) => this.handleInput(e.target.value));
        document.getElementById('saveBlBtn').onclick = () => this.save();

        // Делегирование кликов для удаления из ЧС
        document.getElementById('blacklistContent').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (btn && btn.dataset.action === 'remove-bl') {
                this.remove(btn.dataset.phone, btn.dataset.addedby);
            }
        });
    }

    async load() {
        const snap = await getDocs(collection(this.core.db, "blacklist"));
        this.core.blacklistData = snap.docs.map(d => ({ phone: d.id, ...d.data() }));
    }

    showForm() {
        document.getElementById('blPhoneInput').value = '';
        document.getElementById('blNameInput').value = '';
        document.getElementById('blReasonInput').value = '';
        document.getElementById('blPastOrdersInfo').innerHTML = '';
        document.getElementById('addBlForm').style.display = 'block';
    }

    async handleInput(phone) {
        phone = phone.trim();
        // Очищаем номер от маски для поиска в базе
        const cleanPhone = phone.replace(/\D/g, '');
        
        if (cleanPhone.length >= 10) {
            // Поиск клиента в локальном кэше
            const client = this.core.clients.find(c => c.phone.replace(/\D/g, '') === cleanPhone);
            if (client) document.getElementById('blNameInput').value = client.name;
            
            // Запрос истории заказов
            const q = query(collection(this.core.db, "orders"), where("customerPhone", "==", phone));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                let total = 0; 
                snap.forEach(d => total += d.data().totalPrice || 0);
                document.getElementById('blPastOrdersInfo').innerHTML = `
                    <div style="padding: 10px; background: #ffebee; border-radius: 8px; color: #d32f2f; margin-top: 5px; font-size: 13px;">
                        ⚠️ <b>История:</b> Заказов: ${snap.size} на сумму ${total} грн.
                    </div>`;
            } else {
                document.getElementById('blPastOrdersInfo').innerHTML = '<div style="padding: 8px; color: #666; font-size: 13px;">Новый клиент (без истории)</div>';
            }
        }
    }

    async save() {
        const phone = document.getElementById('blPhoneInput').value.trim();
        const reason = document.getElementById('blReasonInput').value.trim();
        
        if (phone.length < 10 || !reason) return alert("Введите корректный номер и причину!");

        await setDoc(doc(this.core.db, "blacklist", phone), {
            phone: phone,
            name: document.getElementById('blNameInput').value.trim() || 'Неизвестный',
            reason: reason,
            addedBy: this.core.currentUser.uid,
            addedByName: this.core.currentUser.email.split('@')[0],
            createdAt: Date.now()
        });

        await this.load();
        document.getElementById('addBlForm').style.display = 'none';
        this.renderUI();
    }

    async remove(phone, addedBy) {
        if (this.core.userRole !== 'admin' && this.core.currentUser.uid !== addedBy) {
            return alert("Вы можете удалять только тех, кого добавили сами!");
        }
        
        if (confirm(`Удалить номер ${phone} из черного списка?`)) {
            await deleteDoc(doc(this.core.db, "blacklist", phone));
            await this.load();
            this.renderUI();
            // Обновляем предупреждение в форме заказа, если она открыта
            this.checkWarning(document.getElementById('newPhone').value.trim());
        }
    }

    checkWarning(phone) {
        const warnDiv = document.getElementById('blacklistWarning');
        if (!warnDiv) return;
        
        const blClient = this.core.blacklistData.find(b => b.phone === phone);
        if (blClient) {
            warnDiv.innerHTML = `🚨 <b>ВНИМАНИЕ! Клиент в ЧС!</b><br>Причина: ${blClient.reason}<br><small>Добавил: ${blClient.addedByName}</small>`;
            warnDiv.style.display = 'block';
        } else {
            warnDiv.style.display = 'none';
        }
    }

    renderUI() {
        const container = document.getElementById('blacklistContent');
        if (this.core.blacklistData.length === 0) {
            container.innerHTML = "<p style='text-align:center; color:#888;'>Черный список пуст</p>";
            return;
        }
        
        container.innerHTML = this.core.blacklistData.sort((a,b) => b.createdAt - a.createdAt).map(b => `
            <div style="background: #fff; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #d32f2f; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <b>${b.name}</b><br>
                        <span style="color:#666; font-size: 13px;">${b.phone}</span>
                    </div>
                    ${(this.core.userRole === 'admin' || this.core.currentUser.uid === b.addedBy) 
                        ? `<button data-action="remove-bl" data-phone="${b.phone}" data-addedby="${b.addedBy}" 
                                   style="background:none; border:none; color:#d32f2f; cursor:pointer; font-size:18px; padding: 5px;">🗑️</button>` 
                        : ''}
                </div>
                <div style="font-size: 14px; margin-top: 8px; color: #333;"><b>Причина:</b> ${b.reason}</div>
                <div style="font-size: 11px; color: #999; margin-top: 5px;">Кем добавлен: ${b.addedByName}</div>
            </div>
        `).join('');
    }
}