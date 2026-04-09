import { collection, addDoc, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { setupPhoneMask, formatPhoneString } from "./Utils.js";

export class OrderForm {
    constructor(core) {
        this.core = core;
        this.modal = document.getElementById('orderModal');
        this.container = document.getElementById('itemsContainer');
        this.editingId = null;
        this.bindEvents();
        this.setupAutocomplete();
        setupPhoneMask('newPhone');
    }

    bindEvents() {
        document.getElementById('fabBtn').onclick = () => this.open();
        document.getElementById('closeOrderBtn').onclick = () => this.modal.style.display = 'none';
        document.getElementById('addItemBtn').onclick = () => this.addItemRow();
        document.getElementById('saveOrderBtn').onclick = () => this.save();

        const handleUpdate = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                if (e.target.classList.contains('i-name')) {
                    const f = this.core.presets.find(p => p.name === e.target.value);
                    if (f) {
                        e.target.closest('div').querySelector('.i-price').value = f.price;
                        if (f.currency) e.target.closest('div').querySelector('.i-currency').value = f.currency;
                    }
                }
                this.calcTotal();
            }
        };

        this.container.addEventListener('input', handleUpdate);
        this.container.addEventListener('change', handleUpdate);

        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-danger')) {
                e.target.closest('div').remove();
                this.calcTotal();
            }
        });

        document.getElementById('newPhone').addEventListener('input', (e) => {
            this.core.blacklist.checkWarning(e.target.value);
        });
    }

    _cleanPhone(phone) {
        if (!phone) return '';
        let d = phone.replace(/\D/g, '');
        if (d.startsWith('380')) d = d.substring(3);
        return d;
    }

    setupAutocomplete() {
        const setup = (inpId, boxId, field, fillLogic) => {
            const input = document.getElementById(inpId);
            const box = document.getElementById(boxId);

            input.addEventListener('input', () => {
                let val = input.value.toLowerCase().trim();
                if (field === 'phone') val = this._cleanPhone(val);

                box.innerHTML = '';
                if (val.length < 2) { box.style.display = 'none'; return; }

                const matches = this.core.clients.filter(c => {
                    if (field === 'phone') return this._cleanPhone(c.phone).includes(val);
                    return (c[field] || '').toLowerCase().includes(val);
                }).slice(0, 5);

                if (matches.length > 0) {
                    box.style.display = 'block';
                    matches.forEach(m => {
                        const isBl = this.core.blacklistData.some(b => b.cleanPhone === this._cleanPhone(m.phone));
                        const div = document.createElement('div');
                        div.className = 'suggestion-item';
                        div.innerHTML = `${isBl ? '<span style="color:red; font-weight:bold;">[ЧС]</span> ' : ''}<b>${m.name}</b> <span style="color:#666">(${m.phone})</span>`;
                        div.onclick = () => { fillLogic(m); box.style.display = 'none'; this.core.blacklist.checkWarning(m.phone); };
                        box.appendChild(div);
                    });
                } else {
                    box.style.display = 'none';
                }
            });
            document.addEventListener('click', (e) => { if (e.target !== input) box.style.display = 'none'; });
        };

        setup('newPhone', 'phoneSuggestions', 'phone', (m) => {
            document.getElementById('newPhone').value = m.phone;
            document.getElementById('newName').value = m.name;
        });
        setup('newName', 'nameSuggestions', 'name', (m) => {
            document.getElementById('newPhone').value = m.phone;
            document.getElementById('newName').value = m.name;
        });
    }

    open(data = null, id = null) {
        this.editingId = id;
        document.getElementById('orderModalTitle').innerText = id ? "Редагування замовлення" : "Нове замовлення";
        document.getElementById('blacklistWarning').style.display = 'none';

        document.getElementById('newPhone').value = formatPhoneString(data?.customerPhone || '');
        document.getElementById('newName').value = data?.customerName || '';
        document.getElementById('newCity').value = data?.city || '';
        document.getElementById('newIndex').value = data?.index || '';
        document.getElementById('newBranch').value = data?.branch || '';
        document.getElementById('newComment').value = data?.comment || '';

        const type = data?.deliveryMethod || 'ukrposhta';
        const typeRadio = document.querySelector(`input[name="deliveryType"][value="${type}"]`);
        if (typeRadio) typeRadio.checked = true;
        document.getElementById('newIndex').style.display = type === 'ukrposhta' ? 'block' : 'none';

        const addrType = data?.addressType || 'branch';
        const addrRadio = document.querySelector(`input[name="addressType"][value="${addrType}"]`);
        if (addrRadio) addrRadio.checked = true;
        document.getElementById('newBranch').placeholder = addrType === 'branch' ? "Номер або назва відділення..." : "Назва вулиці, будинок, квартира...";

        this.core.location.currentCityRef = "";
        this.container.innerHTML = '<strong>Товари:</strong>';

        if (data?.items?.length) {
            data.items.forEach(i => this.addItemRow(i.name, i.qty, i.price, i.currency || '₴'));
        } else {
            this.addItemRow();
        }

        if (data) this.core.blacklist.checkWarning(data.customerPhone);
        this.calcTotal();
        this.modal.style.display = 'flex';
    }

    addItemRow(name = "", qty = 1, price = "", currency = "₴") {
        const r = document.createElement('div');
        r.style.cssText = 'display: flex; gap: 6px; align-items: center; margin-bottom: 10px; width: 100%;';
        r.innerHTML = `
            <input type="text" list="presetData" placeholder="Товар" class="i-name" value="${name}" style="flex: 2; min-width: 0; margin: 0;">
            <datalist id="presetData">${this.core.presets.map(p => `<option value="${p.name}"></option>`).join('')}</datalist>
            <input type="number" placeholder="К-во" class="i-qty" value="${qty}" min="1" style="flex: 0.6; min-width: 0; margin: 0;">
            <input type="number" placeholder="Ціна" class="i-price" value="${price}" min="0" style="flex: 1; min-width: 0; margin: 0;">
            <select class="i-currency" style="flex: 0 0 52px; padding: 10px 4px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; background: #fff; margin: 0; height: 46px;">
                <option value="₴" ${currency === '₴' ? 'selected' : ''}>₴</option>
                <option value="$" ${currency === '$' ? 'selected' : ''}>$</option>
            </select>
            <button type="button" class="btn-danger" title="Видалити" style="flex: 0 0 40px; width: 40px; height: 46px; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center; font-size: 16px;">✕</button>`;
        this.container.appendChild(r);
        this.calcTotal();
    }

    calcTotal() {
        let uah = 0, usd = 0;
        this.container.querySelectorAll('.i-qty').forEach(qtyInput => {
            const row = qtyInput.closest('div');
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(row.querySelector('.i-price').value) || 0;
            const cur = row.querySelector('.i-currency')?.value || '₴';
            if (cur === '$') usd += qty * price;
            else uah += qty * price;
        });

        let totalStr = '';
        if (uah > 0 && usd > 0) totalStr = `${uah} ₴ + ${usd} $`;
        else if (usd > 0) totalStr = `${usd} $`;
        else totalStr = `${uah} ₴`;

        document.getElementById('orderTotal').innerText = totalStr;
        return { uah, usd };
    }

    async save() {
        const btn = document.getElementById('saveOrderBtn');
        btn.innerText = "⏳..."; btn.disabled = true;

        try {
            // Проверяем, существует ли еще профиль текущего пользователя
            const userCheck = await getDoc(doc(this.core.db, "users", this.core.currentUser.uid));
            if (!userCheck.exists()) {
                throw new Error("Ошибка доступа: ваш профиль удален. Пожалуйста, войдите заново.");
            }

            const phone = document.getElementById('newPhone').value.trim();
            const name = document.getElementById('newName').value.trim();
            if (!phone || !name) throw new Error("Заповніть телефон та ім'я!");

            const items = [];
            this.container.querySelectorAll('.i-name').forEach(nameInput => {
                const row = nameInput.closest('div');
                const n = nameInput.value.trim();
                if (n) items.push({
                    name: n,
                    qty: parseFloat(row.querySelector('.i-qty').value) || 1,
                    price: parseFloat(row.querySelector('.i-price').value) || 0,
                    currency: row.querySelector('.i-currency')?.value || '₴'
                });
            });
            if (items.length === 0) throw new Error("Додайте хоча б один товар");

            const { uah, usd } = this.calcTotal();

            const orderData = {
                customerPhone: phone,
                customerName: name,
                deliveryMethod: document.querySelector('input[name="deliveryType"]:checked').value,
                addressType: document.querySelector('input[name="addressType"]:checked').value,
                city: document.getElementById('newCity').value.trim(),
                index: document.querySelector('input[name="deliveryType"]:checked').value === 'ukrposhta'
                    ? document.getElementById('newIndex').value.trim() : "",
                branch: document.getElementById('newBranch').value.trim(),
                comment: document.getElementById('newComment').value.trim(),
                items,
                totalPrice: uah,
                totalUSD: usd,
            };

            if (this.editingId) {
                await updateDoc(doc(this.core.db, "orders", this.editingId), orderData);
            } else {
                orderData.sellerId = this.core.currentUser.uid;
                orderData.createdAt = Date.now();
                orderData.ttn = "";
                orderData.status = "active";
                await addDoc(collection(this.core.db, "orders"), orderData);
            }

            const cleanPhone = this._cleanPhone(phone);
            if (cleanPhone.length === 10) {
                await setDoc(doc(this.core.db, "clients", cleanPhone), { name, phone }, { merge: true });
            }

            await this.core.loadClients();
            this.modal.style.display = 'none';
            this.core.orderList.currentTab = 'active';
            this.core.orderList.updateTabUI();
            this.core.orderList.render();
        } catch (err) {
        alert(err.message || "Ошибка сохранения");
        if (err.message.includes("профиль удален")) {
            window.location.reload(); // Перезагружаем, чтобы Auth.js выкинул на логин
        }
        } finally {
            btn.innerText = "Зберегти"; btn.disabled = false;
        }
    }
}
