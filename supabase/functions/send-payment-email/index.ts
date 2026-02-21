import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = 'IAFÉ Finanças <financeiro@iafeoficial.com>';

// Base email template wrapper
const getEmailWrapper = (content: string, preheader: string = '') => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>IAFÉ Finanças</title>
  ${preheader ? `<meta name="description" content="${preheader}">` : ''}
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f8fafc;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
    }
    
    .btn {
      display: inline-block;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      color: white !important;
    }
    
    .btn-success {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white !important;
    }
    
    .btn-warning {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white !important;
    }
    
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }
      .mobile-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc;">
  <!-- Preheader text (hidden) -->
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheader}</div>` : ''}
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 40px 32px; text-align: center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <!-- Logo Icon -->
                    <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px;">💰</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">IAFÉ Finanças</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px; font-weight: 400;">Gestão financeira inteligente com IA</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          ${content}
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 16px;">
                    <p style="margin: 0; color: #64748b; font-size: 14px; font-weight: 500;">
                      Dúvidas? Estamos aqui para ajudar!
                    </p>
                    <p style="margin: 8px 0 0 0;">
                      <a href="mailto:financeiro@iafeoficial.com" style="color: #0ea5e9; text-decoration: none; font-size: 14px;">financeiro@iafeoficial.com</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                      © 2026 IAFÉ Finanças. Todos os direitos reservados.
                    </p>
                    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 11px;">
                      Este e-mail foi enviado por IAFÉ Oficial.<br>
                      Se você não reconhece este e-mail, por favor ignore.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Email template for payment
const getPaymentEmailContent = (data: {
  userName: string;
  planName: string;
  planPrice: string;
  paymentMethod: string;
  pixCode?: string;
  pixQrCodeUrl?: string;
  boletoUrl?: string;
  invoiceUrl?: string;
  expiresAt: string;
}) => {
  const { userName, planName, planPrice, paymentMethod, pixCode, pixQrCodeUrl, boletoUrl, invoiceUrl, expiresAt } = data;

  const firstName = userName.split(' ')[0];

  const paymentSection = paymentMethod === 'PIX' ? `
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 16px; padding: 28px; text-align: center;">
          <div style="width: 48px; height: 48px; background: #22c55e; border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 24px;">📱</span>
          </div>
          <h3 style="color: #16a34a; margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">Pague com PIX</h3>
          <p style="color: #15803d; margin: 0 0 20px 0; font-size: 14px;">Pagamento instantâneo e seguro</p>
          ${pixQrCodeUrl ? `
            <div style="background: white; padding: 16px; border-radius: 12px; display: inline-block; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <img src="${pixQrCodeUrl}" alt="QR Code PIX" style="width: 180px; height: 180px; display: block;" />
            </div>
          ` : ''}
          ${pixCode ? `
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #166534; font-weight: 500;">Ou copie o código abaixo:</p>
            <div style="background: white; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; word-break: break-all; font-family: 'Courier New', monospace; font-size: 11px; color: #166534; max-height: 80px; overflow-y: auto;">
              ${pixCode}
            </div>
          ` : ''}
        </div>
      </td>
    </tr>
  ` : paymentMethod === 'BOLETO' ? `
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 28px; text-align: center;">
          <div style="width: 48px; height: 48px; background: #f59e0b; border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 24px;">📄</span>
          </div>
          <h3 style="color: #b45309; margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">Boleto Bancário</h3>
          <p style="color: #a16207; margin: 0 0 24px 0; font-size: 14px;">Pague em qualquer banco ou lotérica</p>
          <a href="${boletoUrl || invoiceUrl}" class="btn btn-warning" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            📥 Baixar Boleto
          </a>
        </div>
      </td>
    </tr>
  ` : '';

  return getEmailWrapper(`
    <tr>
      <td style="padding: 40px 32px 24px;" class="mobile-padding">
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">
          Olá, ${firstName}! 👋
        </h2>
        <p style="color: #64748b; line-height: 1.7; margin: 0; font-size: 15px;">
          Estamos muito felizes em ter você conosco! Para ativar sua conta no <strong style="color: #0ea5e9;">IAFÉ Finanças</strong>, 
          complete o pagamento abaixo.
        </p>
      </td>
    </tr>
    
    <!-- Plan Info Card -->
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: middle;">
                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Plano Selecionado</p>
                <p style="margin: 6px 0 0 0; color: #1e293b; font-size: 20px; font-weight: 700;">${planName}</p>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <p style="margin: 0; color: #0ea5e9; font-size: 32px; font-weight: 700;">R$ ${planPrice}</p>
                <p style="margin: 0; color: #64748b; font-size: 13px;">/mês</p>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
    
    ${paymentSection}
    
    <!-- Invoice Link -->
    ${invoiceUrl ? `
      <tr>
        <td style="padding: 0 32px 24px; text-align: center;" class="mobile-padding">
          <a href="${invoiceUrl}" style="color: #0ea5e9; text-decoration: none; font-size: 14px; font-weight: 500;">
            🔗 Ver fatura completa
          </a>
        </td>
      </tr>
    ` : ''}
    
    <!-- Expiration Warning -->
    <tr>
      <td style="padding: 0 32px 32px;" class="mobile-padding">
        <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fecaca; border-radius: 12px; padding: 16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 32px; vertical-align: middle;">
                <span style="font-size: 20px;">⏰</span>
              </td>
              <td style="vertical-align: middle;">
                <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 500;">
                  <strong>Atenção:</strong> Este pagamento expira em <strong>${expiresAt}</strong>
                </p>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  `, `Complete seu pagamento de R$ ${planPrice} para ativar sua conta no IAFÉ Finanças`);
};

// Email template for welcome with trial
const getWelcomeTrialEmailContent = (data: {
  userName: string;
  planName: string;
  trialDays: number;
  trialEndsAt: string;
}) => {
  const { userName, planName, trialDays, trialEndsAt } = data;
  const firstName = userName.split(' ')[0];

  return getEmailWrapper(`
    <tr>
      <td style="padding: 40px 32px 24px;" class="mobile-padding">
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">
          Bem-vindo ao IAFÉ, ${firstName}! 🎉
        </h2>
        <p style="color: #64748b; line-height: 1.7; margin: 0; font-size: 15px;">
          Sua conta foi criada com sucesso! Você tem <strong style="color: #22c55e;">${trialDays} dias grátis</strong> para explorar 
          todas as funcionalidades do <strong style="color: #0ea5e9;">IAFÉ Finanças</strong>.
        </p>
      </td>
    </tr>
    
    <!-- Trial Badge -->
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 16px; padding: 28px; text-align: center;">
          <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 32px;">🎁</span>
          </div>
          <h3 style="color: #16a34a; margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">Período de Teste Gratuito</h3>
          <p style="color: #15803d; margin: 0 0 4px 0; font-size: 48px; font-weight: 700;">${trialDays}</p>
          <p style="color: #166534; margin: 0; font-size: 16px; font-weight: 600;">dias grátis</p>
        </div>
      </td>
    </tr>
    
    <!-- Plan Info -->
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin: 0; color: #64748b; font-size: 13px;">Plano selecionado</p>
                <p style="margin: 4px 0 0 0; color: #1e293b; font-size: 18px; font-weight: 600;">${planName}</p>
              </td>
              <td style="text-align: right;">
                <p style="margin: 0; color: #64748b; font-size: 13px;">Seu trial expira em</p>
                <p style="margin: 4px 0 0 0; color: #f59e0b; font-size: 16px; font-weight: 600;">${trialEndsAt}</p>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
    
    <!-- Features -->
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">O que você pode fazer:</h3>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28px; vertical-align: top;"><span style="color: #22c55e; font-size: 16px;">✓</span></td>
                  <td style="color: #475569; font-size: 14px;">Registrar transações por <strong>WhatsApp</strong> ou pelo app</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28px; vertical-align: top;"><span style="color: #22c55e; font-size: 16px;">✓</span></td>
                  <td style="color: #475569; font-size: 14px;">Ver <strong>relatórios</strong> e gráficos das suas finanças</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28px; vertical-align: top;"><span style="color: #22c55e; font-size: 16px;">✓</span></td>
                  <td style="color: #475569; font-size: 14px;">Gerenciar <strong>categorias</strong> personalizadas</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28px; vertical-align: top;"><span style="color: #22c55e; font-size: 16px;">✓</span></td>
                  <td style="color: #475569; font-size: 14px;">Agendar <strong>compromissos</strong> financeiros</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28px; vertical-align: top;"><span style="color: #22c55e; font-size: 16px;">✓</span></td>
                  <td style="color: #475569; font-size: 14px;">Receber <strong>insights de IA</strong> sobre seus gastos</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- CTA Button -->
    <tr>
      <td style="padding: 0 32px 32px; text-align: center;" class="mobile-padding">
        <a href="https://app.iafeoficial.com/dash" class="btn btn-primary" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
          🚀 Acessar Minha Conta
        </a>
      </td>
    </tr>
  `, `Bem-vindo ao IAFÉ Finanças! Você tem ${trialDays} dias grátis para experimentar.`);
};

// Email template for trial expiring soon
const getTrialExpiringEmailContent = (data: {
  userName: string;
  planName: string;
  planPrice: string;
  daysRemaining: number;
  trialEndsAt: string;
}) => {
  const { userName, planName, planPrice, daysRemaining, trialEndsAt } = data;
  const firstName = userName.split(' ')[0];

  return getEmailWrapper(`
    <tr>
      <td style="padding: 40px 32px 24px;" class="mobile-padding">
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">
          ${firstName}, seu trial está acabando! ⏰
        </h2>
        <p style="color: #64748b; line-height: 1.7; margin: 0; font-size: 15px;">
          Faltam apenas <strong style="color: #f59e0b;">${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}</strong> para o fim do seu período gratuito.
          Continue aproveitando o <strong style="color: #0ea5e9;">IAFÉ Finanças</strong>!
        </p>
      </td>
    </tr>
    
    <!-- Warning Badge -->
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 28px; text-align: center;">
          <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 32px;">⚠️</span>
          </div>
          <h3 style="color: #b45309; margin: 0 0 8px 0; font-size: 20px; font-weight: 700;">Seu trial expira em</h3>
          <p style="color: #a16207; margin: 0 0 4px 0; font-size: 48px; font-weight: 700;">${daysRemaining}</p>
          <p style="color: #92400e; margin: 0; font-size: 16px; font-weight: 600;">${daysRemaining === 1 ? 'dia' : 'dias'}</p>
          <p style="color: #a16207; margin: 16px 0 0 0; font-size: 14px;">Expira em: ${trialEndsAt}</p>
        </div>
      </td>
    </tr>
    
    <!-- Plan to Subscribe -->
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
          <h4 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Continue com o plano:</h4>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin: 0; color: #1e293b; font-size: 20px; font-weight: 700;">${planName}</p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Acesso completo a todas as funcionalidades</p>
              </td>
              <td style="text-align: right;">
                <p style="margin: 0; color: #0ea5e9; font-size: 28px; font-weight: 700;">R$ ${planPrice}</p>
                <p style="margin: 0; color: #64748b; font-size: 13px;">/mês</p>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
    
    <!-- CTA Button -->
    <tr>
      <td style="padding: 0 32px 32px; text-align: center;" class="mobile-padding">
        <a href="https://app.iafeoficial.com/pagamento-pendente" class="btn btn-success" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
          💳 Assinar Agora
        </a>
        <p style="margin: 16px 0 0 0; color: #64748b; font-size: 13px;">
          Evite perder acesso às suas finanças
        </p>
      </td>
    </tr>
  `, `Seu período gratuito no IAFÉ Finanças expira em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}.`);
};

// Plain text versions
const getPaymentEmailText = (data: {
  userName: string;
  planName: string;
  planPrice: string;
  paymentMethod: string;
  pixCode?: string;
  boletoUrl?: string;
  invoiceUrl?: string;
  expiresAt: string;
}) => {
  const { userName, planName, planPrice, paymentMethod, pixCode, boletoUrl, invoiceUrl, expiresAt } = data;
  const firstName = userName.split(' ')[0];

  let paymentInfo = '';
  if (paymentMethod === 'PIX' && pixCode) {
    paymentInfo = `
