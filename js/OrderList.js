import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class OrderList {
    constructor(core) {
        this.core = core;
        this.container = document.getElementById('appContent');
        this.currentOrderIdForTtn = null;
        this.currentTab = 'active';
        this.ordersData = [];
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('universalSearch').addEventListener('input', (e) => this.render(e.target.value));

        document.getElementById('tabActiveBtn').addEventListener('click', () => {
            this.currentTab = 'active'; this.updateTabUI(); this.render();
        });
        document.getElementById('tabHistoryBtn').addEventListener('click', () => {
            this.currentTab = 'history'; this.updateTabUI(); this.render();
        });

        this.container.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'edit') {
                const docRef = await getDoc(doc(this.core.db, "orders", id));
                if (docRef.exists()) this.core.orderForm.open(docRef.data(), id);
            }
            if (action === 'delete' && confirm("Точно видалити це замовлення?")) {
                await deleteDoc(doc(this.core.db, "orders", id));
                this.render();
            }
            if (action === 'add-ttn') {
                this.currentOrderIdForTtn = id;
                document.getElementById('ttnInput').value = '';
                document.getElementById('ttnModal').style.display = 'flex';
            }
            if (action === 'complete') {
                if (confirm("Завершити замовлення і перенести в Історію?")) {
                    await updateDoc(doc(this.core.db, "orders", id), { status: 'history' });
                    this.render();
                }
            }
        });

        document.getElementById('closeTtnBtn').onclick = () => document.getElementById('ttnModal').style.display = 'none';
        document.getElementById('saveTtnBtn').onclick = async () => {
            const ttn = document.getElementById('ttnInput').value.trim().toUpperCase();
            if (ttn.length < 10) return alert("ТТН має містити мінімум 10 символів!");
            await updateDoc(doc(this.core.db, "orders", this.currentOrderIdForTtn), { ttn });
            document.getElementById('ttnModal').style.display = 'none';
            this.render();
        };

        document.getElementById('calcStatBtn').addEventListener('click', () => this.calculateAnalytics());
        document.getElementById('convertStatBtn').addEventListener('click', () => this.convertAndSum());
    }

    updateTabUI() {
        document.getElementById('tabActiveBtn').className = `tab-btn ${this.currentTab === 'active' ? 'active' : ''}`;
        document.getElementById('tabHistoryBtn').className = `tab-btn ${this.currentTab === 'history' ? 'active' : ''}`;
        document.getElementById('historyAnalytics').style.display = this.currentTab === 'history' ? 'block' : 'none';
        document.getElementById('universalSearch').value = '';
    }

    _cleanPhone(phone) {
        if (!phone) return '';
        let d = phone.replace(/\D/g, '');
        if (d.startsWith('380')) d = d.substring(3);
        return d;
    }

    _isBlacklisted(phone) {
        const clean = this._cleanPhone(phone);
        return this.core.blacklistData.some(b => b.cleanPhone === clean || this._cleanPhone(b.phone) === clean);
    }

    // Форматує суму замовлення для відображення
    _formatOrderSum(o) {
        const uah = o.totalPrice || 0;
        const usd = o.totalUSD || 0;
        if (uah > 0 && usd > 0) return `<span style="color:#ffb300; font-weight:bold;">${uah} ₴</span> <span style="color:#43a047; font-weight:bold;">+ ${usd} $</span>`;
        if (usd > 0) return `<span style="color:#43a047; font-weight:bold;">${usd} $</span>`;
        return `<span style="color:#ffb300; font-weight:bold;">${uah} ₴</span>`;
    }

    async render(filter = "") {
        try {
            let q;
            if (this.core.userRole === 'admin') {
                if (this.core.admin?.currentSellerFilter) {
                    q = query(collection(this.core.db, "orders"), where("sellerId", "==", this.core.admin.currentSellerFilter));
                } else {
                    q = query(collection(this.core.db, "orders"));
                }
            } else {
                q = query(collection(this.core.db, "orders"), where("sellerId", "==", this.core.currentUser.uid));
            }

            const snap = await getDocs(q);
            let list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));

            list = list.filter(o => {
                const isHistory = o.status === 'history';
                return this.currentTab === 'active' ? !isHistory : isHistory;
            });

            this.ordersData = list;

            if (filter) {
                const f = filter.toLowerCase();
                list = list.filter(o =>
                    (o.customerName || '').toLowerCase().includes(f) ||
                    (o.customerPhone || '').includes(f) ||
                    (o.ttn || '').toLowerCase().includes(f)
                );
            }

            if (list.length === 0) {
                this.container.innerHTML = `<div style="text-align:center; color:#999; padding: 40px 20px;">
                    <div style="font-size:40px; margin-bottom:10px;">${this.currentTab === 'active' ? '📭' : '🕰️'}</div>
                    <div>${this.currentTab === 'active' ? 'Немає поточних замовлень' : 'Історія порожня'}</div>
                </div>`;
                return;
            }

            this.container.innerHTML = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(o => {
                const isBl = this._isBlacklisted(o.customerPhone);
                const addrPrefix = o.addressType === 'street' ? '🛣️ Вулиця:' : '🏢 Відділення:';
                const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

                const itemsHtml = (o.items || []).map(i => {
                    const cur = i.currency || '₴';
                    return `• ${i.name} (x${i.qty}) — ${i.price} ${cur}`;
                }).join('<br>');

                return `
                <div class="card" ${isBl ? 'style="border: 2px solid #ef9a9a;"' : ''}>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <b style="font-size:15px;">${isBl ? '<span style="color:red;">[ЧС]</span> ' : ''}${o.customerName || ''}</b>
                        <div style="text-align:right; line-height:1.4;">${this._formatOrderSum(o)}</div>
                    </div>
                    <div style="font-size:12px; color:#888; margin-bottom:4px;">${dateStr}</div>
                    <div style="font-size:12px; color:#666">${o.customerPhone || ''}</div>
                    <div style="font-size:13px; margin:8px 0; line-height:1.7;">${itemsHtml}</div>
                    ${o.comment ? `<div style="font-size:12px; color:#e65100; margin-bottom:5px; background:#fff3e0; padding:6px 8px; border-radius:6px;">💬 ${o.comment}</div>` : ''}

                    <div style="font-size:12px; border-top:1px solid #eee; padding-top:8px; margin-top:8px; color:#444;">
                        <b>${o.deliveryMethod === 'ukrposhta' ? '📫 Укрпошта' : '📦 Нова Пошта'}</b><br>
                        ${o.city || '<span style="color:#bbb;">Адресу не вказано</span>'}
                        ${o.deliveryMethod === 'ukrposhta' && o.index ? `<br>Індекс: <b>${o.index}</b>` : ''}
                        ${o.branch ? `<br>${addrPrefix} <b>${o.branch}</b>` : ''}
                    </div>

                    ${o.ttn
                        ? `<div class="status-box">
                               <div style="font-size:13px; font-weight:bold; margin-bottom:5px;">ТТН: ${o.ttn}</div>
                               <div id="status-${o.id}" style="font-size:13px; color:#888;">⏳ Завантаження статусу...</div>
                           </div>`
                        : `<button class="btn-secondary btn-small" data-action="add-ttn" data-id="${o.id}" style="margin-top:10px; width:100%; padding:10px;">+ Додати ТТН</button>`
                    }

                    <div class="card-actions">
                        ${this.currentTab === 'active'
                            ? `<button class="btn-secondary btn-small" data-action="complete" data-id="${o.id}" style="background:#e8f5e9; color:#2e7d32; flex:1;">✅ Виконано</button>`
                            : ''}
                        <button class="btn-secondary btn-small" data-action="edit" data-id="${o.id}" style="background:#fff3e0; color:#e65100;">✏️ Ред.</button>
                        <button class="btn-secondary btn-small" data-action="delete" data-id="${o.id}" style="background:#ffebee; color:#d32f2f;">🗑️ Видалити</button>
                    </div>
                </div>`;
            }).join('');

            this.fetchLiveStatuses(list);
        } catch (error) {
            console.error("Помилка рендеру:", error);
            this.container.innerHTML = `<div style="text-align:center; color:#d32f2f; padding:30px;">Помилка завантаження. Перевірте підключення.</div>`;
        }
    }

    _filterByDate(orders) {
        const fromVal = document.getElementById('statDateFrom').value;
        const toVal = document.getElementById('statDateTo').value;
        let filtered = [...orders];
        if (fromVal) filtered = filtered.filter(o => o.createdAt >= new Date(fromVal).setHours(0,0,0,0));
        if (toVal) filtered = filtered.filter(o => o.createdAt <= new Date(toVal).setHours(23,59,59,999));
        return filtered;
    }

    calculateAnalytics() {
        const filtered = this._filterByDate(this.ordersData);
        const resultDiv = document.getElementById('statResult');

        if (filtered.length === 0) {
            resultDiv.innerHTML = "<span style='color:#888;'>За цей період немає замовлень.</span>";
            return;
        }

        let totalUAH = 0, totalUSD = 0;
        let itemsMap = {};

        filtered.forEach(o => {
            totalUAH += o.totalPrice || 0;
            totalUSD += o.totalUSD || 0;
            (o.items || []).forEach(item => {
                const cur = item.currency || '₴';
                if (!itemsMap[item.name]) itemsMap[item.name] = { uah: 0, usd: 0, qty: 0 };
                itemsMap[item.name].qty += item.qty;
                if (cur === '$') itemsMap[item.name].usd += item.qty * item.price;
                else itemsMap[item.name].uah += item.qty * item.price;
            });
        });

        let sumHtml = '';
        if (totalUAH > 0) sumHtml += `<span style="color:#e65100; font-size:18px; font-weight:bold;">${totalUAH} ₴</span>`;
        if (totalUAH > 0 && totalUSD > 0) sumHtml += `<span style="color:#888; margin: 0 6px;">+</span>`;
        if (totalUSD > 0) sumHtml += `<span style="color:#2e7d32; font-size:18px; font-weight:bold;">${totalUSD} $</span>`;

        let html = `
        <div style="background:#fafafa; padding:12px; border-radius:8px; border:1px solid #ddd; margin-bottom:15px;">
            <div style="font-size:13px; color:#666; margin-bottom:4px;">💰 Загальний дохід (${filtered.length} замовл.):</div>
            <div>${sumHtml}</div>
        </div>`;

        html += `<b style="color:#444; font-size:14px;">📦 Продано товарів:</b><div style="margin-top:8px;">`;
        for (const [name, data] of Object.entries(itemsMap).sort((a, b) => b[1].qty - a[1].qty)) {
            let sumStr = '';
            if (data.uah > 0) sumStr += `${data.uah} ₴`;
            if (data.uah > 0 && data.usd > 0) sumStr += ' + ';
            if (data.usd > 0) sumStr += `${data.usd} $`;
            html += `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:13px;">
                <span>${name}</span>
                <span><b>${data.qty} шт.</b> <span style="color:#888; font-size:12px;">· ${sumStr}</span></span>
            </div>`;
        }
        html += `</div>`;

        resultDiv.innerHTML = html;
    }

    async convertAndSum() {
        const btn = document.getElementById('convertStatBtn');
        const resultDiv = document.getElementById('convertResult');
        const targetCurrency = document.getElementById('convertCurrency').value;

        btn.innerText = '⏳...'; btn.disabled = true;
        resultDiv.innerHTML = '<span style="color:#888;">Завантажуємо курс...</span>';

        try {
            const filtered = this._filterByDate(this.ordersData);
            if (filtered.length === 0) {
                resultDiv.innerHTML = "<span style='color:#888;'>Немає замовлень за цей період.</span>";
                return;
            }

            let totalUAH = 0, totalUSD = 0;
            filtered.forEach(o => {
                totalUAH += o.totalPrice || 0;
                totalUSD += o.totalUSD || 0;
            });

            // Отримуємо актуальний курс USD/UAH
            const rateRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=UAH').then(r => r.json());
            const rate = rateRes?.rates?.UAH;
            if (!rate) throw new Error("Не вдалося отримати курс");

            let total, symbol, rateInfo;
            if (targetCurrency === 'UAH') {
                total = totalUAH + (totalUSD * rate);
                symbol = '₴';
                rateInfo = `1 $ = ${rate.toFixed(2)} ₴`;
            } else {
                total = (totalUAH / rate) + totalUSD;
                symbol = '$';
                rateInfo = `1 $ = ${rate.toFixed(2)} ₴`;
            }

            resultDiv.innerHTML = `
                <div style="background:#e8f5e9; padding:12px; border-radius:8px; border:1px solid #a5d6a7;">
                    <div style="font-size:13px; color:#666; margin-bottom:4px;">Курс НБУ: <b>${rateInfo}</b></div>
                    <div style="font-size:20px; font-weight:bold; color:#2e7d32;">${total.toFixed(2)} ${symbol}</div>
                    <div style="font-size:11px; color:#999; margin-top:4px;">= ${totalUAH} ₴ + ${totalUSD} $ після конвертації</div>
                </div>`;
        } catch(e) {
            resultDiv.innerHTML = `<span style="color:#d32f2f;">Помилка отримання курсу. Перевірте інтернет.</span>`;
        } finally {
            btn.innerText = '💱 Конвертувати та підсумувати'; btn.disabled = false;
        }
    }

    async fetchLiveStatuses(orders) {
        let hasAutoCompleted = false;

        for (const o of orders) {
            if (!o.ttn) continue;
            const el = document.getElementById(`status-${o.id}`);
            if (!el) continue;

            const isNovaPoshta = /^\d{14}$/.test(o.ttn);

            try {
                if (isNovaPoshta) {
                    const res = await fetch("https://api.novaposhta.ua/v2.0/json/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            apiKey: "",
                            modelName: "TrackingDocument",
                            calledMethod: "getStatusDocuments",
                            methodProperties: { Documents: [{ DocumentNumber: o.ttn }] }
                        })
                    }).then(r => r.json());

                    if (res.data && res.data[0]) {
                        const statusStr = res.data[0].Status;
                        const statusCode = res.data[0].StatusCode;
                        el.innerHTML = `<span style="color:#2e7d32;"><b>${statusStr}</b></span><br><span style="font-size:11px; color:#666;">Відправлено: ${res.data[0].DateCreated || '—'}</span>`;
                        if (o.status !== 'history' && (statusCode === "9" || statusCode === "10" || statusCode === "11" || statusStr.toLowerCase().includes("одержано"))) {
                            await updateDoc(doc(this.core.db, "orders", o.id), { status: 'history' });
                            hasAutoCompleted = true;
                        }
                    } else {
                        el.innerHTML = '<span style="color:#888;">Статус не знайдено</span>';
                    }
                } else {
                    const upToken = "e66c7553-9d16-3e74-b52b-45610665ed5b";
                    const targetUrl = `https://www.ukrposhta.ua/status-tracking/0.0.1/statuses?barcode=${o.ttn}`;
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                    const res = await fetch(proxyUrl, { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${upToken}` } });

                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.length > 0) {
                            const lastStatus = data[data.length - 1];
                            const statusName = lastStatus.eventName || "В дорозі";
                            el.innerHTML = `<span style="color:#f57f17;"><b>${statusName}</b></span><br><span style="font-size:11px; color:#666;">Оновлено: ${new Date(lastStatus.date).toLocaleString('uk-UA')}</span>`;
                            const sLower = statusName.toLowerCase();
                            if (o.status !== 'history' && (sLower.includes("вручення") || sLower.includes("вручено") || sLower.includes("одержано"))) {
                                await updateDoc(doc(this.core.db, "orders", o.id), { status: 'history' });
                                hasAutoCompleted = true;
                            }
                        } else {
                            el.innerHTML = '<span style="color:#888;">Посилка ще не відслідковується</span>';
                        }
                    } else { throw new Error("Proxy Error"); }
                }
            } catch (e) {
                const link = isNovaPoshta
                    ? `https://tracking.novaposhta.ua/#/uk/?en=${o.ttn}`
                    : `https://track.ukrposhta.ua/tracking_UA.html?barcode=${o.ttn}`;
                el.innerHTML = `<a href="${link}" target="_blank" style="color:#1976d2; font-weight:bold; text-decoration:none;">🔗 Перевірити на сайті ↗</a>`;
            }
        }

        if (hasAutoCompleted && this.currentTab === 'active') this.render();
    }
}
