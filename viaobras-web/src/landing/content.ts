/**
 * Conteúdo e constantes da landing institucional.
 * Textos e links ficam aqui (e não nos componentes) para que a cópia seja revisável num só lugar
 * e para que os testes verifiquem links e âncoras.
 */

export const APP_URL = 'https://app.viaobras.com.br/'
export const SITE_URL = 'https://viaobras.com.br/'

/** Âncoras das seções (ids no DOM). */
export const SECTION_IDS = {
  top: 'topo',
  benefits: 'beneficios',
  platform: 'plataforma',
  features: 'recursos',
  projects: 'obras',
  budget: 'orcamentos',
  supplies: 'suprimentos',
  indicators: 'indicadores',
  integrated: 'integrada',
} as const

export const NAV_LINKS = [
  { label: 'Plataforma', href: `#${SECTION_IDS.platform}` },
  { label: 'Recursos', href: `#${SECTION_IDS.features}` },
  { label: 'Orçamentos', href: `#${SECTION_IDS.budget}` },
  { label: 'Benefícios', href: `#${SECTION_IDS.benefits}` },
] as const

export const FOOTER_LINKS = [
  { label: 'Plataforma', href: `#${SECTION_IDS.platform}` },
  { label: 'Obras', href: `#${SECTION_IDS.projects}` },
  { label: 'Orçamentos', href: `#${SECTION_IDS.budget}` },
  { label: 'Suprimentos', href: `#${SECTION_IDS.supplies}` },
  { label: 'Indicadores', href: `#${SECTION_IDS.indicators}` },
  { label: 'Acessar sistema', href: APP_URL },
] as const

/**
 * Screenshots reais do sistema. Os arquivos NÃO são gerados nem substituídos por imagens genéricas:
 * ficam em `public/landing/` (ver o README dessa pasta). Enquanto o arquivo não existir, a landing
 * mostra um espaço reservado neutro, sem dados inventados.
 */
export interface Shot {
  file: string
  alt: string
  /** Dimensões originais da captura (px): servem para calcular proporção e recorte sem distorcer. */
  width: number
  height: number
}

/** Recorte em frações (0–1) da captura original: posição (x, y) e tamanho (w, h). */
export interface ShotCrop {
  x: number
  y: number
  w: number
  h: number
}

export const SHOTS = {
  dashboard: {
    file: 'visao-geral.png',
    alt: 'Tela Visão geral da ViaObras com indicadores de obras, orçamentos e finanças',
    width: 1887,
    height: 934,
  },
  projects: {
    file: 'obras.png',
    alt: 'Tela de Obras da ViaObras com os cartões de acompanhamento de cada obra',
    width: 1902,
    height: 921,
  },
  budget: {
    file: 'orcamentos.png',
    alt: 'Tela de orçamento da ViaObras com etapas, itens, BDI e preço final',
    width: 1425,
    height: 856,
  },
  supplies: {
    file: 'suprimentos.png',
    alt: 'Tela de Suprimentos da ViaObras com a tabela de solicitações e seus status',
    width: 1910,
    height: 879,
  },
} as const satisfies Record<string, Shot>

/**
 * Recortes (frações da captura original). Só enquadram: nada é redesenhado.
 * Para trocar uma captura, mantenha o nome do arquivo e ajuste width/height acima e o recorte aqui.
 */
export const CROPS = {
  /** Obras: aproximado no cartão da obra e nos primeiros indicadores (sem a barra lateral). */
  projects: { x: 0.19, y: 0.085, w: 0.45, h: 0.7 },
  /** Orçamento: o recorte (sem a barra lateral) já está gravado no arquivo. */
  budget: { x: 0, y: 0, w: 1, h: 1 },
  /** Suprimentos: a tabela inteira, com prioridade e situação à direita. */
  supplies: { x: 0.19, y: 0, w: 0.76, h: 0.67 },
  /** Indicadores: segunda linha de cartões financeiros e os dois gráficos. */
  indicators: { x: 0.19, y: 0.385, w: 0.76, h: 0.545 },
} as const satisfies Record<string, ShotCrop>

export const HERO = {
  eyebrow: 'Gestão inteligente de obras',
  title: 'Sua obra. Seus números. Seu controle.',
  text: [
    'Planeje, gerencie e acompanhe suas obras com mais organização, visibilidade e controle.',
    'Centralize orçamentos, execução, suprimentos e indicadores em uma plataforma desenvolvida para simplificar sua gestão.',
  ],
  primaryCta: 'Conhecer a plataforma',
  secondaryCta: 'Acessar ViaObras',
} as const

export const BENEFITS = [
  { icon: 'obras', title: 'Gestão de obras', text: 'Organização centralizada dos projetos.' },
  { icon: 'custos', title: 'Controle de custos', text: 'Visibilidade dos orçamentos e valores.' },
  { icon: 'decisoes', title: 'Decisões melhores', text: 'Indicadores e informações para gestão.' },
] as const

export const PLATFORM = {
  eyebrow: 'Visão geral',
  title: 'Tudo o que importa. Em uma única visão.',
  text: 'Tenha uma visão abrangente da operação. Acompanhe o desempenho das obras, indicadores financeiros, solicitações pendentes e evolução dos projetos sem precisar navegar por várias ferramentas.',
  highlights: [
    { icon: 'obras', label: 'Total de obras' },
    { icon: 'andamento', label: 'Em andamento' },
    { icon: 'concluidas', label: 'Concluídas' },
    { icon: 'atraso', label: 'Em atraso' },
    { icon: 'pendentes', label: 'Solicitações pendentes' },
    { icon: 'orcamento', label: 'Orçamento total' },
    { icon: 'custo', label: 'Custo realizado' },
    { icon: 'saldo', label: 'Saldo orçamentário' },
    { icon: 'pagar', label: 'Contas a pagar' },
    { icon: 'receber', label: 'Contas a receber' },
  ],
} as const

