import { cn } from "@/lib/utils";

const TERMS_SECTIONS = [
  {
    title: "TERMOS DE USO",
    subtitle: "IAFÉ FINANÇAS",
    intro: "Estes Termos de Uso (“Termos”) regulam o acesso e a utilização da plataforma digital de gestão financeira pessoal IAFÉ FINANCAS (“Plataforma”), disponibilizada por IAFÉ TECNOLOGIA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob n° 57.129.684/0001-43, com sede na Av. São Luis Rei De Franca, Dom Center, loja 28, São Luís, MA, CEP 65.065-470 (“Fornecedor”).",
    closing: "Ao acessar ou utilizar a Plataforma, o Usuário declara ter lido, compreendido e concordado integralmente com estes Termos.",
  },
  {
    id: "1",
    title: "OBJETO DA PLATAFORMA",
    items: [
      "A Plataforma consiste em ferramenta tecnológica destinada à organização, categorização e visualização de informações financeiras pessoais, mediante inserção manual de dados ou envio de documentos e imagens pelo Usuário.",
      "A Plataforma utiliza recursos de inteligência artificial e automação para: identificar despesas a partir de imagens de notas fiscais, recibos ou faturas; classificar gastos por categorias (ex.: alimentação, transporte, lazer); consolidar receitas e despesas informadas; gerar relatórios, gráficos e análises comportamentais; apresentar sugestões automatizadas de organização financeira.",
      "A Plataforma não realiza movimentações bancárias, não acessa contas financeiras e não presta serviços bancários, de investimento, crédito ou consultoria financeira personalizada.",
    ],
  },
  {
    id: "2",
    title: "NATUREZA MERAMENTE INFORMATIVA DAS ANÁLISES",
    items: [
      "As análises, alertas, estimativas, previsões e sugestões apresentadas pela Plataforma: são geradas automaticamente por algoritmos; possuem caráter exclusivamente educativo, informativo e auxiliar; não constituem aconselhamento financeiro, contábil, jurídico ou de investimento.",
      "O Usuário reconhece que: decisões financeiras são de sua exclusiva responsabilidade; qualquer ação tomada com base nas informações da Plataforma ocorre por sua conta e risco.",
      "O Fornecedor não garante resultados financeiros, economia, redução de gastos ou melhoria patrimonial.",
    ],
  },
  {
    id: "3",
    title: "RESPONSABILIDADE PELAS INFORMAÇÕES INSERIDAS",
    items: [
      "Todos os dados inseridos na Plataforma são fornecidos diretamente pelo Usuário, que declara: serem verdadeiros, completos e atualizados; possuir legitimidade para inseri-los.",
      "O Fornecedor: não valida, audita ou verifica a exatidão das informações; processa os dados confiando na boa-fé do Usuário.",
      "Informações incorretas, incompletas ou desatualizadas poderão gerar análises imprecisas, não sendo o Fornecedor responsável por quaisquer consequências.",
    ],
  },
  {
    id: "4",
    title: "USO DE IMAGENS E DOCUMENTOS",
    items: [
      "O Usuário poderá enviar imagens de documentos financeiros, como: notas fiscais; recibos; faturas de cartão; comprovantes de pagamento.",
      "Tais arquivos serão processados por tecnologia de reconhecimento automatizado para extração de dados financeiros a partir do lançamento da informação por whatsapp.",
      "O Usuário declara possuir autorização para compartilhar tais documentos e se responsabiliza por eventual envio indevido de dados de terceiros.",
    ],
  },
  {
    id: "5",
    title: "FUNCIONALIDADE DE GESTÃO FINANCEIRA COMPARTILHADA",
    items: [
      "A Plataforma permite o compartilhamento de acesso entre Usuários para gestão financeira conjunta (ex.: cônjuges, companheiros, familiares ou terceiros autorizados).",
      "O compartilhamento somente ocorrerá mediante: convite formal dentro da Plataforma; e aceite expresso do Usuário convidado.",
      "Ao autorizar o compartilhamento, o Usuário reconhece que o terceiro poderá: visualizar informações financeiras; inserir ou editar dados; gerar relatórios conjuntos.",
      "O Fornecedor não se responsabiliza por: conflitos decorrentes do uso compartilhado; decisões tomadas por qualquer dos Usuários; utilização indevida das informações por pessoas autorizadas.",
      "A revogação do acesso poderá ser feita a qualquer momento pelo Usuário concedente.",
    ],
  },
  {
    id: "6",
    title: "LIMITAÇÃO DE RESPONSABILIDADE",
    items: [
      "O Fornecedor não será responsável por: decisões financeiras tomadas pelo Usuário; prejuízos decorrentes de interpretação das análises; falhas originadas de dados inseridos incorretamente; expectativas subjetivas de economia ou desempenho financeiro.",
      "A Plataforma é disponibilizada como ferramenta de apoio organizacional, e não como substituta de planejamento profissional.",
      "Em nenhuma hipótese o Fornecedor responderá por lucros cessantes, danos indiretos ou perdas financeiras decorrentes do uso da Plataforma.",
    ],
  },
  {
    id: "7",
    title: "ASSINATURA E CONDIÇÕES DE USO",
    items: [
      "O acesso à Plataforma é disponibilizado mediante assinatura recorrente, conforme plano contratado.",
      "O não pagamento poderá acarretar suspensão ou cancelamento do acesso.",
      "O Usuário poderá cancelar a assinatura a qualquer momento, respeitadas as condições comerciais vigentes no momento da contratação.",
      "Em caso de cancelamento, a assinatura permanecerá válida até o seu vencimento.",
    ],
  },
  {
    id: "8",
    title: "CADASTRO E USO DA PLATAFORMA",
    items: [
      "O Usuário realizará o cadastro na plataforma e receberá um código de verificação por e-mail.",
      "Após informar o código de verificação na Plataforma, será direcionado para o cadastro do método de pagamento, que poderá ser: Pix recorrente ou Cartão de Crédito.",
      "A proteção da senha de acesso criada pelo Usuário é de sua exclusiva responsabilidade.",
      "O Usuário receberá mensagem no seu número de whatsapp cadastrado e poderá enviar todas as informações, dados, imagens de despesas, etc., por meio deste aplicativo. As informações serão automaticamente lançadas na Plataforma para compor os indicadores financeiros do Usuário.",
    ],
  },
  {
    id: "9",
    title: "INTEGRAÇÕES",
    items: [
      "A Plataforma é integrada com os seguintes sistemas: Whatsapp (META): o Usuário enviará as informações por meio do whatsapp e os dados serão automaticamente lançados na Plataforma. ASAAS: a Plataforma adota este sistema de solução de pagamento para recebimento e gestão das mensalidades. Google Agenda: a Plataforma poderá fazer integração com a agenda do Google para enviar lembretes de compromissos ao Usuário.",
    ],
  },
  {
    id: "10",
    title: "PROTEÇÃO DE DADOS PESSOAIS (LGPD)",
    items: [
      "O tratamento de dados pessoais observará a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD).",
      "A Plataforma trata os seguintes dados pessoais: Nome, CPF, E-mail, Telefone celular, Endereço.",
      "Os dados são tratados para: viabilizar o funcionamento da Plataforma; gerar análises financeiras automatizadas; melhorar a experiência do Usuário.",
      "O Fornecedor adota medidas técnicas e administrativas de segurança da informação compatíveis com o estado da tecnologia.",
      "O Usuário poderá exercer seus direitos legais de acesso, correção ou exclusão mediante solicitação.",
    ],
  },
  {
    id: "11",
    title: "PROPRIEDADE INTELECTUAL",
    items: [
      "Todos os sistemas, algoritmos, interfaces, relatórios e funcionalidades pertencem exclusivamente ao Fornecedor.",
      "É vedado: copiar ou reproduzir a Plataforma; tentar acessar o código-fonte; utilizar a tecnologia para fins concorrenciais.",
    ],
  },
  {
    id: "12",
    title: "DISPONIBILIDADE E LIMITAÇÕES TECNOLÓGICAS",
    items: [
      "A Plataforma depende de serviços de internet e infraestrutura de terceiros, podendo ocorrer interrupções, atualizações ou indisponibilidades técnicas.",
      "O Fornecedor não garante funcionamento ininterrupto ou livre de erros.",
    ],
  },
  {
    id: "13",
    title: "ALTERAÇÕES DESTES TERMOS",
    items: [
      "Estes Termos poderão ser atualizados a qualquer momento para refletir melhorias tecnológicas, adequações legais ou mudanças de serviço.",
      "A continuidade de uso da Plataforma após alteração caracteriza concordância com a nova versão.",
    ],
  },
  {
    id: "14",
    title: "LEGISLAÇÃO APLICÁVEL E FORO",
    items: [
      "Estes Termos serão regidos pelas leis da República Federativa do Brasil.",
      "Fica eleito o foro da comarca de São Luís, MA, com renúncia a qualquer outro, para dirimir eventuais controvérsias.",
    ],
  },
  {
    id: "15",
    title: "DISPOSIÇÃO FINAL",
    items: [
      "A Plataforma é instrumento de organização e educação financeira, cabendo exclusivamente ao Usuário a gestão real de sua vida econômica, a validação das informações inseridas e a tomada de decisões.",
    ],
  },
];

