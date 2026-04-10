import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { setupPhoneMask } from "./Utils.js";

export class BlacklistManager {
    constructor(core) {
        this.core = core;
        this.modal = document.getElementById('blacklistModal');
        this.bindEvents();
    }

    bindEvents() {
        setupPhoneMask('blPhoneInput');

        document.getElementById('openBlacklistBtn').addEventListener('click', () => { 
            this.renderUI(); 
            document.getElementById('addBlForm').style.display = 'none'; 
            this.modal.style.display = 'flex'; 
        });
        
        document.getElementById('closeBlacklistBtn').addEventListener('click', () => this.modal.style.display = 'none');
        document.getElementById('showAddBlFormBtn').onclick = () => {
        document.getElementById('addBlForm').style.display = 'block';
        document.getElementById('showAddBlFormBtn').style.display = 'none'; 
    };
        document.getElementById('cancelBlBtn').onclick = () => {
        document.getElementById('addBlForm').style.display = 'none';
        document.getElementById('showAddBlFormBtn').style.display = 'block';

    };
        
        document.getElementById('blPhoneInput').addEventListener('input', (e) => this.handleInput(e.target.value));
        
        document.getElementById('saveBlBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.save();
            
        });

        document.getElementById('blacklistContent').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (btn && btn.dataset.action === 'remove-bl') {
                this.remove(btn.dataset.docid, btn.dataset.addedby); // Удаляем по чистому ID
            }
        });
    }

    async load() {
        const snap = await getDocs(collection(this.core.db, "blacklist"));
        this.core.blacklistData = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
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
        let cleanPhone = phone.replace(/\D/g, ''); 
        if (cleanPhone.startsWith('38')) cleanPhone = cleanPhone.substring(2);
        
        if (cleanPhone.length >= 10) {
            const client = this.core.clients.find(c => {
                let cp = c.phone.replace(/\D/g, '');
                if (cp.startsWith('38')) cp = cp.substring(2);
                return cp === cleanPhone;
            });
            if (client) document.getElementById('blNameInput').value = client.name;
            
            // Ищем историю заказов (для обратной совместимости ищем и по старому и по новому формату)
            const q1 = query(collection(this.core.db, "orders"), where("customerPhone", "==", phone));
            const q2 = query(collection(this.core.db, "orders"), where("customerPhone", "==", cleanPhone));
            
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            
            let total = 0; 
            let count = 0;
            let seen = new Set();
            
            [...snap1.docs, ...snap2.docs].forEach(d => {
                if (!seen.has(d.id)) {
                    seen.add(d.id);
                    total += d.data().totalPrice || 0;
                    count++;
                }
            });

            if (count > 0) {
                document.getElementById('blPastOrdersInfo').innerHTML = `
                    <div style="padding: 10px; background: #ffebee; border-radius: 8px; color: #d32f2f; margin-top: 5px; font-size: 13px;">
                        ⚠️ <b>Історія:</b> Замовлень: ${count} на суму ${total} грн.
                    </div>`;
            } else {
                document.getElementById('blPastOrdersInfo').innerHTML = '<div style="padding: 8px; color: #666; font-size: 13px;">Новий клієнт (без історії)</div>';
            }
        }
    }

    async save() {
        const phone = document.getElementById('blPhoneInput').value.trim();
        const name = document.getElementById('blNameInput').value.trim() || 'Невідомий';
        const reason = document.getElementById('blReasonInput').value.trim();
        
        // ИСПРАВЛЕНИЕ: Вытягиваем чистые 10 цифр для базы Firebase
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('38')) cleanPhone = cleanPhone.substring(2);

        if (cleanPhone.length !== 10) return alert("Введіть коректний номер телефону (10 цифр)!");
        if (!reason) return alert("Обов'язково вкажіть причину додавання в ЧС!");

        const btn = document.getElementById('saveBlBtn');
        btn.innerText = "⏳..."; btn.disabled = true;

        try {
            // Сохраняем документ под чистым ID
            await setDoc(doc(this.core.db, "blacklist", cleanPhone), {
                phone: phone, 
                cleanPhone: cleanPhone, 
                name: name,
                reason: reason,
                addedBy: this.core.currentUser.uid,
                addedByName: this.core.userName || this.core.currentUser.email.split('@')[0],
                createdAt: Date.now()
            });

            await this.load();
            document.getElementById('addBlForm').style.display = 'none';
            this.renderUI();
        } catch(e) {
            console.error("Помилка Firebase:", e);
            alert(`Сталася помилка при збереженні: ${e.message}`);
        } finally {
            btn.innerText = "Додати в ЧС"; btn.disabled = false;
        }
    }

    async remove(docId, addedBy) {
        if (this.core.userRole !== 'admin' && this.core.currentUser.uid !== addedBy) {
            return alert("Ви можете видаляти лише тих, кого додали самі!");
        }
        
        if (confirm(`Видалити цей номер з Чорного списку?`)) {
            await deleteDoc(doc(this.core.db, "blacklist", docId));
            await this.load();
            this.renderUI();
            this.checkWarning(document.getElementById('newPhone').value.trim());
        }
    }

    checkWarning(phone) {
        const warnDiv = document.getElementById('blacklistWarning');
        if (!warnDiv) return;
        
        let cleanInput = phone.replace(/\D/g, '');
        if (cleanInput.startsWith('38')) cleanInput = cleanInput.substring(2);

        const blClient = this.core.blacklistData.find(b => b.cleanPhone === cleanInput || b.phone === phone);
        
        if (blClient) {
            warnDiv.innerHTML = `🚨 <b>УВАГА! Клієнт у Чорному списку!</b><br>Причина: ${blClient.reason}<br><small>Ким додано: ${blClient.addedByName}</small>`;
            warnDiv.style.display = 'block';
        } else {
            warnDiv.style.display = 'none';
        }
    }

    renderUI() {
        const container = document.getElementById('blacklistContent');
        if (this.core.blacklistData.length === 0) {
            container.innerHTML = "<p style='text-align:center; color:#888;'>Чорний список порожній</p>";
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
                        ? `<button data-action="remove-bl" data-addedby="${b.addedBy}" data-docid="${b.docId}"
                                   style="background:none; border:none; color:#d32f2f; cursor:pointer; font-size:18px; padding: 5px;">🗑️</button>` 
                        : ''}
                </div>
                <div style="font-size: 14px; margin-top: 8px; color: #333;"><b>Причина:</b> ${b.reason}</div>
                <div style="font-size: 11px; color: #999; margin-top: 5px;">Ким додано: ${b.addedByName}</div>
            </div>
        `).join('');
    }
}