═══════════════════════════════
         PAGUE COM PIX
═══════════════════════════════

Copie o código abaixo e cole no app do seu banco:

${pixCode}

`;
  } else if (paymentMethod === 'BOLETO') {
    paymentInfo = `
═══════════════════════════════
       BOLETO BANCÁRIO
═══════════════════════════════

Acesse o link para baixar seu boleto:
${boletoUrl || invoiceUrl}

`;
  }

  return `
═══════════════════════════════════════
      IAFÉ FINANÇAS
   Gestão financeira inteligente
═══════════════════════════════════════

Olá, ${firstName}! 👋

Estamos muito felizes em ter você conosco!
Para ativar sua conta, complete o pagamento abaixo.

───────────────────────────────
PLANO SELECIONADO
───────────────────────────────
${planName}
Valor: R$ ${planPrice}/mês

${paymentInfo}

${invoiceUrl ? `🔗 Ver fatura completa: ${invoiceUrl}` : ''}

⏰ ATENÇÃO: Este pagamento expira em ${expiresAt}

───────────────────────────────
Dúvidas? Entre em contato:
financeiro@iafeoficial.com
───────────────────────────────

© 2026 IAFÉ Finanças
  `.trim();
};

const getWelcomeTrialEmailText = (data: {
  userName: string;
  planName: string;
  trialDays: number;
  trialEndsAt: string;
}) => {
  const { userName, planName, trialDays, trialEndsAt } = data;
  const firstName = userName.split(' ')[0];

  return `
