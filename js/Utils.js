export function formatPhoneString(value) {
    if (!value) return '';
    let input = value.toString().replace(/\D/g, ''); // Оставляем только цифры
    
    if (input === '') return '';
    
    // Если пользователь начал вводить с 38, убираем, чтобы не было дублей
    if (input.startsWith('38')) input = input.substring(2);
    
    // Ограничиваем длину 10 цифрами (стандарт Украины без 38)
    input = input.substring(0, 10);
    
    // Собираем красивую строку
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
        // Если пользователь стирает и остался только префикс, очищаем поле полностью
        if (e.inputType === 'deleteContentBackward' && e.target.value.length < 5) {
            e.target.value = '';
            return;
        }
        e.target.value = formatPhoneString(e.target.value);
    });
}