export const PROJECTS = {
  eyebrow: 'Gestão de obras',
  title: 'Cada obra acompanhada de perto.',
  text: [
    'Centralize as informações das suas obras e acompanhe o que está acontecendo em cada projeto.',
    'Saiba quem está responsável, quanto já foi executado, quais são os prazos e quais informações precisam de atenção.',
  ],
  features: [
    { icon: 'projetos', title: 'Organização de projetos', text: 'Todas as obras reunidas em um só lugar.' },
    { icon: 'responsavel', title: 'Responsáveis técnicos', text: 'Quem responde por cada obra, à vista.' },
    { icon: 'encarregado', title: 'Encarregados', text: 'A equipe de campo associada a cada projeto.' },
    { icon: 'progresso', title: 'Progresso da execução', text: 'O quanto já foi executado, obra a obra.' },
    { icon: 'status', title: 'Status da obra', text: 'Situação atual de cada projeto.' },
    { icon: 'prazo', title: 'Previsão de entrega', text: 'Prazos visíveis para antecipar decisões.' },
    { icon: 'indicadores', title: 'Indicadores de acompanhamento', text: 'Sinais de atenção no próprio cartão da obra.' },
  ],
} as const

export const BUDGET = {
  eyebrow: 'Orçamentos',
  title: 'Orçamento não é apenas um número. É a base da sua decisão.',
  text: 'Estruture seus orçamentos com precisão, organize etapas e itens, acompanhe custos e trabalhe com versões para manter o histórico e a rastreabilidade das decisões.',
  resources: [
    'Composição orçamentária',
    'Etapas',
    'Itens e serviços',
    'Quantidades',
    'Unidades',
    'Custos unitários',
    'Custos diretos',
    'BDI',
    'Custos indiretos',
    'Descontos',
    'Preço final',
    'Versionamento',
    'Histórico',
    'Curva ABC',
  ],
  cards: [
    { icon: 'composicao', title: 'Composição dos custos', text: 'Etapas, itens, quantidades e custos unitários organizados.' },
    { icon: 'bdi', title: 'BDI e custos indiretos', text: 'Encargos e margens aplicados de forma transparente.' },
    { icon: 'preco', title: 'Preço final', text: 'O valor consolidado, com descontos considerados.' },
    { icon: 'versoes', title: 'Versões e histórico', text: 'Cada decisão rastreável ao longo do tempo.' },
    { icon: 'abc', title: 'Curva ABC', text: 'Foco nos itens que mais pesam no orçamento.' },
  ],
} as const

export const SUPPLIES = {
  eyebrow: 'Suprimentos',
  title: 'Sua obra precisa de materiais. Sua gestão precisa de organização.',
  text: 'Organize solicitações de materiais, acompanhe o fluxo de atendimento e tenha visibilidade das demandas de cada obra.',
  features: [
    { icon: 'solicitacoes', title: 'Solicitações centralizadas', text: 'Todas as demandas em uma única lista.' },
    { icon: 'obra', title: 'Identificação da obra', text: 'Cada solicitação ligada à sua obra.' },
    { icon: 'solicitante', title: 'Solicitante', text: 'Quem pediu e quando.' },
    { icon: 'prioridade', title: 'Prioridade', text: 'O que precisa de atenção primeiro.' },
    { icon: 'situacao', title: 'Situação', text: 'Status claro de cada solicitação.' },
    { icon: 'aprovacao', title: 'Fluxo de aprovação', text: 'Etapas de aprovação acompanhadas.' },
    { icon: 'acompanhamento', title: 'Acompanhamento', text: 'Visibilidade do atendimento até o fim.' },
  ],
} as const

export const INDICATORS = {
  eyebrow: 'Controle financeiro e indicadores',
  title: 'Acompanhe os números. Antecipe os problemas.',
  text: [
    'Tenha mais clareza sobre a situação financeira dos seus projetos.',
    'Compare o que foi planejado com o que está sendo realizado e acompanhe a evolução de suas obras.',
  ],
  highlights: [
    'Orçamento total',
    'Custos realizados',
    'Saldo orçamentário',
    'Contas a pagar',
    'Contas a receber',
    'Evolução financeira',
    'Orçado versus realizado',
  ],
} as const

export const INTEGRATED = {
  title: 'Sua operação conectada.',
  text: 'Projetos, orçamento, suprimentos e acompanhamento trabalhando juntos para oferecer uma visão mais completa da sua gestão.',
  items: [
    { icon: 'obras', title: 'Obras', text: 'Gestão dos projetos.' },
    { icon: 'orcamentos', title: 'Orçamentos', text: 'Planejamento e composição de custos.' },
    { icon: 'suprimentos', title: 'Suprimentos', text: 'Demandas e solicitações de materiais.' },
    { icon: 'indicadores', title: 'Indicadores', text: 'Visão gerencial e acompanhamento.' },
  ],
} as const

export const FINAL_CTA = {
  title: 'Mais controle. Mais organização. Obras melhores.',
  text: 'Simplifique sua gestão, acompanhe seus projetos e tenha mais clareza para conduzir suas obras.',
  primary: 'Acessar a plataforma',
  secondary: 'Voltar ao início',
} as const

export const FOOTER = {
  tagline: 'Gestão inteligente de obras.',
  company: 'HighTech Tecnologia',
} as const