═══════════════════════════════════════
      IAFÉ FINANÇAS
   Gestão financeira inteligente
═══════════════════════════════════════

🎉 Bem-vindo ao IAFÉ, ${firstName}!

Sua conta foi criada com sucesso!
Você tem ${trialDays} DIAS GRÁTIS para explorar todas as funcionalidades.

───────────────────────────────
🎁 PERÍODO DE TESTE GRATUITO
───────────────────────────────
Plano: ${planName}
Duração: ${trialDays} dias
Expira em: ${trialEndsAt}

───────────────────────────────
O QUE VOCÊ PODE FAZER:
───────────────────────────────
✓ Registrar transações por WhatsApp ou pelo app
✓ Ver relatórios e gráficos das suas finanças
✓ Gerenciar categorias personalizadas
✓ Agendar compromissos financeiros
✓ Receber insights de IA sobre seus gastos

🚀 Acesse sua conta: https://app.iafeoficial.com/dash

───────────────────────────────
Dúvidas? Entre em contato:
financeiro@iafeoficial.com
───────────────────────────────

© 2026 IAFÉ Finanças
  `.trim();
};

// Email template for invitation
const getInvitationEmailContent = (data: {
  userName: string;
  requesterName: string;
  invitationLink: string;
}) => {
  const { userName, requesterName, invitationLink } = data;
  const firstName = userName ? userName.split(' ')[0] : 'usuário';
  const requesterFirstName = requesterName.split(' ')[0];

  return getEmailWrapper(`
    <tr>
      <td style="padding: 40px 32px 24px;" class="mobile-padding">
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">
          Convite para compartilhar! 🤝
        </h2>
        <p style="color: #64748b; line-height: 1.7; margin: 0; font-size: 15px;">
          Olá, ${firstName}!
        </p>
        <p style="color: #64748b; line-height: 1.7; margin: 16px 0 0 0; font-size: 15px;">
          <strong style="color: #0ea5e9;">${requesterName}</strong> convidou você para compartilhar o controle financeiro no <strong style="color: #0ea5e9;">IAFÉ Finanças</strong>.
        </p>
        <p style="color: #64748b; line-height: 1.7; margin: 16px 0 0 0; font-size: 15px;">
          Ao aceitar, vocês poderão visualizar e gerenciar despesas e receitas juntos, facilitando o planejamento familiar.
        </p>
      </td>
    </tr>
    
    <!-- CTA Button -->
    <tr>
      <td style="padding: 0 32px 32px; text-align: center;" class="mobile-padding">
        <a href="${invitationLink}" class="btn btn-primary" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
          ✅ Aceitar Convite
        </a>
        <p style="margin: 16px 0 0 0; color: #64748b; font-size: 13px;">
          Se você não conhece essa pessoa, pode ignorar este e-mail.
        </p>
      </td>
    </tr>
  `, `${requesterFirstName} convidou você para compartilhar finanças no IAFÉ.`);
};

// Email template for accepted invitation
const getInvitationAcceptedEmailContent = (data: {
  userName: string;
  accepterName: string;
}) => {
  const { userName, accepterName } = data;
  const firstName = userName.split(' ')[0];
  const accepterFirstName = accepterName.split(' ')[0];

  return getEmailWrapper(`
    <tr>
      <td style="padding: 40px 32px 24px;" class="mobile-padding">
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">
          Convite aceito! 🎉
        </h2>
        <p style="color: #64748b; line-height: 1.7; margin: 0; font-size: 15px;">
          Olá, ${firstName}!
        </p>
        <p style="color: #64748b; line-height: 1.7; margin: 16px 0 0 0; font-size: 15px;">
          <strong style="color: #22c55e;">${accepterName}</strong> aceitou seu convite para compartilhar o controle financeiro.
        </p>
      </td>
    </tr>
    
    <!-- Info Badge -->
    <tr>
      <td style="padding: 0 32px 24px;" class="mobile-padding">
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 16px; padding: 24px; text-align: center;">
          <div style="width: 48px; height: 48px; background: #22c55e; border-radius: 12px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 24px;">🔗</span>
          </div>
          <h3 style="color: #16a34a; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Contas Conectadas</h3>
          <p style="color: #15803d; margin: 0; font-size: 14px;">Agora vocês podem ver os dados um do outro.</p>
        </div>
      </td>
    </tr>

    <!-- CTA Button -->
    <tr>
      <td style="padding: 0 32px 32px; text-align: center;" class="mobile-padding">
        <a href="https://app.iafeoficial.com/dash" class="btn btn-primary" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
          🚀 Acessar Painel
        </a>
      </td>
    </tr>
  `, `${accepterFirstName} aceitou seu convite de compartilhamento.`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Sending email with type:', body.emailType || 'payment');

    const {
      emailType = 'payment', // 'payment', 'welcome_trial', 'trial_expiring', 'invitation', 'invitation_accepted'
      to,
      userName,
      requesterName,
      accepterName,
      invitationLink,
      planName,
      planPrice,
      paymentMethod,
      pixCode,
      pixQrCodeUrl,
      boletoUrl,
      invoiceUrl,
      expiresAt,
      trialDays,
      trialEndsAt,
      daysRemaining
    } = body;

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração de email não encontrada.', sent: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!to || (!userName && !requesterName && !accepterName)) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos para envio de email', sent: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let htmlContent = '';
    let textContent = '';
    let subject = '';

    // Format price if provided
    const formattedPrice = planPrice ? parseFloat(planPrice).toFixed(2).replace('.', ',') : '';

    if (emailType === 'invitation') {
      // Invitation email
      htmlContent = getInvitationEmailContent({
        userName,
        requesterName,
        invitationLink
      });
      textContent = `Olá ${userName || ''}! ${requesterName} convidou você para compartilhar finanças no IAFÉ Finanças. Acesse ${invitationLink} para aceitar.`;
      subject = `convite de ${requesterName} para compartilhar finanças`;

    } else if (emailType === 'invitation_accepted') {
      // Invitation accepted email
      htmlContent = getInvitationAcceptedEmailContent({
        userName,
        accepterName
      });
      textContent = `Olá ${userName}! ${accepterName} aceitou seu convite. Agora vocês compartilham o controle financeiro.`;
      subject = `🎉 ${accepterName} aceitou seu convite!`;

    } else if (emailType === 'welcome_trial') {
      // Welcome with trial email
      const formattedTrialEnds = new Date(trialEndsAt).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      htmlContent = getWelcomeTrialEmailContent({
        userName,
        planName,
        trialDays,
        trialEndsAt: formattedTrialEnds
      });
      textContent = getWelcomeTrialEmailText({
        userName,
        planName,
        trialDays,
        trialEndsAt: formattedTrialEnds
      });
      subject = `🎉 Bem-vindo ao IAFÉ Finanças! Seus ${trialDays} dias grátis começaram`;

    } else if (emailType === 'trial_expiring') {
      // Trial expiring email
      const formattedTrialEnds = new Date(trialEndsAt).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      htmlContent = getTrialExpiringEmailContent({
        userName,
        planName,
        planPrice: formattedPrice,
        daysRemaining,
        trialEndsAt: formattedTrialEnds
      });
      textContent = `Olá ${userName}! Seu período gratuito no IAFÉ Finanças expira em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}. Assine agora para continuar usando.`;
      subject = `⏰ ${userName.split(' ')[0]}, faltam ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} para seu trial expirar`;

    } else {
      // Payment email (default)
      const formattedExpires = new Date(expiresAt).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      htmlContent = getPaymentEmailContent({
        userName,
        planName,
        planPrice: formattedPrice,
        paymentMethod,
        pixCode,
        pixQrCodeUrl,
        boletoUrl,
        invoiceUrl,
        expiresAt: formattedExpires
      });
      textContent = getPaymentEmailText({
        userName,
        planName,
        planPrice: formattedPrice,
        paymentMethod,
        pixCode,
        boletoUrl,
        invoiceUrl,
        expiresAt: formattedExpires
      });
      subject = `💳 Complete seu pagamento - ${planName}`;
    }

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html: htmlContent,
        text: textContent
      })
    });

    const result = await response.json();
    console.log('Resend API response:', response.status, result);

    if (!response.ok) {
      console.error('Failed to send email:', result);
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar email', details: result, sent: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email sent successfully:', result.id);

    return new Response(
      JSON.stringify({ success: true, sent: true, emailId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-payment-email function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao enviar email', sent: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
