import { useState, useRef, useEffect } from "react";
import { Input } from "./input";
import { Label } from "./label";
import { CreditCard, Lock, Calendar, User, MapPin, Phone, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditCardInputProps {
  onCardChange: (cardData: CreditCardData) => void;
  onHolderInfoChange: (holderInfo: CardHolderInfo) => void;
  disabled?: boolean;
}

export interface CreditCardData {
  number: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CardHolderInfo {
  name: string;
  cpfCnpj: string;
  postalCode: string;
  phone: string;
  addressNumber: string;
}

// Detect card brand based on number
const getCardBrand = (number: string): string => {
  const cleanNumber = number.replace(/\s/g, '');
  
  if (/^4/.test(cleanNumber)) return 'visa';
  if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return 'mastercard';
  if (/^3[47]/.test(cleanNumber)) return 'amex';
  if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
  if (/^(?:2131|1800|35)/.test(cleanNumber)) return 'jcb';
  if (/^3(?:0[0-5]|[68])/.test(cleanNumber)) return 'diners';
  if (/^(606282|3841)/.test(cleanNumber)) return 'hipercard';
  if (/^(50|636|637|638|639)/.test(cleanNumber)) return 'elo';
  
  return 'unknown';
};

// Format card number with spaces
const formatCardNumber = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  const groups = cleanValue.match(/.{1,4}/g);
  return groups ? groups.join(' ').slice(0, 19) : '';
};

// Format CPF/CNPJ
const formatCpfCnpj = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length <= 11) {
    // CPF: 000.000.000-00
    return cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0000-00
    return cleanValue
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
};

// Format CEP
const formatCep = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '').slice(0, 8);
  return cleanValue.replace(/(\d{5})(\d)/, '$1-$2');
};

// Card brand colors
const brandColors: Record<string, string> = {
  visa: 'from-blue-600 to-blue-800',
  mastercard: 'from-red-500 to-orange-500',
  amex: 'from-blue-400 to-blue-600',
  discover: 'from-orange-400 to-orange-600',
  jcb: 'from-green-500 to-blue-500',
  diners: 'from-blue-700 to-blue-900',
  hipercard: 'from-red-600 to-red-800',
  elo: 'from-yellow-500 to-yellow-700',
  unknown: 'from-gray-600 to-gray-800',
};

