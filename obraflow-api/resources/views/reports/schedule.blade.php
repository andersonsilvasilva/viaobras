@php
    $F = \App\Modules\Budgets\Report\ReportFormat::class;
    $m = $data['meta'];
    $t = $data['totals'];
    $p = $data['pricing'];
    $K = \App\Modules\Planning\Export\ScheduleExportBuilder::KIND_LABEL;
    $type = ['summary' => 'Etapa', 'task' => 'Atividade', 'milestone' => 'Marco'];
@endphp
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Orçamento sintético — {{ $m['project_code'] }}</title>
<style>
{!! $fontFace !!}
:root{--sapphire:#0f52ba;--deep:#0a2e66;--soft:#eaf1ff;--graphite:#252a35;--line:#e5e7eb;--muted:#6b7280}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Geist',Arial,sans-serif;font-size:8.6pt;color:var(--graphite);line-height:1.35;font-variant-numeric:tabular-nums}
@page{
  size:A4 landscape;margin:16mm 11mm 14mm 11mm;
  @top-left{content:"ViaObras  ·  Orçamento sintético do planejamento  ·  {{ $m['project_code'] }}";font-family:'Geist',Arial,sans-serif;font-size:7.5pt;color:#6b7280;vertical-align:bottom;padding-bottom:3mm}
  @bottom-left{content:"Emitido em {{ $m['issued_at'] }}  ·  Gerado pelo ViaObras";font-family:'Geist',Arial,sans-serif;font-size:7.5pt;color:#6b7280;vertical-align:top;padding-top:3mm}
  @bottom-right{content:"Página " counter(page) " de " counter(pages);font-family:'Geist',Arial,sans-serif;font-size:7.5pt;color:#0a2e66;font-weight:600;vertical-align:top;padding-top:3mm}
}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--sapphire);padding-bottom:3mm;margin-bottom:4mm}
.head img{height:9mm}
.head h1{font-size:17pt;color:var(--deep);margin:0 0 1mm;font-weight:700}
.head .sub{color:var(--muted);font-size:8.5pt}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm;margin-bottom:5mm}
.kpi{border:1px solid var(--line);border-radius:2.5mm;padding:2.5mm 3.5mm}
.kpi .k{font-size:7pt;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.kpi .v{font-size:12pt;font-weight:700;margin-top:.5mm}
.kpi .s{font-size:7.5pt;color:var(--muted)}
.kpi.main{background:var(--deep);border-color:var(--deep)}.kpi.main .k,.kpi.main .s{color:#c7d7f7}.kpi.main .v{color:#fff}
h2{font-size:11pt;color:var(--sapphire);margin:5mm 0 2mm;font-weight:600}
table{width:100%;border-collapse:collapse}
thead{display:table-header-group}
tr{break-inside:avoid}
th{background:var(--sapphire);color:#fff;font-weight:600;font-size:7.2pt;text-transform:uppercase;letter-spacing:.03em;padding:1.6mm 1.6mm;text-align:left;white-space:nowrap}
td{padding:1.3mm 1.6mm;border-bottom:1px solid var(--line);vertical-align:top}
.r{text-align:right;white-space:nowrap}.c{text-align:center}
.mono{font-size:7.6pt;color:#4b5563}
tr.g td{background:var(--soft);color:var(--deep);font-weight:600}
tr.total td{background:var(--deep);color:#fff;font-weight:700;font-size:9.5pt}
tr.item td{color:#4b5563;font-size:7.8pt}
.note{font-size:7.5pt;color:var(--muted);margin-top:2mm}
.section{break-before:page}
</style>
</head>
<body>
<div class="head">
  <div>
    <h1>Orçamento sintético do planejamento</h1>
    <div class="sub">{{ $m['project_code'] ? $m['project_code'].' — ' : '' }}{{ $m['project_name'] }}{{ $m['company'] ? ' · '.$m['company'] : '' }}</div>
    <div class="sub">{{ $m['origin'] }} · duração em {{ $m['duration_mode'] }} · encargos: {{ $m['regime'] }} · período {{ $m['start'] ?? '—' }} a {{ $m['end'] ?? '—' }}</div>
  </div>
  <img src="{{ $logo }}" alt="ViaObras">
</div>

<div class="kpis">
  <div class="kpi"><div class="k">Custo</div><div class="v">{{ $F::money($t['cost']) }}</div><div class="s">{{ $t['item_count'] }} recurso(s)</div></div>
  <div class="kpi"><div class="k">Com BDI</div><div class="v">{{ $F::money($t['with_bdi']) }}</div></div>
  <div class="kpi"><div class="k">BDI</div><div class="v">{{ $F::money($t['bdi_amount']) }}</div><div class="s">{{ $F::percent($p['bdi_percent']) }} · {{ $p['bdi_method'] }}</div></div>
  <div class="kpi"><div class="k">Desconto</div><div class="v">{{ $F::money($t['discount_amount']) }}</div><div class="s">{{ $F::percent($p['discount_percent']) }}</div></div>
  <div class="kpi main"><div class="k">Valor final</div><div class="v">{{ $F::money($t['sale']) }}</div></div>
</div>

<h2>Atividades</h2>
<table>
  <thead><tr>
    <th style="width:14mm">ID</th><th>Atividade</th><th class="c" style="width:12mm">Un.</th><th class="r" style="width:18mm">Qtd.</th>
    <th class="r" style="width:22mm">Custo unit.</th><th class="r" style="width:22mm">Venda unit.</th>
    @foreach ($K as $label)<th class="r" style="width:21mm">{{ $label }}</th>@endforeach
    <th class="r" style="width:24mm">Total de custo</th><th class="r" style="width:24mm">Total de venda</th>
  </tr></thead>
  <tbody>
    @foreach ($data['rows'] as $r)
      <tr class="{{ $r['type'] === 'summary' ? 'g' : '' }}">
        <td class="mono">{{ $r['wbs'] }}</td>
        <td style="padding-left:{{ 1.6 + $r['level'] * 3.5 }}mm">{{ $r['name'] }}</td>
        <td class="c">{{ $r['unit'] }}</td>
        <td class="r">{{ $r['quantity'] !== null ? $F::quantity($r['quantity']) : '' }}</td>
        <td class="r">{{ $r['unit_cost'] !== null ? $F::money($r['unit_cost']) : '' }}</td>
        <td class="r">{{ $r['unit_sale'] !== null ? $F::money($r['unit_sale']) : '' }}</td>
        @foreach (array_keys($K) as $kind)<td class="r">{{ $r['kinds'][$kind]['cost'] !== '0.00' ? $F::money($r['kinds'][$kind]['cost']) : '—' }}</td>@endforeach
        <td class="r">{{ $F::money($r['cost']) }}</td>
        <td class="r">{{ $F::money($r['sale']) }}</td>
      </tr>
    @endforeach
    <tr class="total">
      <td colspan="6">Total</td>
      @foreach (array_keys($K) as $kind)<td class="r">{{ $F::money($t['by_kind'][$kind]['cost']) }}</td>@endforeach
      <td class="r">{{ $F::money($t['cost']) }}</td>
      <td class="r">{{ $F::money($t['sale']) }}</td>
    </tr>
  </tbody>
</table>
<div class="note">Colunas por tipo = total de custo de cada tipo de insumo. Unitários por unidade da atividade. Venda = custo × (1 + BDI) × (1 − desconto), arredondada por recurso. A planilha (XLSX) traz as 28 colunas, com custo e venda unitários e totais por tipo.</div>

<h2>Por tipo de insumo</h2>
<table style="width:60%">
  <thead><tr><th>Tipo</th><th class="r">Custo</th><th class="r">Venda</th><th class="r">% da venda</th></tr></thead>
  <tbody>
    @foreach ($K as $kind => $label)
      @php $sale = $t['by_kind'][$kind]['sale']; @endphp
      <tr><td>{{ $label }}</td><td class="r">{{ $F::money($t['by_kind'][$kind]['cost']) }}</td><td class="r">{{ $F::money($sale) }}</td>
        <td class="r">{{ (float) $t['sale'] > 0 ? $F::percent(bcmul(bcdiv($sale, $t['sale'], 6), '100', 4)) : '—' }}</td></tr>
    @endforeach
    <tr class="total"><td>Total</td><td class="r">{{ $F::money($t['cost']) }}</td><td class="r">{{ $F::money($t['sale']) }}</td><td class="r">100,00%</td></tr>
  </tbody>
</table>

<div class="section">
  <h2>Cronograma</h2>
  <table>
    <thead><tr><th style="width:14mm">ID</th><th>Atividade</th><th style="width:20mm">Tipo</th><th class="c" style="width:22mm">Início</th><th class="c" style="width:22mm">Término</th><th class="r" style="width:18mm">Duração</th><th style="width:34mm">Predecessoras</th><th class="r" style="width:20mm">Executado</th></tr></thead>
    <tbody>
      @foreach ($data['rows'] as $r)
        <tr class="{{ $r['type'] === 'summary' ? 'g' : '' }}">
          <td class="mono">{{ $r['wbs'] }}</td>
          <td style="padding-left:{{ 1.6 + $r['level'] * 3.5 }}mm">{{ $r['name'] }}</td>
          <td>{{ $type[$r['type']] ?? $r['type'] }}</td>
          <td class="c">{{ $r['start'] }}</td><td class="c">{{ $r['end'] }}</td>
          <td class="r">{{ $r['duration'] }} {{ $m['duration_mode'] === 'dias úteis' ? 'd.u.' : 'd' }}</td>
          <td class="mono">{{ $r['predecessors'] }}</td>
          <td class="r">{{ $F::percent($r['percent']) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>
</div>
</body>
</html>
