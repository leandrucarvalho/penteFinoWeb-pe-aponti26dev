# Design: contadores de alunos parcialmente/completamente feitos

Issue: [#30](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/30)

## Contexto

`components/AuditResultTable.tsx` já calcula, por aluno, `totalFeitos` e `totalAusencias`
(via `calcularAusencias`/`calcularPresencas` em `lib/pente-fino.ts:203-239`). Hoje isso só
aparece como **porcentagem**, um card por vez dependendo da aba ativa ("Não feitos"/"Feitos"):
"Cumprimento" (linhas ~199-207, ~219-238) ou "Engajamento" (linhas ~209-217), alternando via
`isNF`. Não há contadores absolutos simultâneos, e a métrica de "completamente feitos"
(`semAusencias`/`taxa`) já existe mas só é exposta como %, nunca como número junto com a %.

## Objetivo

Exibir sempre (independente da aba selecionada) três indicadores, cada um com número absoluto
e porcentagem juntos:

1. **Total de alunos** — já existe (`total`, linha 175), inalterado.
2. **Parcialmente feitos**: alunos que fizeram pelo menos 1 relatório mas não todos —
   `totalFeitos > 0 && totalAusencias > 0`. Novo.
3. **Completamente feitos**: alunos que fizeram todos os relatórios — já computado como
   `semAusencias`/`taxa`, mas hoje só exposto como %; passa a mostrar também o número absoluto.

## Lógica de cálculo

Dentro do bloco "Stats always from full unfiltered data" (`AuditResultTable.tsx:174-184`),
que já roda sobre os arrays completos `naoFeitos`/`feitos` recebidos como props (não os
filtrados/paginados) — nenhuma mudança em `lib/gerar-auditoria.ts` ou no formato de
`resultado_json` é necessária:

```ts
const total = naoFeitos.length
const comAusencias = naoFeitos.filter((r) => r.totalAusencias > 0).length
const semAusencias = total - comAusencias
const taxaCompleto = total > 0 ? Math.round((semAusencias / total) * 100) : 0

const parcial = naoFeitos.filter(
  (r) => r.totalAusencias > 0 && (feitosPorNome.get(r.nomeCompleto) ?? 0) > 0
).length
const taxaParcial = total > 0 ? Math.round((parcial / total) * 100) : 0
```

`feitosPorNome` (`Map<nomeCompleto, totalFeitos>`) já existe na linha 129, construído a partir
de `feitos`, e já está disponível antes desse bloco — não precisa ser movido. É o mesmo mapa já
usado para o cálculo de `semEnvio` no corpo da tabela (linha ~384), então casar por
`nomeCompleto` já é um padrão estabelecido no arquivo, não uma decisão nova.

`comAusencias`, `taxaFeitos`, `metricaAtiva` e `isBom` — usados apenas pela lógica antiga
dependente de `isNF` — são removidos, já que os 3 novos cards não alternam mais por aba.

## Os 3 cards

Substituem o bloco condicional atual (`linhas 189-239`, o `grid-cols-3` com o card fixo
"Total" + os dois cards alternados por `isNF`). O grid continua com 3 colunas, mas agora os
3 cards são sempre os mesmos, independente da aba selecionada:

```tsx
<div className="grid grid-cols-3 gap-3">
  <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
    <div className="flex items-center justify-center gap-1.5 mb-1.5">
      <Users className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Total</span>
    </div>
    <div className="text-2xl font-bold tabular-nums">{total}</div>
    <div className="text-xs text-muted-foreground mt-0.5">alunos</div>
  </div>

  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
    <div className="flex items-center justify-center gap-1.5 mb-1.5">
      <Clock className="w-3.5 h-3.5 text-amber-600" />
      <span className="text-xs font-medium text-amber-700">Parcialmente feitos</span>
    </div>
    <div className="text-2xl font-bold tabular-nums text-amber-700">{parcial}</div>
    <div className="text-xs text-muted-foreground mt-0.5">{taxaParcial}% dos alunos</div>
  </div>

  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
    <div className="flex items-center justify-center gap-1.5 mb-1.5">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
      <span className="text-xs font-medium text-green-700">Completamente feitos</span>
    </div>
    <div className="text-2xl font-bold tabular-nums text-green-700">{semAusencias}</div>
    <div className="text-xs text-muted-foreground mt-0.5">{taxaCompleto}% dos alunos</div>
  </div>
</div>
```

Decisões de design (validadas com o usuário):

- **Número grande, porcentagem como legenda** — mesmo estilo do card "Total" já existente,
  mantém os 3 cards visualmente consistentes entre si. Rejeitado: porcentagem grande com
  número como legenda (estilo antigo dos cards "Cumprimento"/"Engajamento"); número e % juntos
  numa linha só (foge do padrão visual atual).
- **Cores fixas, sem threshold condicional** — "Completamente feitos" é sempre verde (é sempre
  positivo, não faz sentido ficar âmbar); "Parcialmente feitos" é sempre âmbar (estado
  intermediário, nem bom nem ruim). Isso remove o `isBom`/threshold de 80% que existia no card
  antigo — não é mais necessário já que a cor não é mais condicional.
- **Ícone `Clock`** (lucide-react, já disponível na lib) para "Parcialmente feitos" — sinaliza
  "em andamento"/"incompleto", distinto do `AlertTriangle` (removido) e do `CheckCircle2`
  (mantido, reaproveitado para "Completamente feitos").

`Clock` precisa ser adicionado à lista de imports de `lucide-react` no topo do arquivo;
`AlertTriangle` sai da lista (só era usado no card "Pendências", removido).

## Fora de escopo

- **Card/indicador para "não fizeram nada"** (`totalFeitos === 0`) — a issue pede exatamente 3
  indicadores (Total, Parcial, Completo); esse grupo fica implícito como o restante
  (`total - parcial - semAusencias`), sem card próprio.
- **Badge de contagem na aba "Não feitos"** (`comAusencias`, linha ~247-250) — continua
  existindo e inalterado; é uma informação diferente (contagem de alunos com qualquer
  ausência, incluindo os que não fizeram nada), não faz parte do escopo desta issue.
- **Mudança em `lib/gerar-auditoria.ts` ou no formato de `resultado_json`** — os cálculos
  usam só os arrays `naoFeitos`/`feitos` já recebidos como props.
