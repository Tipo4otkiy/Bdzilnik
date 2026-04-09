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
                <input type="text" value="${p.name}" class="p-name" style="flex:2; margin:0;">
                <input type="number" value="${p.price}" class="p-price" style="width:80px; margin:0;">
                <select class="p-currency" style="width:54px; padding:10px 4px; border:1px solid #ddd; border-radius:8px; font-size:15px; background:#fff; height:46px; margin:0;">
                    <option value="₴" ${(p.currency || '₴') === '₴' ? 'selected' : ''}>₴</option>
                    <option value="$" ${p.currency === '$' ? 'selected' : ''}>$</option>
                </select>
                <button class="btn-danger" data-action="remove-preset" style="flex:0 0 40px; height:46px; margin:0;">✕</button>
            </div>
        `).join('');

        // Вішаємо обробники на кнопки видалення
        document.querySelectorAll('[data-action="remove-preset"]').forEach(btn => {
            btn.onclick = (e) => e.target.closest('.preset-item').remove();
        });
    }

    addPresetRow() {
        const div = document.createElement('div');
        div.className = 'preset-item item-row';
        div.innerHTML = `
            <input type="text" placeholder="Назва" class="p-name" style="flex:2; margin:0;">
            <input type="number" placeholder="Ціна" class="p-price" style="width:80px; margin:0;">
            <select class="p-currency" style="width:54px; padding:10px 4px; border:1px solid #ddd; border-radius:8px; font-size:15px; background:#fff; height:46px; margin:0;">
                <option value="₴">₴</option>
                <option value="$">$</option>
            </select>
            <button class="btn-danger" style="flex:0 0 40px; height:46px; margin:0;">✕</button>`;
        div.querySelector('button').onclick = (e) => e.target.closest('.preset-item').remove();
        document.getElementById('presetsList').appendChild(div);
    }

    async save() {
        const newPresets = [];
        document.querySelectorAll('.preset-item').forEach(row => {
            const n = row.querySelector('.p-name').value.trim();
            if (n) newPresets.push({
                name: n,
                price: parseFloat(row.querySelector('.p-price').value) || 0,
                currency: row.querySelector('.p-currency').value || '₴'
            });
        });
        await setDoc(doc(this.core.db, "users", this.core.currentUser.uid), { presets: newPresets }, { merge: true });
        this.core.presets = newPresets;
        alert("Збережено!");
        document.getElementById('settingsModal').style.display = 'none';
    }
}
