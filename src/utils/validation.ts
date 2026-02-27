/**
 * Utilitários de validação e sanitização de dados
 * Previne ataques XSS, SQL Injection, e validações de entrada
 */

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  // Limitar tamanho do email
  if (email.length > 254) return false;
  
  // Regex mais rigoroso para validação de email
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email.trim());
}

export type PhoneCountry = 'BR' | 'US' | 'PT' | 'IE' | 'ES';

/** Nome do país para envio ao webhook OTP */
export const PHONE_COUNTRY_NAMES: Record<PhoneCountry, string> = {
  BR: 'Brasil',
  US: 'EUA',
  PT: 'Portugal',
  IE: 'Irlanda',
  ES: 'Espanha',
};

/**
 * Valida formato de telefone brasileiro
 * (Lógica original - não alterar)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Telefone brasileiro: 11 dígitos (DDD + 9 + 8 números) ou 10 dígitos (DDD + 8 números)
  if (cleanPhone.length !== 11 && cleanPhone.length !== 10) return false;
  
  // DDD deve ser entre 11 e 99
  const ddd = parseInt(cleanPhone.substring(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  
  return true;
}

/**
 * Valida formato de telefone dos EUA
 * Formato: (XXX) XXX-XXXX - 10 dígitos, área code não pode começar com 0 ou 1
 */
export function isValidPhoneUS(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  const clean = phone.replace(/\D/g, '');
  if (clean.length !== 10) return false;
  
  // Área code (3 primeiros dígitos) não pode começar com 0 ou 1
  const areaCode = parseInt(clean.substring(0, 1));
  if (areaCode < 2) return false;
  
  return true;
}

/** Portugal +351: 9 dígitos | Irlanda +353: 9 dígitos | Espanha +34: 9 dígitos */
function isValidPhoneEuropean(phone: string, digits: number = 9): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/\D/g, '');
  return clean.length === digits;
}

/**
 * Valida telefone de acordo com o país selecionado
 */
export function isValidPhoneForCountry(phone: string, country: PhoneCountry): boolean {
  if (country === 'BR') return isValidPhone(phone);
  if (country === 'US') return isValidPhoneUS(phone);
  if (country === 'PT' || country === 'IE' || country === 'ES') return isValidPhoneEuropean(phone, 9);
  return false;
}

/**
 * Formata telefone para exibição conforme o país
 * BR: (11) 9 9999-9999
 * US: (555) 123-4567
 */
export function formatPhoneForCountry(value: string, country: PhoneCountry): string {
  const digits = value.replace(/\D/g, '');
  
  if (country === 'BR') {
    let numbers = digits.slice(0, 11);
    if (numbers.length > 2) {
      const ddd = numbers.slice(0, 2);
      let rest = numbers.slice(2);
      if (rest.length > 0 && rest[0] !== '9') rest = '9' + rest;
      rest = rest.slice(0, 9);
      numbers = ddd + rest;
    }
    if (numbers.length <= 2) return numbers.length > 0 ? `(${numbers}` : '';
    if (numbers.length <= 3) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 3)} ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 3)} ${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
  
  if (country === 'US') {
    const limited = digits.slice(0, 10);
    if (limited.length <= 3) return limited.length > 0 ? `(${limited}` : '';
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6, 10)}`;
  }

  // PT, IE, ES: XXX XXX XXX (9 dígitos)
  if (country === 'PT' || country === 'IE' || country === 'ES') {
    const limited = digits.slice(0, 9);
    if (limited.length <= 3) return limited;
    if (limited.length <= 6) return `${limited.slice(0, 3)} ${limited.slice(3)}`;
    return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6, 9)}`;
  }
  
  return value;
}

/**
 * Retorna o telefone no formato esperado pelo backend (apenas dígitos)
 * BR: 11 dígitos (DDD + número)
 * US: 1 + 10 dígitos (código país + número)
 */
const COUNTRY_CODE: Record<Exclude<PhoneCountry, 'BR'>, string> = {
  US: '1',
  PT: '351',
  IE: '353',
  ES: '34',
};

export function getCleanPhoneForBackend(phone: string, country: PhoneCountry): string {
  const digits = phone.replace(/\D/g, '');
  if (country === 'BR') return digits; // mantém lógica original
  const code = COUNTRY_CODE[country];
  return digits.length > 0 && !digits.startsWith(code) ? code + digits : digits;
}

/**
 * Valida força da senha
 */
