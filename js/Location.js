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
            cityInput.style.borderColor = '#ffb300'; // Жовтий колір під час завантаження
            try {
                // Використовуємо офіційний API Укрпошти через проксі (як у трекінгу)
                const upToken = "e66c7553-9d16-3e74-b52b-45610665ed5b"; 
                const targetUrl = `https://www.ukrposhta.ua/address-classifier-ws/get_city_by_postcode?postcode=${digits}`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                
                const res = await fetch(proxyUrl, {
                    headers: { 
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${upToken}` 
                    }
                });
                
                if (!res.ok) throw new Error("Помилка API Укрпошти");
                
                const text = await res.text();
                
                // Витягуємо дані через регулярні вирази, щоб не залежати від змін структури JSON
                const cityMatch = text.match(/"CITY_UA"\s*:\s*"([^"]+)"/i);
                const regionMatch = text.match(/"REGION_UA"\s*:\s*"([^"]+)"/i);
                const districtMatch = text.match(/"DISTRICT_UA"\s*:\s*"([^"]+)"/i);

                if (cityMatch && cityMatch[1]) {
                    const name = cityMatch[1];
                    let parts = [name];
                    
                    if (regionMatch && regionMatch[1] && regionMatch[1] !== name && regionMatch[1] !== 'Київ') {
                        parts.push(regionMatch[1] + ' обл.');
                    }
                    if (districtMatch && districtMatch[1] && districtMatch[1] !== name && districtMatch[1] !== regionMatch?.[1]) {
                        parts.push(districtMatch[1] + ' р-н.');
                    }
                    
                    cityInput.value = parts.join(', ');
                    cityInput.style.borderColor = '#4caf50'; // Зелений колір при успіху
                } else {
                    throw new Error("Місто не знайдено");
                }
            } catch(e) {
                console.warn("Помилка пошуку по індексу Укрпошти:", e);
                cityInput.style.borderColor = '#d32f2f'; // Червоний колір при помилці
            } finally {
                setTimeout(() => cityInput.style.borderColor = '', 2000);
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
