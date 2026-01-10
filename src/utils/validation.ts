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

/**
 * Valida formato de telefone brasileiro
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
