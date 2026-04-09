// Нормалізує телефон до простого вигляду: 0677086322
// Якщо вставили 380... або +380... — прибираємо 380, залишаємо 0XXXXXXXXX
export function formatPhoneString(value) {
    if (!value) return '';
    let digits = value.toString().replace(/\D/g, '');
    if (digits === '') return '';

    // Прибираємо код країни 380
    if (digits.startsWith('380')) digits = digits.substring(3);

    // Обрізаємо до 10 цифр
    return digits.substring(0, 10);
}

export function setupPhoneMask(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;

    el.addEventListener('input', (e) => {
        const pos = e.target.selectionStart;
        e.target.value = formatPhoneString(e.target.value);
        try { e.target.setSelectionRange(pos, pos); } catch(_) {}
    });
}