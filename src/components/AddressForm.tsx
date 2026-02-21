import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

export interface PaymentAddress {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const formatCep = (value: string): string => {
  const clean = value.replace(/\D/g, '').slice(0, 8);
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
};

interface AddressFormProps {
  value: PaymentAddress | null;
  onChange: (address: PaymentAddress | null) => void;
  disabled?: boolean;
}

export function AddressForm({ value, onChange, disabled = false }: AddressFormProps) {
  const [cep, setCep] = useState(value?.postalCode ?? "");
  const [street, setStreet] = useState(value?.street ?? "");
  const [number, setNumber] = useState(value?.number ?? "");
  const [complement, setComplement] = useState(value?.complement ?? "");
  const [neighborhood, setNeighborhood] = useState(value?.neighborhood ?? "");
  const [city, setCity] = useState(value?.city ?? "");
  const [state, setState] = useState(value?.state ?? "");
  const [loadingCep, setLoadingCep] = useState(false);

  // Sync from value when parent provides saved address (e.g. after refetch)
  useEffect(() => {
    if (!value) return;
    const raw = String(value.postalCode ?? "").replace(/\D/g, "");
    setCep(raw.length >= 8 ? formatCep(raw) : value.postalCode ?? "");
    setStreet(value.street ?? "");
    setNumber(value.number ?? "");
    setComplement(value.complement ?? "");
    setNeighborhood(value.neighborhood ?? "");
    setCity(value.city ?? "");
    setState(value.state ?? "");
  }, [value?.postalCode, value?.street, value?.number, value?.neighborhood, value?.city, value?.state]);

  useEffect(() => {
    const postalCode = cep.replace(/\D/g, "");
    if (postalCode.length !== 8 || !street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
      onChange(null);
      return;
    }
    onChange({
      postalCode,
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase().slice(0, 2),
    });
  }, [cep, street, number, complement, neighborhood, city, state, onChange]);

  const handleCepBlur = useCallback(async () => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro ?? "");
        setNeighborhood(data.bairro ?? "");
        setCity(data.localidade ?? "");
        setState(data.uf ?? "");
      }
    } catch {
      // ignore
    } finally {
      setLoadingCep(false);
    }
  }, [cep]);

  const update = useCallback((setter: (s: string) => void, v: string) => {
    setter(v);
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="addr-cep">CEP</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="addr-cep"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => update(setCep, formatCep(e.target.value))}
              onBlur={handleCepBlur}
              className="pl-10 font-mono"
              maxLength={9}
              disabled={disabled}
              autoComplete="postal-code"
            />
            {loadingCep && (
              <span className="absolute right-3 top-3 text-xs text-muted-foreground">Buscando...</span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr-number">Número</Label>
          <Input
            id="addr-number"
            placeholder="123"
            value={number}
            onChange={(e) => update(setNumber, e.target.value)}
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="addr-street">Logradouro</Label>
        <Input
          id="addr-street"
          placeholder="Rua, avenida..."
          value={street}
          onChange={(e) => update(setStreet, e.target.value)}
          disabled={disabled}
          autoComplete="address-line1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="addr-complement">Complemento</Label>
          <Input
            id="addr-complement"
            placeholder="Apto, bloco..."
            value={complement}
            onChange={(e) => update(setComplement, e.target.value)}
            disabled={disabled}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr-neighborhood">Bairro</Label>
          <Input
            id="addr-neighborhood"
            placeholder="Bairro"
            value={neighborhood}
            onChange={(e) => update(setNeighborhood, e.target.value)}
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="addr-city">Cidade</Label>
          <Input
            id="addr-city"
            placeholder="Cidade"
            value={city}
            onChange={(e) => update(setCity, e.target.value)}
            disabled={disabled}
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr-state">UF</Label>
          <Input
            id="addr-state"
            placeholder="UF"
            value={state}
            onChange={(e) => update(setState, e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            disabled={disabled}
            autoComplete="address-level1"
          />
        </div>
      </div>
    </div>
  );
}

export function isPaymentAddressValid(addr: PaymentAddress | null): boolean {
  if (!addr) return false;
  const cep = String(addr.postalCode).replace(/\D/g, "");
  return cep.length === 8 &&
    !!addr.street?.trim() &&
    !!addr.number?.trim() &&
    !!addr.neighborhood?.trim() &&
    !!addr.city?.trim() &&
    !!addr.state?.trim();
}