export function isStrongPassword(password: string): { valid: boolean; message: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Senha é obrigatória' };
  }
  
  // Limitar tamanho da senha (prevenir DoS)
  if (password.length > 128) {
    return { valid: false, message: 'Senha muito longa (máximo 128 caracteres)' };
  }
  
  // Mínimo de 8 caracteres
  if (password.length < 8) {
    return { valid: false, message: 'Senha deve ter pelo menos 8 caracteres' };
  }
  
  // Verificar complexidade
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const complexityScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
  
  if (complexityScore < 3) {
    return { 
      valid: false, 
      message: 'Senha deve conter pelo menos 3 dos seguintes: letras maiúsculas, minúsculas, números e caracteres especiais' 
    };
  }
  
  // Verificar senhas comuns (lista básica)
  const commonPasswords = ['12345678', 'password', 'senha123', '123456789', 'qwerty123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, message: 'Esta senha é muito comum. Escolha uma senha mais segura' };
  }
  
  return { valid: true, message: '' };
}

/**
 * Sanitiza texto removendo HTML/scripts (previne XSS)
 */
export function sanitizeText(text: string, maxLength: number = 1000): string {
  if (!text || typeof text !== 'string') return '';
  
  // Limitar tamanho (prevenir DoS)
  let sanitized = text.substring(0, maxLength);
  
  // Remover tags HTML
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remover scripts e eventos
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Remover caracteres de controle
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  return sanitized.trim();
}

/**
 * Sanitiza nome de categoria (sem HTML, limitado)
 */
export function sanitizeCategoryName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  let sanitized = name.substring(0, 50); // Limitar a 50 caracteres
  sanitized = sanitized.replace(/[<>'"&]/g, ''); // Remover caracteres perigosos
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Valida e sanitiza descrição
 */
export function sanitizeDescription(description: string, maxLength: number = 500): string {
  return sanitizeText(description, maxLength);
}

/**
 * Valida valor monetário
 */
export function isValidAmount(amount: number | string): { valid: boolean; value: number | null; message: string } {
  if (amount === null || amount === undefined || amount === '') {
    return { valid: false, value: null, message: 'Valor é obrigatório' };
  }
  
  let numericAmount: number;
  
  if (typeof amount === 'string') {
    // Converter formato brasileiro (1.234,56) para número
    const cleanAmount = amount.replace(/\./g, '').replace(',', '.');
    numericAmount = parseFloat(cleanAmount);
  } else {
    numericAmount = amount;
  }
  
  if (isNaN(numericAmount)) {
    return { valid: false, value: null, message: 'Valor inválido' };
  }
  
  // Limitar valor máximo (prevenir overflow)
  const MAX_AMOUNT = 999999999.99;
  if (numericAmount > MAX_AMOUNT) {
    return { valid: false, value: null, message: `Valor muito alto (máximo R$ ${MAX_AMOUNT.toLocaleString('pt-BR')})` };
  }
  
  if (numericAmount <= 0) {
    return { valid: false, value: null, message: 'Valor deve ser maior que zero' };
  }
  
  // Arredondar para 2 casas decimais
  numericAmount = Math.round(numericAmount * 100) / 100;
  
  return { valid: true, value: numericAmount, message: '' };
}

/**
 * Valida data (não pode ser muito no futuro)
 */
export function isValidDate(date: string | Date, maxYearsFuture: number = 2): { valid: boolean; message: string } {
  if (!date) {
    return { valid: false, message: 'Data é obrigatória' };
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return { valid: false, message: 'Data inválida' };
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxDate = new Date();
  maxDate.setFullYear(today.getFullYear() + maxYearsFuture);
  
  if (dateObj < today) {
    return { valid: false, message: 'Data não pode ser anterior ao dia atual' };
  }
  
  if (dateObj > maxDate) {
    return { valid: false, message: `Data não pode ser superior a ${maxYearsFuture} anos no futuro` };
  }
  
  return { valid: true, message: '' };
}

/**
 * Valida nome completo
 */
export function isValidFullName(name: string): { valid: boolean; message: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: 'Nome é obrigatório' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 3) {
    return { valid: false, message: 'Nome deve ter pelo menos 3 caracteres' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, message: 'Nome muito longo (máximo 100 caracteres)' };
  }
  
  // Deve ter pelo menos 2 palavras (nome e sobrenome)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) {
    return { valid: false, message: 'Informe nome e sobrenome' };
  }
  
  // Não permitir caracteres especiais perigosos
  if (/[<>'"&{}[\]\\]/.test(trimmed)) {
    return { valid: false, message: 'Nome contém caracteres inválidos' };
  }
  
  return { valid: true, message: '' };
}
