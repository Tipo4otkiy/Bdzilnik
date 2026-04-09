export class LocationManager {
    constructor() {
        this.cityDebounce = null;
        this.branchDebounce = null;
        this.indexDebounce = null;
        this.currentCityRef = "";
        
        // Встав сюди свій ключ Нової Пошти, якщо він є. Якщо ні - залишай порожнім.
        this.apiKey = ""; 
        this.bindEvents();
    }

    bindEvents() {
        // Вибір служби доставки
        document.querySelectorAll('input[name="deliveryType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUkr = e.target.value === 'ukrposhta';
                document.getElementById('newIndex').style.display = isUkr ? 'block' : 'none';
                document.getElementById('newCity').value = ''; 
                document.getElementById('newBranch').value = ''; 
                document.getElementById('newIndex').value = '';
                this.currentCityRef = "";
            });
        });

        // Вибір типу адреси (Відділення / Вулиця)
        document.querySelectorAll('input[name="addressType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isBranch = e.target.value === 'branch';
                document.getElementById('newBranch').placeholder = isBranch ? "Номер або назва відділення..." : "Назва вулиці, будинок, квартира...";
                document.getElementById('branchSuggestions').style.display = 'none';
            });
        });

        document.getElementById('newCity').addEventListener('input', (e) => this.searchCity(e.target.value));
        document.getElementById('newBranch').addEventListener('input', (e) => this.searchBranch(e.target.value));
        
        // Автопошук міста по індексу
        document.getElementById('newIndex').addEventListener('input', (e) => this.searchCityByIndex(e.target.value));

        document.addEventListener('click', (e) => { 
            if(e.target.id !== 'newCity') document.getElementById('citySuggestions').style.display = 'none';
            if(e.target.id !== 'newBranch') document.getElementById('branchSuggestions').style.display = 'none';
        });
    }

    // 1. ПОШУК МІСТА ЗА ІНДЕКСОМ (Використовуємо Нову Пошту!)
    async searchCityByIndex(val) {
        clearTimeout(this.indexDebounce);
        const cityInput = document.getElementById('newCity');
        const digits = val.replace(/\D/g, '');
        if (digits.length < 5) return;

        // Не перезаписуємо, якщо місто вже введено руками
        if (cityInput.value.trim() !== '') return;

        this.indexDebounce = setTimeout(async () => {
            cityInput.style.borderColor = '#ffb300';
            try {
                // Нова Пошта вміє шукати по індексу через поле CityName!
                const res = await fetch("https://api.novaposhta.ua/v2.0/json/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        apiKey: this.apiKey,
                        modelName: "Address",
                        calledMethod: "searchSettlements",
                        methodProperties: { CityName: digits, Limit: "1" }
                    })
                }).then(r => r.json());

                if (res.success && res.data && res.data[0] && res.data[0].Addresses.length > 0) {
                    const city = res.data[0].Addresses[0];
                    const type = (city.SettlementTypeCode || '').replace('.', ''); 
                    const name = city.MainDescription;
                    let desc = "";
                    if (city.Area) desc += `${city.Area} обл.`;
                    if (city.Region) desc += `, ${city.Region} р-н.`;
                    
                    const fullName = `${type}. ${name}${desc ? ' - ' + desc : ''}`;
                    
                    if (cityInput.value.trim() === '') {
                        cityInput.value = fullName;
                        this.currentCityRef = city.DeliveryCity;
                        cityInput.style.borderColor = '#4caf50';
                    }
                } else {
                    cityInput.style.borderColor = '#d32f2f'; // Не знайдено
                }
            } catch(e) {
                console.error("Помилка пошуку по індексу:", e);
                cityInput.style.borderColor = '#d32f2f';
            } finally {
                setTimeout(() => cityInput.style.borderColor = '', 2000);
            }
        }, 700);
    }

    // 2. ПОШУК МІСТА ЗА НАЗВОЮ (з виправленим багом "м..")
    searchCity(val) {
        clearTimeout(this.cityDebounce);
        const box = document.getElementById('citySuggestions');
        if (val.length < 2) { box.style.display = 'none'; return; }

        box.innerHTML = '<div class="suggestion-loading">⏳ Шукаємо населений пункт...</div>';
        box.style.display = 'block';

        this.cityDebounce = setTimeout(async () => {
            try {
                const res = await fetch("https://api.novaposhta.ua/v2.0/json/", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        apiKey: this.apiKey, 
                        modelName: "Address", 
                        calledMethod: "searchSettlements", 
                        methodProperties: { CityName: val, Limit: "50" } 
                    }) 
                }).then(r => r.json());
                
                box.innerHTML = '';
                if (res.success && res.data && res.data[0] && res.data[0].Addresses.length > 0) {
                    res.data[0].Addresses.forEach(city => {
                        // Виправляємо баг з двома крапками
                        const type = (city.SettlementTypeCode || '').replace('.', ''); 
                        const name = city.MainDescription;
                        let desc = "";
                        if (city.Area) desc += `${city.Area} обл.`;
                        if (city.Region) desc += `, ${city.Region} р-н.`;
                        
                        const fullName = `${type}. ${name}${desc ? ' - ' + desc : ''}`;
                        
                        const div = document.createElement('div'); 
                        div.className = 'suggestion-item'; 
                        div.innerHTML = `<b>${type}. ${name}</b> <span style="font-size:13px; color:#666;">${desc ? '- ' + desc : ''}</span>`;
                        
                        div.onclick = async () => { 
                            document.getElementById('newCity').value = fullName; 
                            this.currentCityRef = city.DeliveryCity; 
                            box.style.display = 'none'; 
                            
                            const delivType = document.querySelector('input[name="deliveryType"]:checked').value;
                            if (delivType === 'ukrposhta') {
                                document.getElementById('newIndex').focus();
                                // Одразу підтягуємо індекс
                                await this.fetchIndexForCity(city.Ref || city.DeliveryCity);
                            } else {
                                document.getElementById('newBranch').focus();
                            }
                        }; 
                        box.appendChild(div);
                    });
                } else { 
                    box.innerHTML = '<div class="suggestion-item">Нічого не знайдено</div>'; 
                }
            } catch(e) { 
                box.innerHTML = '<div class="suggestion-item">Помилка пошуку</div>'; 
            }
        }, 300);
    }

    // 3. ПІДТЯГУВАННЯ ІНДЕКСУ ЗА ОБРАНИМ МІСТОМ
    async fetchIndexForCity(cityRef) {
        if (!cityRef) return;
        const indexInput = document.getElementById('newIndex');
        
        // Не замінюємо індекс, якщо користувач вже щось ввів сам
        if (indexInput.value.trim() !== '') return;

        indexInput.style.borderColor = '#ffb300';
        try {
            const res = await fetch("https://api.novaposhta.ua/v2.0/json/", { 
                method: "POST", 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    apiKey: this.apiKey, 
                    modelName: "Address", 
                    calledMethod: "getSettlements", 
                    methodProperties: { Ref: cityRef } 
                }) 
            }).then(r => r.json());
            
            if (res.success && res.data && res.data.length > 0) {
                // Беремо індекс Укрпошти з бази Нової Пошти
                const index = res.data[0].Index1 || res.data[0].Index2;
                if (index && indexInput.value.trim() === '') {
                    indexInput.value = index;
                    indexInput.style.borderColor = '#4caf50';
                }
            }
        } catch(e) {
            console.error("Помилка автозаповнення індексу:", e);
        } finally {
            setTimeout(() => indexInput.style.borderColor = '', 2000);
        }
    }

    // ПОШУК ВІДДІЛЕНЬ (без змін)
    searchBranch(val) {
        clearTimeout(this.branchDebounce);
        const box = document.getElementById('branchSuggestions');
        const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
        const addressType = document.querySelector('input[name="addressType"]:checked').value;
        
        if (deliveryType === 'ukrposhta' || addressType === 'street' || !this.currentCityRef) { 
            box.style.display = 'none'; 
            return; 
        }

        this.branchDebounce = setTimeout(async () => {
            try {
                const res = await fetch("https://api.novaposhta.ua/v2.0/json/", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        apiKey: this.apiKey, 
                        modelName: "Address", 
                        calledMethod: "getWarehouses", 
                        methodProperties: { 
                            CityRef: this.currentCityRef, 
                            FindByString: val, 
                            Limit: "20" 
                        } 
                    }) 
                }).then(r => r.json());
                
                box.innerHTML = '';
                if (res.success && res.data && res.data.length > 0) {
                    box.style.display = 'block';
                    res.data.forEach(b => {
                        const div = document.createElement('div'); 
                        div.className = 'suggestion-item'; 
                        div.innerText = b.Description;
                        div.onclick = () => { 
                            document.getElementById('newBranch').value = b.Description; 
                            box.style.display = 'none'; 
                        }; 
                        box.appendChild(div);
                    });
                } else { 
                    box.style.display = 'none'; 
                }
            } catch(e) {
                box.style.display = 'none';
            }
        }, 300);
    }
}