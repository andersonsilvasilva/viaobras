<?php

namespace App\Modules\Planning\Export;

use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Cell\ImageCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Border;
use OpenSpout\Common\Entity\Style\BorderName;
use OpenSpout\Common\Entity\Style\BorderPart;
use OpenSpout\Common\Entity\Style\CellVerticalAlignment;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\Common\Entity\Sheet;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Options\PageOrientation;
use OpenSpout\Writer\XLSX\Options\PageSetup;
use OpenSpout\Writer\XLSX\Options\PaperSize;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Orçamento sintético do planejamento em .xlsx (6B, D-P73/D-P96): aba com as 28 colunas (como a exportação do Brickup),
 * aba dos recursos de cada atividade e aba do cronograma. Valores numéricos fixos (sem fórmulas), nas cores do ViaObras.
 */
final class ScheduleXlsxRenderer
{
    private const SAPPHIRE = '0052D4';

    private const DEEP = '0A2E66';

    private const SOFT = 'EAF1FF';

    private const GRAPHITE = '333333';

    private const MUTED = '6B7280';

    private const MONEY = '"R$" #,##0.00';

    private const QTY = '#,##0.00##';

    private const PCT = '0.00"%"';

    private Writer $writer;

    public function render(array $data, string $path): void
    {
        $this->writer = new Writer(new Options(pageSetup: new PageSetup(PageOrientation::LANDSCAPE, PaperSize::A4, fitToHeight: 0, fitToWidth: 1)));
        $this->writer->openToFile($path);
        $this->synthetic($data);
        $this->resources($data);
        $this->chronogram($data);
        $this->writer->close();
    }

