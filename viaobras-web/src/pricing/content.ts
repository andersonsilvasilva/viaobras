/**
 * Conteúdo da página de planos: preços, limites, recursos, comparativo e perguntas.
 *
 * `soon: true` = o recurso AINDA NÃO EXISTE na plataforma: recebe um asterisco, explicado numa única nota
 * (SOON_NOTE). Só remova a marca quando o recurso estiver publicado. Conferido no código em 2026-11-25:
 *  - existem: obras, orçamentos (versões, aprovação, exportação), planejamento (exportação), empresas, clientes,
 *    fornecedores, equipes, solicitações de materiais com aprovação;
 *  - não existem: financeiro, contas a pagar/receber, orçado × realizado, dashboards (a Visão geral usa dados de
 *    demonstração) e um módulo de relatórios gerenciais.
 * Os limites de obras e usuários são condições comerciais: o sistema ainda não os aplica.
 */
import { APP_URL, SITE_URL } from '../landing/content'

export { APP_URL, SITE_URL }
export const PRICING_URL = `${SITE_URL}planos.html`

export const IDS = { top: 'topo', plans: 'planos', deployment: 'implantacao', comparison: 'comparativo', why: 'por-que', faq: 'perguntas' } as const

export const NAV = [
  { label: 'Plataforma', href: `${SITE_URL}#plataforma` },
  { label: 'Planos', href: `#${IDS.plans}` },
  { label: 'Comparativo', href: `#${IDS.comparison}` },
  { label: 'Perguntas', href: `#${IDS.faq}` },
] as const

export const HERO = {
  title: 'Planos para uma gestão de obras mais inteligente.',
  subtitle:
    'Escolha a solução ideal para sua operação. Centralize obras, orçamentos, custos e suprimentos em uma plataforma desenvolvida para simplificar sua gestão.',
  points: ['Gestão centralizada', 'Mais controle financeiro', 'Organização operacional'],
  primaryCta: 'Ver planos',
  secondaryCta: 'Conhecer a plataforma',
} as const

export type Billing = 'monthly' | 'annual'

export interface Feature {
  label: string
  soon?: boolean
}

export type PlanId = 'start' | 'pro' | 'business' | 'enterprise'

export interface Plan {
  id: PlanId
  name: string
  /** null = preço personalizado */
  price: { monthly: number; annual: number } | null
  activeProjects: number | null
  users: number | null
  description: string
  features: Feature[]
  cta: string
  featured?: boolean
}

const f = (label: string): Feature => ({ label })
const soon = (label: string): Feature => ({ label, soon: true })

export const PLANS: Plan[] = [
  {
    id: 'start',
    name: 'ViaObras Start',
    price: { monthly: 149, annual: 1490 },
    activeProjects: 2,
    users: 2,
    description: 'Para profissionais e pequenas equipes que desejam organizar suas obras e centralizar seus controles.',
    features: [
      f('Até 2 obras ativas'), f('Até 2 usuários'), f('Gestão de obras'), f('Orçamentos'), f('Cadastro de empresas'), f('Cadastro de clientes'),
      f('Cadastro de fornecedores'), f('Gestão de suprimentos'), soon('Dashboard básico'), f('Relatórios essenciais'),
    ],
    cta: 'Começar com Start',
  },
  {
    id: 'pro',
    name: 'ViaObras Pro',
    price: { monthly: 299, annual: 2990 },
    activeProjects: 5,
    users: 5,
    description: 'Para empresas que precisam de mais controle operacional, financeiro e gerencial.',
    features: [
      f('Até 5 obras ativas'), f('Até 5 usuários'), f('Todos os recursos do Start'), f('Histórico de orçamentos'), f('Fluxos de aprovação'),
      soon('Gestão financeira'), soon('Orçado x realizado'), soon('Contas a pagar e receber'), soon('Indicadores gerenciais'),
      soon('Relatórios completos'), soon('Dashboard executivo'),
    ],
    cta: 'Escolher plano Pro',
    featured: true,
  },
  {
    id: 'business',
    name: 'ViaObras Business',
    price: { monthly: 599, annual: 5990 },
    activeProjects: 15,
    users: 15,
    description: 'Para construtoras e empresas que gerenciam múltiplas obras e precisam de visão consolidada.',
    features: [
      f('Até 15 obras ativas'), f('Até 15 usuários'), f('Todos os recursos do Pro'), f('Gestão ampliada'), f('Exportação de relatórios'),
      f('Onboarding assistido'), soon('Dashboard avançado'), soon('Visão consolidada'), soon('Relatórios avançados'),
    ],
    cta: 'Assinar Business',
  },
  {
    id: 'enterprise',
    name: 'ViaObras Enterprise',
    price: null,
    activeProjects: null,
    users: null,
    description: 'Uma estrutura de gestão adaptada à realidade e ao volume operacional da sua empresa.',
    features: [
      f('Número de obras personalizado'), f('Usuários personalizados'), f('Implantação dedicada'), f('Treinamento'), f('Integrações'),
      f('Customizações contratadas'), f('SLA comercial'), f('Atendimento especializado'),
    ],
    cta: 'Falar com consultor',
  },
]

