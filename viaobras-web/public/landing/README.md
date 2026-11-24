# Screenshots da landing (viaobras.com.br)

A landing usa **capturas reais** da plataforma. Coloque os arquivos nesta pasta, com exatamente estes nomes
(os caminhos ficam definidos em `src/landing/content.ts`, constante `SHOTS`):

| Arquivo             | Tela                      | Onde aparece                                                        |
| ------------------- | ------------------------- | ------------------------------------------------------------------- |
| `visao-geral.png`   | Visão geral (dashboard)   | Hero, seção "Visão geral" e seção "Controle financeiro" (recorte)   |
| `obras.png`         | Listagem de Obras         | Seção "Gestão de obras"                                             |
| `orcamentos.png`    | Orçamento                 | Seção "Orçamentos"                                                  |
| `suprimentos.png`   | Suprimentos (solicitações)| Seção "Suprimentos"                                                 |

Enquanto um arquivo não existir, a landing mostra um espaço reservado neutro no lugar — nunca uma imagem genérica
nem dados inventados.

## Como gerar as capturas

- Largura de janela de **1440 px** (ou maior), tema padrão, sem extensões do navegador visíveis (a moldura de navegador
  já é desenhada pela landing — capture **só a área do app**, sem a barra de endereços).
- Use um tenant de demonstração; **nenhum dado de cliente real** pode aparecer.
- Formato PNG (ou troque a extensão em `SHOTS`). Prefira ≤ 400 KB por arquivo (a landing carrega as imagens com `lazy`,
  exceto a do Hero).

## Proporção e recortes

As imagens nunca são distorcidas: cada quadro usa `object-fit: cover` com uma proporção fixa.

| Seção            | Proporção | Âncora do recorte      |
| ---------------- | --------- | ---------------------- |
| Hero             | 16 / 10   | topo à esquerda        |
| Visão geral      | 16 / 9    | topo                   |
| Obras            | 4 / 3     | topo à esquerda        |
| Orçamentos       | 16 / 9    | topo                   |
| Suprimentos      | 16 / 10   | topo                   |
| Indicadores      | 4 / 3     | `50% 78%` com zoom 1,35|

O recorte de **Indicadores** é a mesma captura da Visão geral, apenas enquadrada na área de gráficos. Depois de colocar
a captura final, ajuste a constante `CROP` em `src/landing/components/FinancialSection.tsx` para enquadrar melhor.

> Não use as imagens de `documentation/telas`: são referências de design de outro produto (Brickup), não telas da ViaObras.