    /** As 28 colunas: identificação (4), custo unitário (6), percentuais (2), venda unitária por tipo (5), total de custo por tipo (5), total de venda (6). */
    private function synthetic(array $d): void
    {
        $sheet = $this->writer->getCurrentSheet();
        $sheet->setName('Orçamento sintético');
        $k = ScheduleExportBuilder::KINDS;
        $label = ScheduleExportBuilder::KIND_LABEL;
        $headers = ['ID', 'Atividade', 'Un. medida', 'Qtd. unit.', 'Valor de custo unit.'];
        foreach ($k as $kind) {
            $headers[] = "Custo unit. {$label[$kind]}";
        }
        $headers[] = 'BDI (%)';
        $headers[] = 'Desconto (%)';
        foreach ($k as $kind) {
            $headers[] = "Venda unit. {$label[$kind]}";
        }
        foreach ($k as $kind) {
            $headers[] = "Total de custo {$label[$kind]}";
        }
        $headers[] = 'Total de venda';
        foreach ($k as $kind) {
            $headers[] = "Total de venda {$label[$kind]}";
        }
        $widths = [9, 46, 10, 11, 15, ...array_fill(0, 5, 14), 9, 11, ...array_fill(0, 5, 14), ...array_fill(0, 5, 15), 16, ...array_fill(0, 5, 15)];
        foreach ($widths as $i => $w) {
            $sheet->setColumnWidth((float) $w, $i + 1);
        }

        $m = $d['meta'];
        $t = $d['totals'];
        $this->row([new ImageCell(resource_path('report/brand/logo-completa.png'), 190, 43)], 40);
        $this->row([$this->text('Orçamento sintético do planejamento', $this->style(bold: true, size: 15, color: self::DEEP))], 24);
        $this->row([$this->text(trim(($m['project_code'] ? $m['project_code'].' — ' : '').$m['project_name']), $this->style(size: 12))]);
        $this->row([$this->text("{$m['origin']} · duração em {$m['duration_mode']} · encargos: {$m['regime']} · período {$m['start']} a {$m['end']}", $this->style(color: self::MUTED))]);
        $this->row([$this->text("Emitido em {$m['issued_at']} por {$m['issued_by']}", $this->style(color: self::MUTED))]);
        $this->row([]);
        $p = $d['pricing'];
        $box = [['Custo', $t['cost']], ['Com BDI', $t['with_bdi']], ['BDI ('.$this->pctText($p['bdi_percent']).' · '.$p['bdi_method'].')', $t['bdi_amount']],
            ['Desconto ('.$this->pctText($p['discount_percent']).')', $t['discount_amount']], ['Valor final', $t['sale']]];
        foreach ($box as $i => [$name, $value]) {
            $last = $i === count($box) - 1;
            $this->row([$this->text($name, $this->style(bold: $last, bg: $last ? self::SOFT : null)), $this->money($value, $this->style(bold: $last, bg: $last ? self::SOFT : null, format: self::MONEY))]);
        }
        $this->row([]);

        $this->row(array_map(fn ($h) => $this->text($h, $this->style(bold: true, color: Color::WHITE, bg: self::SAPPHIRE, wrap: true)), $headers), 32);
        foreach ($d['rows'] as $r) {
            $group = $r['type'] === 'summary';
            $st = fn (?string $format = null) => $this->style(bold: $group, color: $group ? self::DEEP : self::GRAPHITE, bg: $group ? self::SOFT : null, format: $format);
            $cells = [$this->text($r['wbs'], $st()), $this->text(str_repeat('   ', $r['level']).$r['name'], $st()), $this->text((string) $r['unit'], $st()),
                $r['quantity'] !== null ? $this->num($r['quantity'], self::QTY, $st(self::QTY)) : $this->text('', $st())];
            $unit = $r['unit_kinds'];
            $cells[] = $r['unit_cost'] !== null ? $this->money($r['unit_cost'], $st(self::MONEY)) : $this->text('', $st());
            foreach ($k as $kind) {
                $cells[] = $unit ? $this->money($unit[$kind]['cost'], $st(self::MONEY)) : $this->text('', $st());
            }
            $cells[] = $r['type'] === 'task' && $r['item_count'] > 0 ? $this->pct($d['pricing']['bdi_percent'], $st(self::PCT)) : $this->text('', $st());
            $cells[] = $r['type'] === 'task' && $r['item_count'] > 0 ? $this->pct($d['pricing']['discount_percent'], $st(self::PCT)) : $this->text('', $st());
            foreach ($k as $kind) {
                $cells[] = $unit ? $this->money($unit[$kind]['sale'], $st(self::MONEY)) : $this->text('', $st());
            }
            foreach ($k as $kind) {
                $cells[] = $this->money($r['kinds'][$kind]['cost'], $st(self::MONEY));
            }
            $cells[] = $this->money($r['sale'], $st(self::MONEY));
            foreach ($k as $kind) {
                $cells[] = $this->money($r['kinds'][$kind]['sale'], $st(self::MONEY));
            }
            $this->row($cells);
        }

        // total geral
        $st = fn (?string $format = null) => $this->style(bold: true, size: 11, color: Color::WHITE, bg: self::DEEP, format: $format);
        $cells = [$this->text('TOTAL', $st()), ...array_fill(0, 16, $this->text('', $st()))];
        foreach ($k as $kind) {
            $cells[] = $this->money($t['by_kind'][$kind]['cost'], $st(self::MONEY));
        }
        $cells[] = $this->money($t['sale'], $st(self::MONEY));
        foreach ($k as $kind) {
            $cells[] = $this->money($t['by_kind'][$kind]['sale'], $st(self::MONEY));
        }
        $this->row($cells, 20);
        $this->row([]);
        $this->row([$this->text('Unitários por unidade da atividade (Qtd. unit.); totais = quantidade × unitário, arredondados por recurso. Venda = custo × (1 + BDI) × (1 − desconto). Recursos com BDI ou desconto próprios aparecem na aba "Recursos".', $this->style(italic: true, color: self::MUTED))]);
    }

