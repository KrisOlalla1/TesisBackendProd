export const validarCedulaEcuatoriana = (cedula) => {
    // Verificar longitud y que sean solo números
    if (!cedula || cedula.length !== 10 || !/^\d+$/.test(cedula)) return false;

    const digits = cedula.split('').map(Number);
    const provinceCode = digits[0] * 10 + digits[1];
    const thirdDigit = digits[2];

    // Verificar código de provincia (01-24)
    if (provinceCode < 1 || provinceCode > 24) return false;

    // Verificar tercer dígito (0-5 para personas naturales)
    // Nota: RUCs de sociedades públicas/privadas tienen reglas diferentes, 
    // pero para cédula de identidad de persona natural es < 6.
    if (thirdDigit >= 6) return false;

    const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let total = 0;

    for (let i = 0; i < 9; i++) {
        let value = digits[i] * coefficients[i];
        if (value >= 10) value -= 9;
        total += value;
    }

    const verifier = total % 10 === 0 ? 0 : 10 - (total % 10);
    return verifier === digits[9];
};