export function TermsOfUseContent({ className }: { className?: string }) {
  const [first, ...rest] = TERMS_SECTIONS;
  const isIntro = "intro" in first;

  return (
    <div className={cn("terms-of-use text-foreground", className)}>
      {/* Header */}
      <header className="mb-6 pb-4 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight uppercase text-primary">
          {first.title}
        </h1>
        {"subtitle" in first && (
          <p className="text-base font-semibold text-muted-foreground mt-1">
            {first.subtitle}
          </p>
        )}
        {"intro" in first && (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {first.intro}
            </p>
            {"closing" in first && first.closing && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground font-medium">
                {first.closing}
              </p>
            )}
          </>
        )}
      </header>

      {/* Sections */}
      <div className="space-y-6">
        {rest.map((section) => (
          <section key={section.id || section.title} className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">
              {section.id}. {section.title}
            </h2>
            <ul className="space-y-2 pl-0 list-none">
              {"items" in section &&
                section.items.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm leading-relaxed text-muted-foreground flex gap-2"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-8 pt-6 border-t border-border text-center space-y-1">
        <p className="text-sm font-semibold text-foreground">
          IAFÉ TECNOLOGIA
        </p>
        <a
          href="mailto:comercial@iafeoficial.com"
          className="text-sm text-primary hover:underline"
        >
          comercial@iafeoficial.com
        </a>
        <p className="text-xs text-muted-foreground mt-2">
          Versão: fevereiro/2026
        </p>
      </footer>
    </div>
  );
}
