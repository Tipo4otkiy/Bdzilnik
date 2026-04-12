import { collection, addDoc, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { setupPhoneMask, formatPhoneString } from "./Utils.js";

export class OrderForm {
    constructor(core) {
        this.core = core;
        this.sheet = document.getElementById('orderModal');
        this.overlay = document.getElementById('orderModalOverlay');
        this.header = document.getElementById('orderModalHeader');
        this.dragHandle = document.getElementById('orderDragHandle');
        this.container = document.getElementById('itemsContainer');
        this.editingId = null;
        
        this.currentState = 'CLOSED'; // 'CLOSED', 'MINIMIZED', 'DEFAULT', 'FULLSCREEN'
        this.currentY = window.innerHeight;
        
        this.bindEvents();
        this.setupAutocomplete();
        this.setupSwipeLogic();
        setupPhoneMask('newPhone');
    }

    bindEvents() {
        document.getElementById('fabBtn').onclick = () => this.open();
        
        const completelyClose = () => this.snapTo('CLOSED');
        document.getElementById('closeOrderBtn').onclick = completelyClose;
        document.getElementById('closeOrderTopBtn').onclick = completelyClose;
        this.overlay.onclick = completelyClose;

        document.getElementById('addItemBtn').onclick = () => this.addItemRow();
        document.getElementById('saveOrderBtn').onclick = () => this.save();

        const handleUpdate = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                if (e.target.classList.contains('i-name')) {
                    const f = this.core.presets.find(p => p.name === e.target.value);
                    if (f) {
                        e.target.closest('.item-row-wrapper').querySelector('.i-price').value = f.price;
                        if (f.currency) e.target.closest('.item-row-wrapper').querySelector('.i-currency').value = f.currency;
                    }
                }
                this.calcTotal();
            }
        };

        this.container.addEventListener('input', handleUpdate);
        this.container.addEventListener('change', handleUpdate);
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-danger')) {
                e.target.closest('.item-row-wrapper').remove();
                this.calcTotal();
            }
        });

        document.getElementById('newPhone').addEventListener('input', (e) => {
            this.core.blacklist.checkWarning(e.target.value);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.item-autocomplete')) {
                document.querySelectorAll('.preset-suggestions').forEach(box => box.style.display = 'none');
            }
        });

        this.header.onclick = (e) => {
            if (window.innerWidth >= 768) return; // Без розгортання на ПК
            if (e.target.closest('button')) return;
            if (this.currentState === 'MINIMIZED') this.snapTo('DEFAULT');
            else if (this.currentState === 'DEFAULT') this.snapTo('FULLSCREEN');
            else if (this.currentState === 'FULLSCREEN') this.snapTo('DEFAULT');
        };
    }

    // --- ЛОГІКА ТЕЛЕГРАМ-ШТОРКИ ---

    setTransform(y) {
        if (window.innerWidth >= 768) return; // Не застосовуємо інлайн стилі на ПК
        
        this.currentY = y;
        this.sheet.style.transform = `translateY(${y}px)`;
        
        const h = window.innerHeight;
        if (y > h - 150) {
            document.getElementById('expandHint').style.display = 'inline-block';
            document.getElementById('orderModalTitleText').style.fontSize = '16px';
        } else {
            document.getElementById('expandHint').style.display = 'none';
            document.getElementById('orderModalTitleText').style.fontSize = '19px';
        }
        
        if (y < 20) this.sheet.style.borderRadius = '0';
        else this.sheet.style.borderRadius = '20px 20px 0 0';
    }

    snapTo(state) {
        this.currentState = state;
        const isDesktop = window.innerWidth >= 768;

        if (!isDesktop) {
            this.sheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), border-radius 0.3s';
        }

        const h = window.innerHeight;
        let targetY = 0;
        
        if (state === 'CLOSED') {
            targetY = h;
            this.overlay.style.opacity = '0';
            this.overlay.style.pointerEvents = 'none';
            if (isDesktop) this.sheet.style.opacity = '0';

            setTimeout(() => { 
                if(this.currentState === 'CLOSED') { 
                    this.overlay.style.display = 'none'; 
                    this.sheet.style.display = 'none'; 
                } 
            }, 300);
        } else if (state === 'MINIMIZED') {
            if (isDesktop) return this.snapTo('CLOSED'); // На ПК відразу закриваємо

            targetY = h - 70;
            this.overlay.style.opacity = '0';
            this.overlay.style.pointerEvents = 'none';
            this.sheet.style.display = 'flex';
            setTimeout(() => { if(this.currentState === 'MINIMIZED') this.overlay.style.display = 'none'; }, 300);
        } else if (state === 'DEFAULT' || state === 'FULLSCREEN') {
            targetY = state === 'DEFAULT' ? h * 0.15 : 0;
            this.overlay.style.display = 'block';
            this.overlay.style.pointerEvents = 'auto';
            this.sheet.style.display = 'flex';
            
            setTimeout(() => {
                this.overlay.style.opacity = '1';
                if (isDesktop) this.sheet.style.opacity = '1';
            }, 10);
        }
        
        if (!isDesktop) {
            this.setTransform(targetY);
        } else {
            this.sheet.style.transform = ''; // Дозволяємо CSS центрувати вікно на ПК
        }
    }

    setupSwipeLogic() {
        const scrollArea = this.sheet.querySelector('.modal-scrollable-content');
        let startY = 0;
        let startTranslateY = 0;
        let isDraggingSheet = false;
        let startTime = 0;

        const handleTouchStart = (e) => {
            if (window.innerWidth >= 768) return; // Без свайпів на ПК
            
            startY = e.touches[0].clientY;
            startTranslateY = this.currentY;
            startTime = Date.now();
            
            const inScrollArea = e.target.closest('.modal-scrollable-content');
            const isHeaderArea = e.target.closest('#orderModalHeader') || e.target.closest('#orderDragHandle');

            if (this.currentState === 'MINIMIZED') {
                isDraggingSheet = true;
            } else if (isHeaderArea) {
                isDraggingSheet = true;
            } else if (inScrollArea && scrollArea.scrollTop <= 0) {
                isDraggingSheet = true;
            } else {
                isDraggingSheet = false;
            }

            if (isDraggingSheet) {
                this.sheet.style.transition = 'none';
            }
        };

        const handleTouchMove = (e) => {
            if (!isDraggingSheet) return;
            let deltaY = e.touches[0].clientY - startY;

            const isHeaderArea = e.target.closest('#orderModalHeader') || e.target.closest('#orderDragHandle');
            if (!isHeaderArea && deltaY < 0 && this.currentState === 'FULLSCREEN') {
                isDraggingSheet = false;
                this.sheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                return; 
            }
            
            let newY = startTranslateY + deltaY;
            if (newY < 0) newY = 0; 
            
            this.setTransform(newY);
            if (e.cancelable) e.preventDefault(); 
        };

        const handleTouchEnd = (e) => {
            if (!isDraggingSheet) return;
            isDraggingSheet = false;
            
            let deltaY = e.changedTouches[0].clientY - startY;
            let velocity = deltaY / (Date.now() - startTime);
            const h = window.innerHeight;

            if (velocity > 0.6) {
                if (this.currentState === 'FULLSCREEN') this.snapTo('DEFAULT');
                else this.snapTo('MINIMIZED');
            } else if (velocity < -0.6) {
                if (this.currentState === 'MINIMIZED') this.snapTo('DEFAULT');
                else this.snapTo('FULLSCREEN');
            } else {
                let pos = this.currentY;
                let distFull = Math.abs(pos - 0);
                let distDef = Math.abs(pos - h * 0.15);
                let distMin = Math.abs(pos - (h - 70));

                let min = Math.min(distFull, distDef, distMin);
                if (min === distFull) this.snapTo('FULLSCREEN');
                else if (min === distDef) this.snapTo('DEFAULT');
                else this.snapTo('MINIMIZED');
            }
        };

        this.sheet.addEventListener('touchstart', handleTouchStart, { passive: true });
        this.sheet.addEventListener('touchmove', handleTouchMove, { passive: false });
        this.sheet.addEventListener('touchend', handleTouchEnd);
    }

    // ----------------------------------

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
                    
                    let namesToSearch = [];
                    if (c.knownNames && c.knownNames.length > 0) {
                        namesToSearch = c.knownNames.map(v => typeof v === 'string' ? v : v.n);
                    }
                    if (c.name && !namesToSearch.includes(c.name)) namesToSearch.push(c.name);
                    
                    return namesToSearch.some(n => (n || '').toLowerCase().includes(val));
                }).slice(0, 5);

                if (matches.length > 0) {
                    box.style.display = 'block';
                    matches.forEach(m => {
                        const isBl = this.core.blacklistData.some(b => b.cleanPhone === this._cleanPhone(m.phone));
                        
                        let variants = m.knownNames || [];
                        let parsedVariants = [];
                        
                        if (variants.length > 0) {
                            if (typeof variants[0] === 'string') {
                                parsedVariants = variants.map(v => ({ n: v, s: m.sellerId || 'legacy' }));
                            } else {
                                parsedVariants = [...variants];
                            }
                        }
                        
                        if (!parsedVariants.some(v => v.n === m.name) && m.name) {
                            parsedVariants.unshift({ n: m.name, s: m.sellerId || 'legacy' });
                        } else if (m.name) {
                            const mainIdx = parsedVariants.findIndex(v => v.n === m.name);
                            if (mainIdx > 0) {
                                const mainVar = parsedVariants.splice(mainIdx, 1)[0];
                                parsedVariants.unshift(mainVar);
                            }
                        }

                        let uniqueVariants = [];
                        let seen = new Set();
                        for (let v of parsedVariants) {
                            let lower = (v.n || '').toLowerCase();
                            if (!seen.has(lower)) {
                                seen.add(lower);
                                uniqueVariants.push(v);
                            }
                        }

                        uniqueVariants.forEach((variant, index) => {
                            if (!variant || !variant.n) return;
                            
                            const singleName = variant.n;
                            const isMyVariant = variant.s === this.core.currentUser.uid;
                            const isAlias = index > 0;
                            
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            
                            div.style.padding = '10px 12px';
                            if (isAlias) div.style.paddingLeft = '25px';
                            
                            if (isMyVariant) {
                                div.style.background = '#f4fbf4';
                                div.style.border = '2px solid #81c784'; 
                                div.style.borderRadius = '8px';
                                div.style.margin = '4px'; 
                            } else if (isAlias) {
                                div.style.background = '#fafbfc';
                                div.style.border = 'none';
                                div.style.borderTop = '1px dashed #eee';
                                div.style.borderRadius = '0';
                                div.style.margin = '0';
                            } else {
                                div.style.background = 'white';
                                div.style.border = 'none';
                                div.style.borderRadius = '0';
                                div.style.margin = '0';
                            }

                            const prefix = isAlias && !isMyVariant ? '<span style="color:#ccc; margin-right:4px; flex-shrink: 0;">↳</span>' : '';
                            const tag = isMyVariant ? '<span style="font-size:9px; color:#4caf50; background:#e8f5e9; border: 1px solid #81c784; padding:2px 4px; border-radius:12px; font-weight:bold; white-space:nowrap; flex-shrink:0;">ВАШ ЗАПИС</span>' : '';
                            const phoneColor = isAlias ? '#bbb' : '#666';

                            div.innerHTML = `
                                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 6px;">
                                    <div style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; flex: 1;">
                                        ${isBl && !isAlias ? '<span style="color:red; font-weight:bold; flex-shrink: 0;">[ЧС]</span> ' : ''}
                                        ${prefix}
                                        <b style="color:${isAlias && !isMyVariant ? '#555' : '#000'}; word-break: break-word;">
                                            ${singleName}
                                        </b>
                                        <span style="color:${phoneColor}; white-space: nowrap;">
                                            (${m.phone})
                                        </span>
                                    </div>
                                    ${tag}
                                </div>
                            `;
                            
                            div.onmousedown = (e) => { 
                                e.preventDefault(); 
                                const chosenClientData = { ...m, name: singleName };
                                fillLogic(chosenClientData); 
                                box.style.display = 'none'; 
                                this.core.blacklist.checkWarning(m.phone); 
                            };
                            box.appendChild(div);
                        });
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
        document.getElementById('orderModalTitleText').innerText = id ? "Редагування" : "Нове замовлення";
        document.getElementById('blacklistWarning').style.display = 'none';

        document.getElementById('newIsUrgent').checked = data?.isUrgent || false;

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
        document.getElementById('newBranch').placeholder = addrType === 'branch' ? "Номер або назва відділення" : "Назва вулиці, будинок, квартира";

        this.core.location.currentCityRef = "";
        this.container.innerHTML = '<strong>Товари:</strong>';

        if (data?.items?.length) {
            data.items.forEach(i => this.addItemRow(i.name, i.qty, i.price, i.currency || '₴'));
        } else {
            this.addItemRow();
        }

        if (data) this.core.blacklist.checkWarning(data.customerPhone);
        this.calcTotal();
        
        this.snapTo('DEFAULT');
    }

    addItemRow(name = "", qty = 1, price = "", currency = "₴") {
        const r = document.createElement('div');
        r.className = 'item-row-wrapper';
        r.style.cssText = 'display: flex; gap: 6px; align-items: center; margin-bottom: 10px; width: 100%;';
        
        r.innerHTML = `
            <div class="item-autocomplete" style="position: relative; flex: 2; min-width: 0; margin: 0;">
                <input type="text" placeholder="Товар" class="i-name" value="${name}" autocomplete="off" style="margin: 0; width: 100%; box-sizing: border-box;">
                <div class="suggestions-box preset-suggestions" style="display:none; position: absolute; top: calc(100% + 2px); max-height: 200px; overflow-y: auto; width: 100%; z-index: 1001; text-align: left;"></div>
            </div>
            <input type="number" placeholder="К-во" class="i-qty" value="${qty}" min="1" style="flex: 0.6; min-width: 0; margin: 0;">
            <input type="number" placeholder="Ціна" class="i-price" value="${price}" min="0" style="flex: 1; min-width: 0; margin: 0;">
            <select class="i-currency" style="flex: 0 0 52px; padding: 10px 4px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; background: #fff; margin: 0; height: 46px;">
                <option value="₴" ${currency === '₴' ? 'selected' : ''}>₴</option>
                <option value="$" ${currency === '$' ? 'selected' : ''}>$</option>
            </select>
            <button type="button" class="btn-danger" title="Видалити" style="flex: 0 0 40px; width: 40px; height: 46px; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center; font-size: 16px;">✕</button>`;
            
        this.container.appendChild(r);

        const nameInput = r.querySelector('.i-name');
        const suggBox = r.querySelector('.preset-suggestions');
        const priceInput = r.querySelector('.i-price');
        const currencyInput = r.querySelector('.i-currency');

        const showSuggestions = () => {
            document.querySelectorAll('.preset-suggestions').forEach(box => {
                if (box !== suggBox) box.style.display = 'none';
            });

            const val = nameInput.value.toLowerCase().trim();
            suggBox.innerHTML = '';

            const matches = val === '' 
                ? this.core.presets 
                : this.core.presets.filter(p => p.name.toLowerCase().includes(val));

            if (matches.length > 0) {
                suggBox.style.display = 'block';
                matches.forEach(m => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%;"><b>${m.name}</b> <span style="color:#666; font-size:13px; font-weight:normal;">${m.price} ${m.currency || '₴'}</span></div>`;
                    
                    div.onmousedown = (e) => {
                        e.preventDefault(); 
                        nameInput.value = m.name;
                        priceInput.value = m.price;
                        if (m.currency) currencyInput.value = m.currency;
                        suggBox.style.display = 'none';
                        this.calcTotal(); 
                    };
                    suggBox.appendChild(div);
                });
            } else {
                suggBox.style.display = 'none';
            }
        };

        nameInput.addEventListener('input', showSuggestions);
        nameInput.addEventListener('focus', showSuggestions);
        this.calcTotal();
    }

    calcTotal() {
        let uah = 0, usd = 0;
        this.container.querySelectorAll('.i-qty').forEach(qtyInput => {
            const row = qtyInput.closest('.item-row-wrapper');
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
            const userCheck = await getDoc(doc(this.core.db, "users", this.core.currentUser.uid));
            if (!userCheck.exists()) throw new Error("Помилка доступу: ваш профіль було видалено.");

            const phone = document.getElementById('newPhone').value.trim();
            const name = document.getElementById('newName').value.trim();
            if (!phone || !name) throw new Error("Заповніть телефон та ім'я!");

            const items = [];
            this.container.querySelectorAll('.i-name').forEach(nameInput => {
                const row = nameInput.closest('.item-row-wrapper');
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
                isUrgent: document.getElementById('newIsUrgent').checked,
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
                const clientRef = doc(this.core.db, "clients", cleanPhone);
                const clientSnap = await getDoc(clientRef);
                
                let variants = [];
                let ownerId = this.core.currentUser.uid;
                
                if (clientSnap.exists()) {
                    const data = clientSnap.data();
                    variants = data.knownNames || [];
                    if (data.sellerId) ownerId = data.sellerId;
                    
                    if (variants.length > 0 && typeof variants[0] === 'string') {
                        variants = variants.map(oldName => ({ n: oldName, s: data.sellerId || 'legacy' }));
                    }
                }

                const myVariantIndex = variants.findIndex(v => v.s === this.core.currentUser.uid);

                if (myVariantIndex !== -1) {
                    variants[myVariantIndex].n = name; 
                } else {
                    variants.push({ n: name, s: this.core.currentUser.uid });
                }

                await setDoc(clientRef, { 
                    name: name,
                    phone: phone, 
                    knownNames: variants,
                    sellerId: ownerId
                }, { merge: true });
            }

            await this.core.loadClients();
            this.snapTo('CLOSED');
            
            document.getElementById('tabActiveBtn').click();
            this.core.orderList.render();
        } catch (err) {
            alert(err.message || "Помилка збереження");
            if (err.message.includes("профіль було видалено")) window.location.reload(); 
        } finally {
            btn.innerText = "Зберегти"; btn.disabled = false;
        }
    }
}