export const CreditCardInput = ({ 
  onCardChange, 
  onHolderInfoChange,
  disabled = false 
}: CreditCardInputProps) => {
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Holder info
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  const cardBrand = getCardBrand(cardNumber);

  // Update parent component when card data changes
  useEffect(() => {
    onCardChange({
      number: cardNumber.replace(/\s/g, ''),
      holderName,
      expiryMonth,
      expiryYear: expiryYear.length === 2 ? `20${expiryYear}` : expiryYear,
      ccv,
    });
  }, [cardNumber, holderName, expiryMonth, expiryYear, ccv]);

  // Update parent component when holder info changes
  useEffect(() => {
    onHolderInfoChange({
      name: holderName,
      cpfCnpj: cpfCnpj.replace(/\D/g, ''),
      postalCode: postalCode.replace(/\D/g, ''),
      phone: phone.replace(/\D/g, ''),
      addressNumber,
    });
  }, [holderName, cpfCnpj, postalCode, phone, addressNumber]);

  // Format phone number
  const formatPhone = (value: string): string => {
    let numbers = value.replace(/\D/g, '');
    if (numbers.length > 2 && numbers[2] !== '9') {
      numbers = numbers.slice(0, 2) + '9' + numbers.slice(2);
    }
    numbers = numbers.slice(0, 11);
    
    if (numbers.length <= 2) return numbers.length > 0 ? `(${numbers}` : '';
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  return (
    <div className="space-y-4">
      {/* Card Preview */}
      <div 
        className="perspective-1000 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
        onMouseEnter={() => ccv.length > 0 && setIsFlipped(true)}
        onMouseLeave={() => setIsFlipped(false)}
      >
        <div 
          className={cn(
            "relative w-full h-48 transition-transform duration-500 transform-style-preserve-3d",
            isFlipped && "rotate-y-180"
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Card Front */}
          <div 
            className={cn(
              "absolute inset-0 rounded-xl p-5 text-white shadow-lg backface-hidden",
              "bg-gradient-to-br",
              brandColors[cardBrand]
            )}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex justify-between items-start mb-8">
              <div className="w-12 h-8 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md" />
              <span className="text-lg font-bold uppercase tracking-wider">
                {cardBrand !== 'unknown' ? cardBrand : 'Cartão'}
              </span>
            </div>
            
            <div className="mb-6">
              <p className="text-xl tracking-widest font-mono">
                {cardNumber || '•••• •••• •••• ••••'}
              </p>
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs opacity-70 uppercase">Titular</p>
                <p className="font-medium tracking-wider truncate max-w-[180px]">
                  {holderName || 'SEU NOME'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-70 uppercase">Validade</p>
                <p className="font-mono">
                  {expiryMonth || 'MM'}/{expiryYear || 'AA'}
                </p>
              </div>
            </div>
          </div>

          {/* Card Back */}
          <div 
            className={cn(
              "absolute inset-0 rounded-xl text-white shadow-lg",
              "bg-gradient-to-br",
              brandColors[cardBrand]
            )}
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="h-12 bg-black/40 mt-6" />
            <div className="p-5">
              <div className="flex justify-end items-center mb-4">
                <div className="bg-gray-200 h-8 w-3/4 flex items-center justify-end px-3 rounded">
                  <span className="text-gray-800 font-mono text-sm">
                    {ccv || '•••'}
                  </span>
                </div>
              </div>
              <p className="text-xs opacity-70 text-center">
                O CVV é o código de 3 dígitos no verso do cartão
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Card Number */}
      <div className="space-y-2">
        <Label htmlFor="card-number">Número do Cartão</Label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="card-number"
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            className="pl-10 font-mono"
            maxLength={19}
            disabled={disabled}
            autoComplete="cc-number"
          />
        </div>
      </div>

      {/* Holder Name */}
      <div className="space-y-2">
        <Label htmlFor="card-holder">Nome no Cartão</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="card-holder"
            type="text"
            placeholder="NOME COMO ESTÁ NO CARTÃO"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value.toUpperCase())}
            className="pl-10 uppercase"
            disabled={disabled}
            autoComplete="cc-name"
          />
        </div>
      </div>

      {/* Expiry and CVV */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="expiry-month">Mês</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="expiry-month"
              type="text"
              inputMode="numeric"
              placeholder="MM"
              value={expiryMonth}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) {
                  setExpiryMonth(val);
                }
              }}
              className="pl-10 font-mono"
              maxLength={2}
              disabled={disabled}
              autoComplete="cc-exp-month"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="expiry-year">Ano</Label>
          <Input
            id="expiry-year"
            type="text"
            inputMode="numeric"
            placeholder="AA"
            value={expiryYear}
            onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="font-mono"
            maxLength={2}
            disabled={disabled}
            autoComplete="cc-exp-year"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="ccv">CVV</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="ccv"
              type="text"
              inputMode="numeric"
              placeholder="•••"
              value={ccv}
              onChange={(e) => setCcv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="pl-10 font-mono"
              maxLength={4}
              disabled={disabled}
              onFocus={() => setIsFlipped(true)}
              onBlur={() => setIsFlipped(false)}
              autoComplete="cc-csc"
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Dados do Titular
          </span>
        </div>
      </div>

      {/* CPF/CNPJ */}
      <div className="space-y-2">
        <Label htmlFor="cpf-cnpj">CPF/CNPJ</Label>
        <div className="relative">
          <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="cpf-cnpj"
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
            className="pl-10 font-mono"
            maxLength={18}
            disabled={disabled}
          />
        </div>
      </div>

      {/* CEP and Address Number */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="postal-code">CEP</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="postal-code"
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              value={postalCode}
              onChange={(e) => setPostalCode(formatCep(e.target.value))}
              className="pl-10 font-mono"
              maxLength={9}
              disabled={disabled}
              autoComplete="postal-code"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="address-number">Número</Label>
          <Input
            id="address-number"
            type="text"
            inputMode="numeric"
            placeholder="123"
            value={addressNumber}
            onChange={(e) => setAddressNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="font-mono"
            maxLength={6}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="card-phone">Telefone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="card-phone"
            type="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            className="pl-10"
            maxLength={16}
            disabled={disabled}
            autoComplete="tel"
          />
        </div>
      </div>
    </div>
  );
};

export default CreditCardInput;
