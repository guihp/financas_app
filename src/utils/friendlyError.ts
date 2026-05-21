// Translate raw backend / network errors into a friendly message for the user.
// Never expose technical strings like "Edge Function returned a non-2xx status code",
// "FunctionsHttpError", "TypeError: Failed to fetch", etc.

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  { test: /cpf|cnpj/i, message: "CPF ou CNPJ inválido. Verifique os números digitados." },
  { test: /endere[çc]o/i, message: "Endereço incompleto. Preencha CEP, número e bairro." },
  { test: /cart[ãa]o.*recusad|credit.*card.*declined|invalid.*card/i, message: "Cartão recusado pela operadora. Tente outro cartão." },
  { test: /cart[ãa]o.*expirad|expired/i, message: "Cartão expirado. Tente outro cartão." },
  { test: /senha|password/i, message: "Senha inválida. Tente novamente." },
  { test: /saldo|insufficient/i, message: "Saldo insuficiente." },
  { test: /pagamento.*ainda.*n[ãa]o.*confirm|payment.*not.*confirmed/i, message: "Pagamento ainda não foi confirmado. Aguarde alguns minutos e tente novamente." },
  { test: /j[áa].*cancelad|already.*cancel/i, message: "Sua assinatura já está cancelada." },
  { test: /n[ãa]o.*autenticad|unauthor/i, message: "Sessão expirada. Faça login novamente." },
  { test: /cupom|promo|coupon/i, message: "Cupom inválido ou expirado." },
  { test: /e-?mail.*j[áa].*cadastrad|already.*registered/i, message: "Este e-mail já está cadastrado. Faça login para continuar." },
  { test: /telefone.*j[áa].*cadastrad/i, message: "Este telefone já está cadastrado. Use outro número ou recupere sua conta." },
];

// Strings that come from frameworks/HTTP layer and should NEVER reach the user.
const TECHNICAL_NOISE = [
  /non-2xx status code/i,
  /failed to fetch/i,
  /networkerror/i,
  /functionshttperror/i,
  /typeerror/i,
  /syntaxerror/i,
  /unexpected end of json/i,
  /http \d{3}/i,
  /edge function/i,
];

const isTechnical = (msg: string) => TECHNICAL_NOISE.some((re) => re.test(msg));

export function friendlyError(err: unknown, fallback = "Algo deu errado. Tente novamente em instantes."): string {
  // 1) Try to dig into Supabase FunctionsHttpError-style payloads
  let candidate = "";

  if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;

    // FunctionsHttpError exposes a `context: { body: ReadableStream }`. The
    // wrapper code (Assinatura.tsx etc.) already reads the body and rethrows
    // with the parsed error message, so look at `message` first.
    if (typeof anyErr.message === "string") candidate = anyErr.message;

    // Some helpers pass `{ error: "..." }` along
    if (!candidate || isTechnical(candidate)) {
      if (typeof anyErr.error === "string") candidate = anyErr.error;
      else if (anyErr.error && typeof (anyErr.error as { message?: string }).message === "string") {
        candidate = (anyErr.error as { message: string }).message;
      }
    }
  } else if (typeof err === "string") {
    candidate = err;
  }

  candidate = candidate.trim();

  if (!candidate || isTechnical(candidate)) return fallback;

  // 2) Match against friendly patterns
  for (const { test, message } of PATTERNS) {
    if (test.test(candidate)) return message;
  }

  // 3) If the message already looks user-friendly (no tech noise), pass through
  return candidate;
}

// Parse a Supabase Functions invoke error and try to read the real body the
// edge function returned, instead of the generic "non-2xx status code" message.
export async function readInvokeError(err: unknown): Promise<string | null> {
  if (!err || typeof err !== "object") return null;
  const ctx = (err as { context?: { body?: ReadableStream<Uint8Array> | string; json?: () => Promise<unknown>; text?: () => Promise<string> } }).context;
  if (!ctx) return null;
  try {
    if (typeof ctx.body === "string") {
      const parsed = JSON.parse(ctx.body);
      return parsed?.error || parsed?.message || null;
    }
    if (typeof ctx.json === "function") {
      const j = (await ctx.json()) as { error?: string; message?: string };
      return j?.error || j?.message || null;
    }
    if (typeof ctx.text === "function") {
      const t = await ctx.text();
      try {
        const j = JSON.parse(t);
        return j?.error || j?.message || null;
      } catch {
        return t || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}
