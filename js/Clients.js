import { doc, updateDoc, getDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { setupPhoneMask } from "./Utils.js";

export class ClientManager {
    constructor(core) {
        this.core = core;
        this.modal = document.getElementById('clientsModal');
        this.editingId = null;
        this.editingVariantS = null; // Запам'ятовуємо, ЧИЙ саме варіант редагуємо
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('openClientsBtn')?.addEventListener('click', () => {
            this.editingId = null;
            this.editingVariantS = null;
            document.getElementById('clientEditForm').style.display = 'none';
            this.render();
            this.modal.style.display = 'flex';
        });
        
        document.getElementById('closeClientsBtn')?.addEventListener('click', () => {
            this.modal.style.display = 'none';
            this.editingId = null;
            this.editingVariantS = null;
        });
        
        document.getElementById('clientsSearch')?.addEventListener('input', () => this.render());

        document.getElementById('clientsContent')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.dataset.action;
            const phoneId = btn.dataset.id;
            const variantS = btn.dataset.variants; // ID юзера, якому належить варіант
            
            const client = this.core.clients.find(c => c.phone && c.phone.replace(/\D/g, '').endsWith(phoneId));
            if (!client) return;

            // 1. АДМІН: Повне видалення клієнта
            if (action === 'delete-all') {
                if (confirm(`❌ Видалити клієнта ${client.phone} повністю з усіма варіантами імен?\n\nЦю дію неможливо відмінити.`)) {
                    await deleteDoc(doc(this.core.db, "clients", phoneId));
                    await this.core.loadClients();
                    this.render();
                }
            }

            // 2. ВИДАЛЕННЯ КОНКРЕТНОГО ВАРІАНТУ ІМЕНІ
            if (action === 'delete') {
                if (confirm(`Видалити цей варіант імені?`)) {
                    await this.deleteVariant(phoneId, variantS);
                }
            }
            
            // 3. РЕДАГУВАННЯ КОНКРЕТНОГО ВАРІАНТУ
            if (action === 'edit') {
                this.openEdit(client, phoneId, variantS);
            }
        });

        document.getElementById('saveClientEditBtn')?.addEventListener('click', () => this.saveEdit());
        
        document.getElementById('cancelClientEditBtn')?.addEventListener('click', () => {
            this.editingId = null;
            this.editingVariantS = null;
            document.getElementById('clientEditForm').style.display = 'none';
            this.render();
        });
        
        setupPhoneMask('editClientPhone');
    }

    async deleteVariant(docId, variantS) {
        const ref = doc(this.core.db, "clients", docId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        let variants = snap.data().knownNames || [];
        if (variants.length > 0 && typeof variants[0] === 'string') {
            variants = variants.map(v => ({ n: v, s: snap.data().sellerId || 'legacy' }));
        }

        // Залишаємо всі варіанти, ОКРІМ того, який видаляємо
        const newVariants = variants.filter(v => v.s !== variantS);

        if (newVariants.length === 0) {
            await deleteDoc(ref); // Якщо це було останнє ім'я - видаляємо весь документ
        } else {
            await updateDoc(ref, { knownNames: newVariants });
        }
        
        await this.core.loadClients();
        this.render();
    }

    openEdit(client, docId, variantS) {
        this.editingId = docId;
        this.editingVariantS = variantS;
        
        document.getElementById('editClientOldId').value = docId;
        document.getElementById('editClientPhone').value = client.phone;
        
        let variants = client.knownNames || [];
        if (variants.length > 0 && typeof variants[0] === 'string') {
            variants = variants.map(v => ({ n: v, s: client.sellerId || 'legacy' }));
        }

        // Знаходимо саме те ім'я, яке хочемо редагувати
        const targetVariant = variants.find(v => v.s === variantS);
        document.getElementById('editClientName').value = targetVariant ? targetVariant.n : client.name;
        
        document.getElementById('clientEditForm').style.display = 'block';
        this.render();
    }

    async saveEdit() {
        const oldId = document.getElementById('editClientOldId').value;
        const newName = document.getElementById('editClientName').value.trim();
        const newPhone = document.getElementById('editClientPhone').value.trim();
        
        let cleanNewPhone = newPhone.replace(/\D/g, '');
        if (cleanNewPhone.startsWith('380')) cleanNewPhone = cleanNewPhone.substring(3);

        if (cleanNewPhone.length !== 10) return alert("Некоректний номер!");
        if (!newName) return alert("Ім'я не може бути порожнім!");

        const btn = document.getElementById('saveClientEditBtn');
        btn.disabled = true; btn.innerText = "⏳...";

        try {
            const oldRef = doc(this.core.db, "clients", oldId);
            const oldSnap = await getDoc(oldRef);
            let variants = oldSnap.exists() ? (oldSnap.data().knownNames || []) : [];
            
            if (variants.length > 0 && typeof variants[0] === 'string') {
                variants = variants.map(v => ({ n: v, s: oldSnap.data().sellerId || 'legacy' }));
            }

            // Оновлюємо конкретний варіант імені
            const myIdx = variants.findIndex(v => v.s === this.editingVariantS);
            if (myIdx !== -1) {
                variants[myIdx].n = newName;
            } else {
                variants.push({ n: newName, s: this.editingVariantS });
            }

            if (oldId !== cleanNewPhone) {
                // Якщо змінився номер телефону — переносимо варіант
                const newRef = doc(this.core.db, "clients", cleanNewPhone);
                
                const oldVariantsFiltered = variants.filter(v => v.s !== this.editingVariantS);
                if (oldVariantsFiltered.length === 0) {
                    await deleteDoc(oldRef); 
                } else {
                    await updateDoc(oldRef, { knownNames: oldVariantsFiltered });
                }
                
                const newSnap = await getDoc(newRef);
                let newVariants = newSnap.exists() ? (newSnap.data().knownNames || []) : [];
                if (newVariants.length > 0 && typeof newVariants[0] === 'string') {
                    newVariants = newVariants.map(v => ({ n: v, s: newSnap.data().sellerId || 'legacy' }));
                }
                
                const existingNewIdx = newVariants.findIndex(v => v.s === this.editingVariantS);
                if(existingNewIdx !== -1) {
                     newVariants[existingNewIdx].n = newName;
                } else {
                     newVariants.push({ n: newName, s: this.editingVariantS });
                }

                await setDoc(newRef, {
                    name: newName,
                    phone: newPhone,
                    knownNames: newVariants,
                    sellerId: newSnap.exists() ? (newSnap.data().sellerId || this.editingVariantS) : this.editingVariantS
                }, { merge: true });

            } else {
                // Якщо номер той самий, просто зберігаємо
                await updateDoc(oldRef, { knownNames: variants, name: newName });
            }

            await this.core.loadClients();
            document.getElementById('clientEditForm').style.display = 'none';
            this.editingId = null;
            this.editingVariantS = null;
            this.render();
        } catch (e) {
            alert("Помилка: " + e.message);
        } finally {
            btn.disabled = false; btn.innerText = "Зберегти";
        }
    }

    render() {
        const container = document.getElementById('clientsContent');
        const search = (document.getElementById('clientsSearch').value || '').toLowerCase();
        const uid = this.core.currentUser.uid;
        const isAdmin = this.core.userRole === 'admin';

        let list = this.core.clients.filter(c => {
            if (!c.phone) return false;
            const cleanId = c.phone.replace(/\D/g, '').substring(c.phone.replace(/\D/g, '').length - 10);
            
            if (cleanId === this.editingId) return false;

            let variants = c.knownNames || [];
            if (variants.length > 0 && typeof variants[0] === 'string') {
                variants = variants.map(v => ({ n: v, s: c.sellerId || 'legacy' }));
            }

            const hasMyName = variants.some(v => v.s === uid);
            if (!isAdmin && !hasMyName) return false;

            if (search) {
                return c.phone.includes(search) || 
                       (c.name || '').toLowerCase().includes(search) ||
                       variants.some(v => (v.n || '').toLowerCase().includes(search));
            }
            return true;
        });

        if (list.length === 0 && !this.editingId) {
            container.innerHTML = "<p style='text-align:center; color:#888; padding: 20px;'>Клієнтів не знайдено</p>";
            return;
        }

        let html = '';
        list.forEach(c => {
            const cleanId = c.phone.replace(/\D/g, '').substring(c.phone.replace(/\D/g, '').length - 10);
            
            let variants = c.knownNames || [];
            if (variants.length > 0 && typeof variants[0] === 'string') {
                variants = variants.map(v => ({ n: v, s: c.sellerId || 'legacy' }));
            }

            if (isAdmin) {
                // АДМІН: Бачить згруповану картку з усіма іменами і кнопкою повного видалення
                html += `
                <div style="background: #fff; padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #ddd; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 10px;">
                        <div>
                            <span style="color:#555; font-size: 14px; font-weight:bold;">📞 ${c.phone}</span><br>
                            <span style="font-size:12px; color:#888;">Основне: ${c.name}</span>
                        </div>
                        <button class="btn-secondary btn-small" data-action="delete-all" data-id="${cleanId}" style="background:#ffebee; color:#d32f2f; margin:0; padding:6px 10px; border: 1px solid #ffcdd2;">❌ Видалити клієнта</button>
                    </div>
                    <div>
                        <div style="font-size:11px; color:#999; margin-bottom:6px; text-transform: uppercase; letter-spacing: 0.5px;">Усі варіанти імен:</div>
                        ${variants.map((v, i) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-top: ${i > 0 ? '1px dashed #eee' : 'none'};">
                                <span style="font-size:14px; color:#333;">👤 <b>${v.n}</b></span>
                                <div style="display:flex; gap:5px;">
                                    <button class="btn-secondary btn-small" data-action="edit" data-id="${cleanId}" data-variants="${v.s}" style="background:#fff3e0; color:#e65100; margin:0; padding: 4px 8px;">✏️</button>
                                    <button class="btn-secondary btn-small" data-action="delete" data-id="${cleanId}" data-variants="${v.s}" style="background:#fff; border: 1px solid #ffcdd2; color:#d32f2f; margin:0; padding: 4px 8px;">🗑️</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            } else {
                // ПРОДАВЕЦЬ: Бачить лише свій варіант як звичайну картку
                const myVariant = variants.find(v => v.s === uid);
                if (!myVariant) return;

                html += `
                <div style="background: #fff; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <b style="font-size:15px;">${myVariant.n}</b><br>
                        <span style="color:#666; font-size: 13px;">${c.phone}</span>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-secondary btn-small" data-action="edit" data-id="${cleanId}" data-variants="${uid}" style="background:#fff3e0; color:#e65100;">✏️</button>
                        <button class="btn-secondary btn-small" data-action="delete" data-id="${cleanId}" data-variants="${uid}" style="background:#ffebee; color:#d32f2f;">🗑️</button>
                    </div>
                </div>`;
            }
        });
        
        container.innerHTML = html;
    }
}