export const ANNUAL_NOTE = 'Economize o equivalente a 2 mensalidades no plano anual.'
export const SOON_NOTE = '* Em implementação: liberação por etapas, ainda não disponível na plataforma.'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** Texto do preço do plano conforme a cobrança escolhida. */
export function priceLabel(plan: Plan, billing: Billing): { value: string; period: string; detail: string } {
  if (!plan.price) return { value: 'Personalizado', period: '', detail: 'Proposta conforme a sua operação' }
  return billing === 'monthly'
    ? { value: brl.format(plan.price.monthly), period: '/mês', detail: 'Cobrança mensal' }
    : { value: brl.format(plan.price.annual), period: '/ano', detail: `No lugar de ${brl.format(plan.price.monthly * 12)} em 12 mensalidades` }
}

export const DEPLOYMENT = {
  title: 'Comece com tudo organizado.',
  text: 'A implantação da ViaObras foi pensada para facilitar a entrada da sua empresa na plataforma, com orientação inicial para configuração e utilização.',
  priceLabel: 'Preço sugerido',
  price: 'R$ 490,00',
  items: ['Configuração inicial', 'Orientação de cadastro', 'Organização inicial da empresa', 'Treinamento introdutório', 'Orientação para início da operação'],
  note: 'A implantação pode ser gratuita em campanhas promocionais ou para contratações anuais elegíveis.',
  disclaimer: 'O escopo da implantação é confirmado na proposta comercial.',
  cta: 'Falar com consultor',
} as const

/** Célula do comparativo: true = incluído; null = não incluído; texto = nível ou quantidade. */
export interface Cell {
  value: true | null | string
  soon?: boolean
}

export interface Row {
  label: string
  /** O recurso inteiro ainda não existe. */
  soon?: boolean
  /** Start, Pro, Business, Enterprise */
  cells: [Cell, Cell, Cell, Cell]
}

type Raw = true | null | string | Cell
const row = (label: string, cells: [Raw, Raw, Raw, Raw], isSoon = false): Row => ({
  label,
  ...(isSoon ? { soon: true } : {}),
  cells: cells.map((c) => (c !== null && typeof c === 'object' ? c : { value: c })) as Row['cells'],
})
const later = (value: string): Cell => ({ value, soon: true })
const limit = (n: number | null) => (n === null ? 'Personalizado' : String(n))
const limits = (key: 'activeProjects' | 'users') => PLANS.map((p) => limit(p[key])) as [string, string, string, string]

