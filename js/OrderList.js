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
        
        document.getElementById('tabActiveBtn').addEventListener('click', () => { this.currentTab = 'active'; this.updateTabUI(); this.render(); });
        document.getElementById('tabHistoryBtn').addEventListener('click', () => { this.currentTab = 'history'; this.updateTabUI(); this.render(); });

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
            if (ttn.length < 10) return alert("Помилка ТТН");
            await updateDoc(doc(this.core.db, "orders", this.currentOrderIdForTtn), { ttn: ttn });
            document.getElementById('ttnModal').style.display = 'none';
            this.render();
        };
        
        document.getElementById('calcStatBtn').addEventListener('click', () => this.calculateAnalytics());
    }

    updateTabUI() {
        document.getElementById('tabActiveBtn').className = `tab-btn ${this.currentTab === 'active' ? 'active' : ''}`;
        document.getElementById('tabHistoryBtn').className = `tab-btn ${this.currentTab === 'history' ? 'active' : ''}`;
        document.getElementById('historyAnalytics').style.display = this.currentTab === 'history' ? 'block' : 'none';
        document.getElementById('universalSearch').value = '';
    }

    async render(filter = "") {
        try {
            let q;
            // ЛОГІКА АДМІНА (Фільтр по обраному продавцю або всі)
            if (this.core.userRole === 'admin') {
                if (this.core.admin && this.core.admin.currentSellerFilter) {
                    q = query(collection(this.core.db, "orders"), where("sellerId", "==", this.core.admin.currentSellerFilter));
                } else {
                    q = query(collection(this.core.db, "orders")); // Всі замовлення бази
                }
            } else {
                // Звичайний продавець бачить тільки свої
                q = query(collection(this.core.db, "orders"), where("sellerId", "==", this.core.currentUser.uid));
            }
            
            const snap = await getDocs(q);
            let list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));

            list = list.filter(o => {
                const isHistory = o.status === 'history';
                if (this.currentTab === 'active') return !isHistory;
                return isHistory;
            });

            this.ordersData = list; 

            if(filter) {
                const f = filter.toLowerCase();
                list = list.filter(o => o.customerName.toLowerCase().includes(f) || o.customerPhone.includes(f) || o.ttn?.includes(f));
            }

            this.container.innerHTML = list.sort((a,b) => b.createdAt - a.createdAt).map(o => {
                const isBl = this.core.blacklistData.some(b => b.phone === o.customerPhone);
                const addrPrefix = o.addressType === 'street' ? '🛣️ Вулиця:' : '🏢 Відділення:';
                
                return `
                <div class="card" ${isBl ? 'style="border: 1px solid #ef9a9a;"' : ''}>
                    <div style="display:flex; justify-content:space-between"><b>${isBl ? '<span style="color:red;">[ЧС]</span> ' : ''}${o.customerName}</b> <span style="color:#ffb300; font-weight:bold;">${o.totalPrice} грн</span></div>
                    <div style="font-size:12px; color:#666">${o.customerPhone}</div>
                    <div style="font-size:13px; margin:5px 0">${o.items.map(i => `• ${i.name} (x${i.qty}) - ${i.price}₴`).join('<br>')}</div>
                    ${o.comment ? `<div style="font-size:12px; color:#e65100; margin-bottom:5px;">💬 ${o.comment}</div>` : ''}
                    
                    <div style="font-size:12px; border-top:1px solid #eee; padding-top:8px; margin-top:8px; color:#444;">
                        <b>${o.deliveryMethod === 'ukrposhta' ? '📫 Укрпошта' : '📦 Нова Пошта'}</b><br>
                        ${o.city || 'Адресу не вказано'} 
                        ${o.deliveryMethod === 'ukrposhta' && o.index ? `<br>Індекс: <b>${o.index}</b>` : ''} 
                        ${o.branch ? `<br>${addrPrefix} <b>${o.branch}</b>` : ''}
                    </div>
                    
                    ${o.ttn ? `<div class="status-box">
                                   <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px;">ТТН: ${o.ttn}</div>
                                   <div id="status-${o.id}" style="font-size:13px;">⏳ Завантаження статусу...</div>
                               </div>` 
                             : `<button class="btn-secondary btn-small" data-action="add-ttn" data-id="${o.id}" style="margin-top:10px; width:100%; padding:8px;">+ Додати ТТН</button>`}
                    
                    <div class="card-actions">
                        ${this.currentTab === 'active' ? `<button class="btn-secondary btn-small" data-action="complete" data-id="${o.id}" style="background:#e8f5e9; color:#2e7d32; flex:1;">✅ Виконано</button>` : ''}
                        <button class="btn-secondary btn-small" data-action="edit" data-id="${o.id}" style="background:#fff3e0; color:#e65100;">✏️ Редагувати</button>
                        <button class="btn-secondary btn-small" data-action="delete" data-id="${o.id}" style="background:#ffebee; color:#d32f2f;">🗑️ Видалити</button>
                    </div>
                </div>`;
            }).join('');

            this.fetchLiveStatuses(list);
        } catch (error) {
            console.error("Помилка рендеру:", error);
        }
    }

    calculateAnalytics() {
        const fromVal = document.getElementById('statDateFrom').value;
        const toVal = document.getElementById('statDateTo').value;
        const resultDiv = document.getElementById('statResult');

        let filtered = this.ordersData;

        if (fromVal) {
            const fromTs = new Date(fromVal).setHours(0,0,0,0);
            filtered = filtered.filter(o => o.createdAt >= fromTs);
        }
        if (toVal) {
            const toTs = new Date(toVal).setHours(23,59,59,999);
            filtered = filtered.filter(o => o.createdAt <= toTs);
        }

        let totalSum = 0;
        let itemsMap = {};

        filtered.forEach(o => {
            totalSum += o.totalPrice || 0;
            if (o.items) {
                o.items.forEach(item => {
                    if (!itemsMap[item.name]) itemsMap[item.name] = 0;
                    itemsMap[item.name] += item.qty;
                });
            }
        });

        if (filtered.length === 0) {
            resultDiv.innerHTML = "<span style='color:red;'>За цей період немає виконаних замовлень.</span>";
            return;
        }

        let html = `
        <details style="margin-bottom: 15px; background: #fafafa; padding: 12px; border-radius: 8px; border: 1px solid #ddd; cursor: pointer;">
            <summary style="font-size: 16px; font-weight: bold; color: #2e7d32; outline: none;">
                💰 Показати загальний дохід
            </summary>
            <div style="font-size: 16px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; color: #333;">
                Загальний дохід: <b style="color:#2e7d32; font-size:20px;">${totalSum} грн</b>
            </div>
        </details>`;
        
        html += `<b style="color:#444;">Продано товарів:</b><ul style="margin-top:5px; padding-left:20px; color:#555;">`;
        for (const [name, qty] of Object.entries(itemsMap)) {
            html += `<li style="margin-bottom: 3px;">${name}: <b style="color:#000;">${qty} шт.</b></li>`;
        }
        html += `</ul>`;
        
        resultDiv.innerHTML = html;
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

                        el.innerHTML = `<span style="color:#2e7d32;"><b>${statusStr}</b></span><br><span style="font-size:11px; color:#666;">Відправлено: ${res.data[0].DateCreated || "-"}</span>`;
                        
                        if (o.status !== 'history' && (statusCode === "9" || statusCode === "10" || statusCode === "11" || statusStr.toLowerCase().includes("одержано"))) {
                            await updateDoc(doc(this.core.db, "orders", o.id), { status: 'history' });
                            hasAutoCompleted = true;
                        }
                    } else {
                        el.innerHTML = "Статус не знайдено";
                    }
                } else {
                    const upToken = "e66c7553-9d16-3e74-b52b-45610665ed5b"; 
                    const targetUrl = `https://www.ukrposhta.ua/status-tracking/0.0.1/statuses?barcode=${o.ttn}`;
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

                    const res = await fetch(proxyUrl, {
                        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${upToken}` }
                    });

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
                        } else { el.innerHTML = "Посилка ще не відслідковується"; }
                    } else { throw new Error("Proxy Error"); }
                }
            } catch (e) {
                const link = isNovaPoshta ? `https://tracking.novaposhta.ua/#/uk/?en=${o.ttn}` : `https://track.ukrposhta.ua/tracking_UA.html?barcode=${o.ttn}`;
                el.innerHTML = `<a href="${link}" target="_blank" style="color: #1976d2; font-weight: bold; text-decoration: none;">🔗 Перевірити статус на сайті ↗</a>`;
            }
        }

        if (hasAutoCompleted && this.currentTab === 'active') { this.render(); }
    }
}