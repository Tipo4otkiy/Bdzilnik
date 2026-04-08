import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class SettingsManager {
    constructor(core) {
        this.core = core;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('openSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').style.display = 'flex');
        document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').style.display = 'none');
        document.getElementById('addPresetBtn').addEventListener('click', () => this.addPresetRow());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.save());
    }

    async load() {
        const d = await getDoc(doc(this.core.db, "users", this.core.currentUser.uid));
        if (d.exists()) {
            this.core.presets = d.data().presets || [];
            this.render();
        }
    }

    render() {
        document.getElementById('presetsList').innerHTML = this.core.presets.map((p) => `
            <div class="preset-item item-row">
                <input type="text" value="${p.name}" class="p-name">
                <input type="number" value="${p.price}" class="p-price" style="width:100px">
                <button class="btn-danger" data-action="remove-preset">✕</button>
            </div>
        `).join('');
    }

    addPresetRow() {
        const div = document.createElement('div');
        div.className = 'preset-item item-row';
        div.innerHTML = `<input type="text" placeholder="Назва" class="p-name"> <input type="number" placeholder="Ціна" class="p-price" style="width:100px"> <button class="btn-danger" data-action="remove-preset">✕</button>`;
        div.querySelector('button').onclick = (e) => e.target.parentElement.remove();
        document.getElementById('presetsList').appendChild(div);
    }

    async save() {
        const newPresets = [];
        document.querySelectorAll('.preset-item').forEach(row => {
            const n = row.querySelector('.p-name').value.trim();
            if(n) newPresets.push({ name: n, price: parseFloat(row.querySelector('.p-price').value) || 0 });
        });
        await setDoc(doc(this.core.db, "users", this.core.currentUser.uid), { presets: newPresets }, { merge: true });
        this.core.presets = newPresets;
        alert("Збережено!");
        document.getElementById('settingsModal').style.display = 'none';
    }
}