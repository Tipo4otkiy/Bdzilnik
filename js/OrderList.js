import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class OrderList {
    constructor(core) {
        this.core = core;
        this.container = document.getElementById('appContent');
        this.currentOrderIdForTtn = null;
        this.currentTab = 'active';
        this.ordersData = [];
        
        // Стан сортування (Головний екран)
        this.currentSearchText = '';
        this.sortField = 'date';
        this.sortOrder = 'desc';
        this.showUrgent = true;

        // Стан сортування (Кошик)
        this.deletedSearchText = '';
        this.deletedSortField = 'date';
        this.deletedSortOrder = 'desc';
        this.deletedShowUrgent = true;

        this.bindEvents();
    }

    bindEvents() {
        // --- ГОЛОВНИЙ ЕКРАН (ПОШУК І СОРТУВАННЯ) ---
        document.getElementById('universalSearch').addEventListener('input', (e) => {
            this.currentSearchText = e.target.value;
            this.render();
        });

        const sortDropdown = document.getElementById('sortDropdown');
        const sortOrderBtn = document.getElementById('sortOrderBtn');

        document.getElementById('openSortBtn').addEventListener('click', (e) => {
            e.stopPropagation(); 
            sortDropdown.style.display = sortDropdown.style.display === 'flex' ? 'none' : 'flex';
        });

        document.getElementById('sortField').addEventListener('change', (e) => {
            this.sortField = e.target.value;
            this.render();
        });

        sortOrderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
            sortOrderBtn.innerHTML = this.sortOrder === 'desc' ? '⬇️' : '⬆️';
            this.render();
        });

        document.getElementById('showUrgent').addEventListener('change', (e) => {
            this.showUrgent = e.target.checked;
            this.render();
        });

        // --- КОШИК (ПОШУК І СОРТУВАННЯ) ---
        document.getElementById('deletedSearch').addEventListener('input', (e) => {
            this.deletedSearchText = e.target.value;
            this.renderDeleted();
        });

        const deletedSortDropdown = document.getElementById('deletedSortDropdown');
        const deletedSortOrderBtn = document.getElementById('deletedSortOrderBtn');

        document.getElementById('openDeletedSortBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            deletedSortDropdown.style.display = deletedSortDropdown.style.display === 'flex' ? 'none' : 'flex';
        });

        document.getElementById('deletedSortField').addEventListener('change', (e) => {
            this.deletedSortField = e.target.value;
            this.renderDeleted();
        });

        deletedSortOrderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deletedSortOrder = this.deletedSortOrder === 'desc' ? 'asc' : 'desc';
            deletedSortOrderBtn.innerHTML = this.deletedSortOrder === 'desc' ? '⬇️' : '⬆️';
            this.renderDeleted();
        });

        document.getElementById('deletedShowUrgent').addEventListener('change', (e) => {
            this.deletedShowUrgent = e.target.checked;
            this.renderDeleted();
        });

        // --- ЗАКРИТТЯ МЕНЮ ПРИ КЛІКУ ПОЗА НИМИ ---
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#sortDropdown') && e.target.id !== 'openSortBtn') {
                if (sortDropdown) sortDropdown.style.display = 'none';
            }
            if (!e.target.closest('#deletedSortDropdown') && e.target.id !== 'openDeletedSortBtn') {
                if (deletedSortDropdown) deletedSortDropdown.style.display = 'none';
            }
        });

        // Вкладки
        document.getElementById('tabActiveBtn').addEventListener('click', () => {
            this.currentTab = 'active'; this.updateTabUI(); this.render();
        });
        document.getElementById('tabHistoryBtn').addEventListener('click', () => {
            this.currentTab = 'history'; this.updateTabUI(); this.render();
        });

        // Відкриття/Закриття кошика
        const deletedModal = document.getElementById('deletedModal');
        document.getElementById('openDeletedBtn').addEventListener('click', () => {
            deletedModal.style.display = 'flex';
            this.renderDeleted();
        });
        document.getElementById('closeDeletedBtn').addEventListener('click', () => {
            deletedModal.style.display = 'none';
            this.render();
        });

        // Дії із замовленнями
        const handleOrderActions = async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            const action = btn.dataset.action;

            if (action === 'edit') {
                const docRef = await getDoc(doc(this.core.db, "orders", id));
                if (docRef.exists()) this.core.orderForm.open(docRef.data(), id);
            }
            if (action === 'repeat') {
                const docRef = await getDoc(doc(this.core.db, "orders", id));
                if (docRef.exists()) {
                    this.core.orderForm.open(docRef.data(), null);
                }
            }
            if (action === 'delete') {
                if (confirm("Перемістити замовлення в Кошик (Видалені)?")) {
                    await updateDoc(doc(this.core.db, "orders", id), { status: 'deleted' });
                    this.render();
                }
            }
            if (action === 'add-ttn') {
                this.currentOrderIdForTtn = id;
                document.getElementById('ttnInput').value = btn.dataset.ttn || '';
                document.getElementById('ttnModal').style.display = 'flex';
            }
            if (action === 'complete') {
                if (confirm("Завершити замовлення і перенести в Історію?")) {
                    await updateDoc(doc(this.core.db, "orders", id), { status: 'history' });
                    this.render();
                }
            }
            if (action === 'restore') {
                if (confirm("Відновити замовлення? Воно повернеться у поточні/історію.")) {
                    await updateDoc(doc(this.core.db, "orders", id), { status: 'active' });
                    this.renderDeleted();
                }
            }
            if (action === 'hard-delete') {
                if (confirm("Назавжди видалити з бази? Цю дію НЕМОЖЛИВО відмінити!")) {
                    await deleteDoc(doc(this.core.db, "orders", id));
                    this.renderDeleted();
                }
            }
        };

        this.container.addEventListener('click', handleOrderActions);
        document.getElementById('deletedContent').addEventListener('click', handleOrderActions);

        // Збереження ТТН
        document.getElementById('closeTtnBtn').onclick = () => document.getElementById('ttnModal').style.display = 'none';
        document.getElementById('saveTtnBtn').onclick = async () => {
            const ttn = document.getElementById('ttnInput').value.trim().toUpperCase();
            if (ttn.length < 10) return alert("ТТН має містити мінімум 10 символів!");
            await updateDoc(doc(this.core.db, "orders", this.currentOrderIdForTtn), { ttn });
            document.getElementById('ttnModal').style.display = 'none';
            this.render();
            if (document.getElementById('deletedModal').style.display === 'flex') this.renderDeleted();
        };

        document.getElementById('calcStatBtn').addEventListener('click', () => this.calculateAnalytics());
        document.getElementById('convertStatBtn').addEventListener('click', () => this.convertAndSum());
    }

    updateTabUI() {
        document.getElementById('tabActiveBtn').className = `tab-btn ${this.currentTab === 'active' ? 'active' : ''}`;
        document.getElementById('tabHistoryBtn').className = `tab-btn ${this.currentTab === 'history' ? 'active' : ''}`;
        document.getElementById('historyAnalytics').style.display = this.currentTab === 'history' ? 'block' : 'none';
        document.getElementById('universalSearch').value = '';
        this.currentSearchText = '';
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

    _formatOrderSum(o) {
        const uah = o.totalPrice || 0;
        const usd = o.totalUSD || 0;
        if (uah > 0 && usd > 0) return `<span style="color:#ffb300; font-weight:bold;">${uah} ₴</span> <span style="color:#43a047; font-weight:bold;">+ ${usd} $</span>`;
        if (usd > 0) return `<span style="color:#43a047; font-weight:bold;">${usd} $</span>`;
        return `<span style="color:#ffb300; font-weight:bold;">${uah} ₴</span>`;
    }

    // УНІВЕРСАЛЬНИЙ МЕТОД ФІЛЬТРАЦІЇ ТА СОРТУВАННЯ
    _applySortAndFilters(list, isDeleted = false) {
        const searchText = isDeleted ? this.deletedSearchText : this.currentSearchText;
        const showUrgent = isDeleted ? this.deletedShowUrgent : this.showUrgent;
        const sortField = isDeleted ? this.deletedSortField : this.sortField;
        const sortOrder = isDeleted ? this.deletedSortOrder : this.sortOrder;

        // 1. Пошук
        if (searchText) {
            const f = searchText.toLowerCase();
            list = list.filter(o =>
                (o.customerName || '').toLowerCase().includes(f) ||
                (o.customerPhone || '').includes(f) ||
                (o.ttn || '').toLowerCase().includes(f)
            );
        }
        
        // 2. Фільтр видимості "Терміново"
        if (!showUrgent) {
            list = list.filter(o => !o.isUrgent);
        }

        // 3. Сортування
        list.sort((a, b) => {
            // Термінові ЗАВЖДИ закріплюємо зверху (якщо вони не приховані)
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;

            let result = 0;
            if (sortField === 'date') {
                result = (a.createdAt || 0) - (b.createdAt || 0);
            } else if (sortField === 'name') {
                result = (a.customerName || '').localeCompare(b.customerName || '');
            } else if (sortField === 'sum') {
                result = (a.totalPrice || 0) - (b.totalPrice || 0);
            }
            
            // Якщо вибрано спадання (⬇️), інвертуємо результат
            return sortOrder === 'desc' ? -result : result;
        });
        
        return list;
    }

    async render() {
        try {
            let q;
            if (this.core.userRole === 'admin' && this.core.admin?.currentSellerFilter) {
                q = query(collection(this.core.db, "orders"), where("sellerId", "==", this.core.admin.currentSellerFilter));
            } else if (this.core.userRole === 'admin') {
                q = query(collection(this.core.db, "orders"));
            } else {
                q = query(collection(this.core.db, "orders"), where("sellerId", "==", this.core.currentUser.uid));
            }

            const snap = await getDocs(q);
            let list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));

            // Відкидаємо видалені та фільтруємо по вкладці
            list = list.filter(o => {
                if (o.status === 'deleted') return false; 
                const isHistory = o.status === 'history';
                return this.currentTab === 'active' ? !isHistory : isHistory;
            });

            this.ordersData = list;
            
            // Застосовуємо фільтри для головного екрана
            list = this._applySortAndFilters(list, false);

            if (list.length === 0) {
                // ТУТ ЗМІНЕНО: grid-column: 1 / -1; щоб текст розтягувався на 2 колонки на ПК
                this.container.innerHTML = `<div style="text-align:center; color:#999; padding: 40px 20px; grid-column: 1 / -1;">
                    <div style="font-size:40px; margin-bottom:10px;">${this.currentTab === 'active' ? '📭' : '🕰️'}</div>
                    <div>Немає замовлень, які відповідають критеріям</div>
                </div>`;
                return;
            }

            this.container.innerHTML = list.map(o => {
                const isBl = this._isBlacklisted(o.customerPhone);
                const addrPrefix = o.addressType === 'street' ? '🛣️ Вулиця:' : '🏢 Відділення:';
                const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                
                const urgentHtml = o.isUrgent ? '<span style="background: #ffe0b2; color: #e65100; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 5px; vertical-align: middle;">🔥 Терміново</span>' : '';

                const itemsHtml = (o.items || []).map(i => {
                    const cur = i.currency || '₴';
                    return `• ${i.name} (x${i.qty}) — ${i.price} ${cur}`;
                }).join('<br>');

                return `
                <div class="card" ${isBl || o.isUrgent ? `style="border: 2px solid ${isBl ? '#ef9a9a' : '#ffe0b2'};"` : ''}>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <b style="font-size:15px; line-height: 1.4;">${isBl ? '<span style="color:red;">[ЧС]</span> ' : ''}${urgentHtml}${o.customerName || ''}</b>
                        <div style="text-align:right; line-height:1.4; white-space: nowrap; margin-left: 5px;">${this._formatOrderSum(o)}</div>
                    </div>
                    <div style="font-size:12px; color:#888; margin-bottom:4px; margin-top:2px;">${dateStr}</div>
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
                               <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                                   <div style="font-size:13px; font-weight:bold; word-break: break-all;">ТТН: ${o.ttn}</div>
                                   <button class="btn-secondary btn-small" data-action="add-ttn" data-id="${o.id}" data-ttn="${o.ttn}" style="margin:0 0 0 10px; padding:4px 8px; font-size:11px; flex-shrink:0;">✏️ Змінити</button>
                               </div>
                               <div id="status-${o.id}" style="font-size:13px; color:#888; margin-top:5px;">⏳ Завантаження статусу...</div>
                           </div>`
                        : `<button class="btn-secondary btn-small" data-action="add-ttn" data-id="${o.id}" style="margin-top:10px; width:100%; padding:10px;">+ Додати ТТН</button>`
                    }

                    <div class="card-actions">
                        ${this.currentTab === 'active'
                            ? `<button class="btn-secondary btn-small" data-action="complete" data-id="${o.id}" style="background:#e8f5e9; color:#2e7d32; flex:1;">✅ Виконано</button>`
                            : `<button class="btn-secondary btn-small" data-action="repeat" data-id="${o.id}" style="background:#e3f2fd; color:#1976d2; flex-shrink: 0;">🔄 Повторити</button>`
                        }
                        <button class="btn-secondary btn-small" data-action="edit" data-id="${o.id}" style="background:#fff3e0; color:#e65100;">✏️ Ред.</button>
                        <button class="btn-secondary btn-small" data-action="delete" data-id="${o.id}" style="background:#ffebee; color:#d32f2f;">🗑️ Видалити</button>
                    </div>
                </div>`;
            }).join('');

            this.fetchLiveStatuses(list);
        } catch (error) {
            console.error("Помилка рендеру:", error);
            this.container.innerHTML = `<div style="text-align:center; color:#d32f2f; padding:30px; grid-column: 1 / -1;">Помилка завантаження. Перевірте підключення.</div>`;
        }
    }

    async renderDeleted() {
        const container = document.getElementById('deletedContent');
        container.innerHTML = '<div style="text-align:center; padding: 20px; color: #888; grid-column: 1 / -1;">⏳ Завантаження кошика...</div>';

        try {
            let q;
            if (this.core.userRole === 'admin' && this.core.admin?.currentSellerFilter) {
                q = query(collection(this.core.db, "orders"), where("sellerId", "==", this.core.admin.currentSellerFilter));
            } else if (this.core.userRole === 'admin') {
                q = query(collection(this.core.db, "orders"));
            } else {
                q = query(collection(this.core.db, "orders"), where("sellerId", "==", this.core.currentUser.uid));
            }

            const snap = await getDocs(q);
            let list = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.status === 'deleted') list.push({ id: d.id, ...data });
            });

            // Застосовуємо фільтри спеціально для кошика
            list = this._applySortAndFilters(list, true);

            if (list.length === 0) {
                // ТУТ ЗМІНЕНО: grid-column: 1 / -1;
                container.innerHTML = `<div style="text-align:center; color:#999; padding: 40px 20px; grid-column: 1 / -1;">
                    <div style="font-size:40px; margin-bottom:10px;">🗑️</div>
                    <div>Кошик порожній або нічого не знайдено</div>
                </div>`;
                return;
            }

            container.innerHTML = list.map(o => {
                const isBl = this._isBlacklisted(o.customerPhone);
                const addrPrefix = o.addressType === 'street' ? '🛣️ Вулиця:' : '🏢 Відділення:';
                const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                
                const urgentHtml = o.isUrgent ? '<span style="background: #ffe0b2; color: #e65100; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 5px; vertical-align: middle;">🔥 Терміново</span>' : '';

                const itemsHtml = (o.items || []).map(i => {
                    const cur = i.currency || '₴';
                    return `• ${i.name} (x${i.qty}) — ${i.price} ${cur}`;
                }).join('<br>');

                return `
                <div class="card" style="${isBl || o.isUrgent ? `border: 2px solid ${isBl ? '#ef9a9a' : '#ffe0b2'};` : ''} opacity: 0.85; background: #fafafa;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <b style="font-size:15px; text-decoration: line-through; color:#777;">${isBl ? '<span style="color:red;">[ЧС]</span> ' : ''}${urgentHtml}${o.customerName || ''}</b>
                        <div style="text-align:right; line-height:1.4; filter: grayscale(1);">${this._formatOrderSum(o)}</div>
                    </div>
                    <div style="font-size:12px; color:#aaa; margin-bottom:4px;">${dateStr}</div>
                    <div style="font-size:12px; color:#888">${o.customerPhone || ''}</div>
                    <div style="font-size:13px; margin:8px 0; line-height:1.7; color:#666;">${itemsHtml}</div>
                    ${o.comment ? `<div style="font-size:12px; color:#e65100; margin-bottom:5px; background:#fff3e0; padding:6px 8px; border-radius:6px; opacity:0.8;">💬 ${o.comment}</div>` : ''}

                    <div style="font-size:12px; border-top:1px solid #eee; padding-top:8px; margin-top:8px; color:#888;">
                        <b>${o.deliveryMethod === 'ukrposhta' ? '📫 Укрпошта' : '📦 Нова Пошта'}</b><br>
                        ${o.city || '<span style="color:#bbb;">Адресу не вказано</span>'}
                        ${o.deliveryMethod === 'ukrposhta' && o.index ? `<br>Індекс: <b>${o.index}</b>` : ''}
                        ${o.branch ? `<br>${addrPrefix} <b>${o.branch}</b>` : ''}
                    </div>

                    ${o.ttn
                        ? `<div class="status-box" style="opacity: 0.9; background: #fff;">
                               <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                   <div style="font-size:13px; font-weight:bold; word-break: break-all; color:#555;">ТТН: ${o.ttn}</div>
                                   <button class="btn-secondary btn-small" data-action="add-ttn" data-id="${o.id}" data-ttn="${o.ttn}" style="margin:0 0 0 10px; padding:4px 8px; font-size:11px; flex-shrink:0;">✏️ Змінити</button>
                               </div>
                           </div>`
                        : `<button class="btn-secondary btn-small" data-action="add-ttn" data-id="${o.id}" style="margin-top:10px; width:100%; padding:10px;">+ Додати ТТН</button>`
                    }

                    <div class="card-actions" style="margin-top: 15px; flex-wrap: nowrap; gap: 8px;">
                        <button class="btn-secondary btn-small" data-action="restore" data-id="${o.id}" style="background:#e8f5e9; color:#2e7d32; flex:1.5; padding:10px; font-size:13px; font-weight:bold;">🔄 Відновити</button>
                        <button class="btn-secondary btn-small" data-action="edit" data-id="${o.id}" style="background:#fff3e0; color:#e65100; flex:1; padding:10px;">✏️ Ред.</button>
                        <button class="btn-secondary btn-small" data-action="hard-delete" data-id="${o.id}" style="background:#ffebee; color:#d32f2f; flex:1; padding:10px;">❌ Знищити</button>
                    </div>
                </div>`;
            }).join('');
            
        } catch (error) {
            console.error("Помилка рендеру кошика:", error);
            container.innerHTML = `<div style="text-align:center; color:#d32f2f; padding:30px; grid-column: 1 / -1;">Помилка завантаження кошика.</div>`;
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

            const rateRes = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json').then(r => r.json());
            const rate = rateRes[0]?.rate;
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