    private function resources(array $d): void
    {
        $sheet = $this->newSheet('Recursos');
        foreach ([9, 36, 18, 13, 11, 44, 8, 12, 12, 14, 9, 11, 14, 15, 15] as $i => $w) {
            $sheet->setColumnWidth((float) $w, $i + 1);
        }
        $this->row(array_map(fn ($h) => $this->text($h, $this->style(bold: true, color: Color::WHITE, bg: self::SAPPHIRE, wrap: true)),
            ['ID', 'Atividade', 'Origem', 'Tipo', 'Código', 'Descrição', 'Un.', 'Consumo', 'Qtd. total', 'Custo unit.', 'BDI (%)', 'Desconto (%)', 'Venda unit.', 'Total de custo', 'Total de venda']), 30);
        foreach ($d['rows'] as $r) {
            foreach ($r['items'] as $i) {
                $this->row([$this->text($r['wbs']), $this->text($r['name']), $this->text($i['source']), $this->text($i['kind']), $this->text((string) $i['code']), $this->text($i['description'], $this->style(wrap: true)),
                    $this->text($i['unit']), $this->num($i['quantity_per_unit'], '#,##0.00#####'), $this->num($i['quantity_total'] ?? '0', self::QTY), $this->money($i['unit_cost']),
                    $this->pct($i['bdi_percent'] ?? '0'), $this->pct($i['discount_percent'] ?? '0'), $this->money($i['unit_sale'] ?? '0'), $this->money($i['cost'] ?? '0'), $this->money($i['sale'] ?? '0')]);
            }
        }
    }

    private function chronogram(array $d): void
    {
        $sheet = $this->newSheet('Cronograma');
        foreach ([9, 50, 11, 12, 12, 11, 18, 12] as $i => $w) {
            $sheet->setColumnWidth((float) $w, $i + 1);
        }
        $this->row(array_map(fn ($h) => $this->text($h, $this->style(bold: true, color: Color::WHITE, bg: self::SAPPHIRE)),
            ['ID', 'Atividade', 'Tipo', 'Início', 'Término', 'Duração', 'Predecessoras', '% executado']), 22);
        $type = ['summary' => 'Etapa', 'task' => 'Atividade', 'milestone' => 'Marco'];
        foreach ($d['rows'] as $r) {
            $group = $r['type'] === 'summary';
            $st = $this->style(bold: $group, bg: $group ? self::SOFT : null);
            $this->row([$this->text($r['wbs'], $st), $this->text(str_repeat('   ', $r['level']).$r['name'], $st), $this->text($type[$r['type']] ?? $r['type'], $st),
                $this->text($r['start'], $st), $this->text($r['end'], $st), $this->num((string) $r['duration'], '0'), $this->text($r['predecessors'], $st), $this->pct($r['percent'])]);
        }
    }

    // ------------------------------------------------------------------ apoio

    private function newSheet(string $name): Sheet
    {
        $sheet = $this->writer->addNewSheetAndMakeItCurrent();
        $sheet->setName($name);

        return $sheet;
    }

    /** @param list<Cell> $cells */
    private function row(array $cells, ?float $height = null): void
    {
        $row = new Row($cells);
        $this->writer->addRow($height !== null ? $row->withHeight($height) : $row);
    }

    private function text(string $v, ?Style $style = null): Cell
    {
        return Cell::fromValue($v, $style ?? $this->style());
    }

    private function money(string $v, ?Style $style = null): Cell
    {
        return Cell::fromValue((float) $v, $style ?? $this->style(format: self::MONEY));
    }

    private function pct(string $v, ?Style $style = null): Cell
    {
        return Cell::fromValue((float) $v, $style ?? $this->style(format: self::PCT));
    }

    private function num(string $v, string $format, ?Style $style = null): Cell
    {
        return Cell::fromValue((float) $v, $style ?? $this->style(format: $format));
    }

    private function pctText(string $v): string
    {
        return number_format((float) $v, 2, ',', '.').'%';
    }

    private function style(bool $bold = false, bool $italic = false, int $size = 10, string $color = self::GRAPHITE, ?string $bg = null, ?string $format = null, bool $wrap = false): Style
    {
        return new Style(
            fontBold: $bold,
            fontItalic: $italic,
            fontSize: $size,
            fontColor: $color,
            fontName: 'Calibri',
            cellAlignment: null,
            cellVerticalAlignment: $wrap ? CellVerticalAlignment::CENTER : null,
            shouldWrapText: $wrap ?: null,
            border: new Border(new BorderPart(BorderName::BOTTOM, 'E5E7EB')),
            backgroundColor: $bg,
            format: $format,
        );
    }
}
