import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeDollarSign,
  Building2,
  CalendarClock,
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  FolderKanban,
  Gauge,
  HardHat,
  History,
  Layers,
  ListChecks,
  Package,
  Percent,
  PiggyBank,
  Receipt,
  Calculator,
  TriangleAlert,
  TrendingUp,
  UserCog,
  Users,
  UserRound,
  Wallet,
  Workflow,
  Flag,
  Eye,
  type LucideIcon,
} from 'lucide-react'

/** Mapa único chave → ícone Lucide (as chaves vêm de `content.ts`). */
export const ICONS: Record<string, LucideIcon> = {
  // benefícios
  obras: HardHat,
  custos: Wallet,
  decisoes: TrendingUp,
  // visão geral
  andamento: Activity,
  concluidas: CircleCheck,
  atraso: TriangleAlert,
  pendentes: ClipboardList,
  orcamento: Wallet,
  custo: Receipt,
  saldo: PiggyBank,
  pagar: ArrowUpFromLine,
  receber: ArrowDownToLine,
  // obras
  projetos: FolderKanban,
  responsavel: UserCog,
  encarregado: Users,
  progresso: Gauge,
  status: Flag,
  prazo: CalendarClock,
  indicadores: ChartColumn,
  // orçamentos
  composicao: Layers,
  bdi: Percent,
  preco: BadgeDollarSign,
  versoes: History,
  abc: ChartColumn,
  // suprimentos
  solicitacoes: ClipboardList,
  obra: Building2,
  solicitante: UserRound,
  prioridade: Flag,
  situacao: ListChecks,
  aprovacao: ClipboardCheck,
  acompanhamento: Eye,
  // plataforma integrada
  orcamentos: Calculator,
  suprimentos: Package,
  fluxo: Workflow,
}

export function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? Layers
}
