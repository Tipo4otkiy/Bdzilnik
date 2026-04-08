export class LocationManager {
    constructor() {
        this.cityDebounce = null;
        this.branchDebounce = null;
        this.currentCityRef = "";
        this.bindEvents();
    }

    bindEvents() {
        // Выбор службы доставки
        document.querySelectorAll('input[name="deliveryType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUkr = e.target.value === 'ukrposhta';
                document.getElementById('newIndex').style.display = isUkr ? 'block' : 'none';
                document.getElementById('newCity').value = ''; 
                document.getElementById('newBranch').value = ''; 
                document.getElementById('newIndex').value = '';
            });
        });

        // Выбор типа адреса (Отделение / Улица)
        document.querySelectorAll('input[name="addressType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isBranch = e.target.value === 'branch';
                document.getElementById('newBranch').placeholder = isBranch ? "Номер або назва відділення..." : "Назва вулиці, будинок, квартира...";
                document.getElementById('branchSuggestions').style.display = 'none';
            });
        });

        document.getElementById('newCity').addEventListener('input', (e) => this.searchCity(e.target.value));
        document.getElementById('newBranch').addEventListener('input', (e) => this.searchBranch(e.target.value));
        document.addEventListener('click', (e) => { 
            if(e.target.id !== 'newCity') document.getElementById('citySuggestions').style.display = 'none';
            if(e.target.id !== 'newBranch') document.getElementById('branchSuggestions').style.display = 'none';
        });
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
                    body: JSON.stringify({ apiKey: "", modelName: "Address", calledMethod: "searchSettlements", methodProperties: { CityName: val, Limit: "50" } }) 
                }).then(r => r.json());
                
                box.innerHTML = '';
                if (res.data && res.data[0] && res.data[0].Addresses.length > 0) {
                    res.data[0].Addresses.forEach(city => {
                        const type = city.SettlementTypeCode; 
                        const name = city.MainDescription;
                        let desc = "";
                        if (city.Area) desc += `${city.Area} обл.`;
                        if (city.Region) desc += `, ${city.Region} р-н.`;
                        
                        const div = document.createElement('div'); div.className = 'suggestion-item'; 
                        div.innerHTML = `<b>${type}. ${name}</b> <span style="font-size:13px; color:#666;">${desc ? '- ' + desc : ''}</span>`;
                        
                        div.onclick = () => { 
                            document.getElementById('newCity').value = `${type}. ${name}${desc ? ' - ' + desc : ''}`; 
                            this.currentCityRef = city.DeliveryCity; 
                            box.style.display = 'none'; 
                            document.querySelector('input[name="deliveryType"]:checked').value === 'ukrposhta' ? document.getElementById('newIndex').focus() : document.getElementById('newBranch').focus();
                        }; 
                        box.appendChild(div);
                    });
                } else { box.innerHTML = '<div class="suggestion-item">Нічого не знайдено</div>'; }
            } catch(e) { box.innerHTML = '<div class="suggestion-item">Помилка пошуку</div>'; }
        }, 300);
    }

    searchBranch(val) {
        clearTimeout(this.branchDebounce);
        const box = document.getElementById('branchSuggestions');
        const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
        const addressType = document.querySelector('input[name="addressType"]:checked').value;
        
        // Отключаем подсказки отделений, если выбрана Улица или Укрпочта
        if (deliveryType === 'ukrposhta' || addressType === 'street' || !this.currentCityRef) { 
            box.style.display = 'none'; 
            return; 
        }

        this.branchDebounce = setTimeout(async () => {
            try {
                const res = await fetch("https://api.novaposhta.ua/v2.0/json/", { 
                    method: "POST", 
                    body: JSON.stringify({ apiKey: "", modelName: "Address", calledMethod: "getWarehouses", methodProperties: { CityRef: this.currentCityRef, FindByString: val, Limit: "20" } }) 
                }).then(r => r.json());
                box.innerHTML = '';
                if (res.data && res.data.length > 0) {
                    box.style.display = 'block';
                    res.data.forEach(b => {
                        const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerText = b.Description;
                        div.onclick = () => { document.getElementById('newBranch').value = b.Description; box.style.display = 'none'; }; 
                        box.appendChild(div);
                    });
                } else { box.style.display = 'none'; }
            } catch(e) {}
        }, 300);
    }
}