export const COMPARISON: Row[] = [
  row('Obras ativas', limits('activeProjects')),
  row('Usuários', limits('users')),
  row('Gestão de obras', [true, true, true, true]),
  row('Orçamentos', [true, true, true, true]),
  row('Cadastro de clientes', [true, true, true, true]),
  row('Cadastro de fornecedores', [true, true, true, true]),
  row('Suprimentos', ['Básico', 'Completo', 'Completo', 'Completo']),
  row('Solicitações de materiais', [true, true, true, true]),
  row('Aprovações', [null, true, true, true]),
  row('Controle financeiro', ['Básico', 'Completo', 'Completo', 'Completo'], true),
  row('Orçado x realizado', ['Básico', true, true, true], true),
  row('Contas a pagar e receber', [null, true, true, true], true),
  row('Dashboard', ['Básico', 'Executivo', 'Avançado', 'Personalizado'], true),
  row('Relatórios', ['Básicos', later('Completos'), later('Avançados'), later('Personalizados')]),
  row('Gestão de equipes', ['Básica', true, true, true]),
  row('Histórico de orçamentos', [null, true, true, true]),
  row('Implantação assistida', [null, 'Orientada', 'Assistida', 'Dedicada']),
]

export const WHY = {
  title: 'Muito mais do que acompanhar obras.',
  subtitle: 'Uma plataforma para conectar informações, simplificar processos e oferecer uma visão mais clara da operação.',
  cards: [
    { icon: 'decisoes', title: 'Decisões com mais clareza', text: 'Visualize informações importantes para acompanhar a evolução dos seus projetos.' },
    { icon: 'custos', title: 'Controle financeiro', text: 'Acompanhe custos, orçamento e desempenho financeiro das suas obras.', note: '* Desempenho financeiro em implementação.' },
    { icon: 'projetos', title: 'Tudo centralizado', text: 'Reduza a dispersão de informações entre planilhas, documentos e controles.' },
    { icon: 'progresso', title: 'Mais eficiência', text: 'Organize processos e reduza o tempo gasto com controles operacionais.' },
  ],
} as const

export interface Question {
  question: string
  answer: string
  /** Acrescentado só quando há Política de Privacidade publicada (config.ts). */
  privacyAnswer?: string
}

export const FAQ: Question[] = [
  { question: 'Posso cancelar minha assinatura?', answer: 'Consulte as condições de cancelamento aplicáveis ao plano contratado.' },
  { question: 'Posso mudar de plano posteriormente?', answer: 'Você poderá solicitar a alteração do plano conforme a necessidade da sua operação e as condições comerciais vigentes.' },
  { question: 'Preciso instalar algum programa?', answer: 'A ViaObras é uma plataforma web acessada pelo navegador.' },
  { question: 'A ViaObras é adequada para pequenas empresas?', answer: 'Sim. O plano Start foi pensado para profissionais e equipes menores que desejam começar a organizar sua gestão.' },
  { question: 'Como funciona a implantação?', answer: 'A implantação poderá incluir orientação inicial, configuração e treinamento, conforme o plano contratado.' },
  {
    question: 'Meus dados estão seguros?',
    answer: 'Segurança e proteção de dados são prioridades na plataforma.',
    privacyAnswer: 'Consulte nossa Política de Privacidade para conhecer os detalhes.',
  },
]

export const FINAL = {
  title: 'Sua próxima obra começa com uma gestão melhor.',
  text: 'Organize sua operação, acompanhe seus resultados e tenha mais controle sobre cada projeto.',
  primary: 'Escolher meu plano',
  secondary: 'Falar com consultor',
} as const

export const FOOTER = {
  tagline: 'Gestão inteligente de obras.',
  company: 'Um produto digital da HighTech Tecnologia.',
  links: [
    { label: 'Início', href: SITE_URL },
    { label: 'Recursos', href: `${SITE_URL}#recursos` },
    { label: 'Planos', href: `#${IDS.plans}` },
    { label: 'Acessar plataforma', href: APP_URL },
  ],
} as const

export const salesMessage = (plan: Plan, billing: Billing) =>
  `Olá! Tenho interesse no plano ${plan.name}${plan.price ? ` (cobrança ${billing === 'monthly' ? 'mensal' : 'anual'})` : ''}.`
