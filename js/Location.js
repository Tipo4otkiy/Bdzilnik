export class LocationManager {
    constructor() {
        this.cityDebounce = null;
        this.branchDebounce = null;
        this.indexDebounce = null;
        this.currentCityRef = "";
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
        
        // Автопошук міста по індексу Укрпошти
        document.getElementById('newIndex').addEventListener('input', (e) => this.searchCityByIndex(e.target.value));

        document.addEventListener('click', (e) => { 
            if(e.target.id !== 'newCity') document.getElementById('citySuggestions').style.display = 'none';
            if(e.target.id !== 'newBranch') document.getElementById('branchSuggestions').style.display = 'none';
        });
    }

    // Пошук міста за поштовим індексом Укрпошти
    async searchCityByIndex(val) {
        clearTimeout(this.indexDebounce);
        const cityInput = document.getElementById('newCity');
        const digits = val.replace(/\D/g, '');
        if (digits.length < 5) return;

        this.indexDebounce = setTimeout(async () => {
            // Шукаємо населений пункт через Нову Пошту по назві (індекс → місто через відкритий API)
            // Спочатку пробуємо через Nova Poshta: шукаємо settlement за індексом
            try {
                const res = await fetch("https://api.novaposhta.ua/v2.0/json/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        apiKey: "",
                        modelName: "Address",
                        calledMethod: "getSettlements",
                        methodProperties: { Index: digits, Limit: "1" }
                    })
                }).then(r => r.json());

                if (res.success && res.data && res.data.length > 0) {
                    const s = res.data[0];
                    const type = s.SettlementTypeDescription || '';
                    const name = s.Description || '';
                    const region = s.RegionsDescription || '';
                    const area = s.AreaDescription || '';
                    const parts = [type && name ? `${type} ${name}` : name];
                    if (area) parts.push(area + ' обл.');
                    if (region) parts.push(region + ' р-н.');
                    cityInput.value = parts.filter(Boolean).join(', ');
                    cityInput.style.borderColor = '#4caf50';
                    setTimeout(() => cityInput.style.borderColor = '', 2000);
                    return;
                }
            } catch(e) { /* fallback нижче */ }

            // Fallback: шукаємо через searchSettlements з індексом як текст
            try {
                const res2 = await fetch("https://api.novaposhta.ua/v2.0/json/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        apiKey: "",
                        modelName: "Address",
                        calledMethod: "searchSettlements",
                        methodProperties: { CityName: digits, Limit: "5" }
                    })
                }).then(r => r.json());

                if (res2.data && res2.data[0] && res2.data[0].Addresses.length > 0) {
                    const city = res2.data[0].Addresses[0];
                    const type = city.SettlementTypeCode || '';
                    const name = city.MainDescription || '';
                    let desc = '';
                    if (city.Area) desc += city.Area + ' обл.';
                    if (city.Region) desc += ', ' + city.Region + ' р-н.';
                    cityInput.value = `${type}. ${name}${desc ? ' - ' + desc : ''}`;
                    cityInput.style.borderColor = '#4caf50';
                    setTimeout(() => cityInput.style.borderColor = '', 2000);
                }
            } catch(e) {
                console.warn("Помилка пошуку по індексу:", e);
            }
        }, 700);
    }

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
                        apiKey: "", 
                        modelName: "Address", 
                        calledMethod: "searchSettlements", 
                        methodProperties: { CityName: val, Limit: "50" } 
                    }) 
                }).then(r => r.json());
                
                box.innerHTML = '';
                if (res.data && res.data[0] && res.data[0].Addresses.length > 0) {
                    res.data[0].Addresses.forEach(city => {
                        const type = city.SettlementTypeCode; 
                        const name = city.MainDescription;
                        let desc = "";
                        if (city.Area) desc += `${city.Area} обл.`;
                        if (city.Region) desc += `, ${city.Region} р-н.`;
                        
                        const div = document.createElement('div'); 
                        div.className = 'suggestion-item'; 
                        div.innerHTML = `<b>${type}. ${name}</b> <span style="font-size:13px; color:#666;">${desc ? '- ' + desc : ''}</span>`;
                        
                        div.onclick = () => { 
                            document.getElementById('newCity').value = `${type}. ${name}${desc ? ' - ' + desc : ''}`; 
                            this.currentCityRef = city.DeliveryCity; 
                            box.style.display = 'none'; 
                            const delivType = document.querySelector('input[name="deliveryType"]:checked').value;
                            delivType === 'ukrposhta' 
                                ? document.getElementById('newIndex').focus() 
                                : document.getElementById('newBranch').focus();
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

    searchBranch(val) {
        clearTimeout(this.branchDebounce);
        const box = document.getElementById('branchSuggestions');
        const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
        const addressType = document.querySelector('input[name="addressType"]:checked').value;
        
        // Відключаємо підказки відділень якщо вибрана Вулиця або Укрпошта
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
                        apiKey: "", 
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
                if (res.data && res.data.length > 0) {
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
