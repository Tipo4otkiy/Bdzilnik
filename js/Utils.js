export function formatPhoneString(value) {
    if (!value) return '';
    let input = value.toString().replace(/\D/g, ''); 
    if (input === '') return '';
    
    // Якщо вставили міжнародний 380..., прибираємо 380 для зручності бази
    if (input.startsWith('380')) {
        input = input.substring(2);
    }

    // РОЗУМНА ЛОГІКА: Якщо номер не починається з 0, значить це шматок номера для пошуку.
    // Просто повертаємо цифри без жорсткої маски +38 (...)
    if (!input.startsWith('0') && input.length < 10) {
        return input; 
    }
    
    input = input.substring(0, 10);
    
    let formatted = '+38 ';
    if (input.length > 0) formatted += '(' + input.substring(0, 3);
    if (input.length > 3) formatted += ') ' + input.substring(3, 6);
    if (input.length > 6) formatted += '-' + input.substring(6, 8);
    if (input.length > 8) formatted += '-' + input.substring(8, 10);
    
    return formatted;
}

export function setupPhoneMask(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    
    el.addEventListener('input', (e) => {
        if (e.inputType === 'deleteContentBackward' && e.target.value.length < 5) {
            e.target.value = '';
            return;
        }
        e.target.value = formatPhoneString(e.target.value);
    });
}