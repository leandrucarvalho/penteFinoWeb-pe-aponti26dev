# Design: filtro de UF como dropdown multi-seleção

Issue: [#31](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/31)

## Contexto

O filtro de UF em `components/AuditResultTable.tsx` é hoje um `<Input>` de texto livre
com correspondência por substring (linha 107), sem validação contra UFs válidas.

## Objetivo

Substituir o filtro de texto de UF por um multi-seleção.

## Revisão: `Select` → `Combobox` com chips

A primeira versão desta spec usava `components/ui/select.tsx` (`Select multiple`),
que já existia no projeto e suporta múltipla seleção nativamente via Base UI. Depois
de implementado e revisado, o usuário achou o resultado visual insatisfatório (resumo
truncado tipo "PE, SP +2" no trigger). Foi trocado por `components/ui/combobox.tsx`
(instalado via `npx shadcn@latest add combobox`, também baseado em
`@base-ui/react/combobox`, que suporta `multiple` do mesmo jeito que o `Select`), no
padrão "chips": cada UF selecionada aparece como uma chip removível dentro do próprio
campo, sem truncamento nem resumo textual — ver seção 3 abaixo (versão atual).
`formatarResumoUfs` (usado só para formatar o resumo truncado do `Select`) foi
removido por ficar sem uso.

## 1. Fonte de dados das opções

As opções vêm dos UFs realmente presentes nos alunos daquela auditoria — não a lista
estática de 27 UFs (`UF_POR_NOME_ESTADO`/`UFS_VALIDAS` em `lib/pente-fino.ts:31-61`).

Derivadas da união de `naoFeitos` + `feitos` (ambos calculados sobre a mesma lista de
alunos, mesmos `estado`s — a união é só uma garantia extra contra divergência), não da
aba ativa (`modo`), para que as opções não mudem ao trocar de aba:

```ts
const ufsDisponiveis = useMemo(() => {
  const set = new Set<string>()
  for (const r of [...naoFeitos, ...feitos]) if (r.estado) set.add(r.estado)
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}, [naoFeitos, feitos])
```

Estados vazios (`''`) são excluídos das opções — alunos sem UF (hoje exibidos como
"sem envio"/"—") não têm opção própria no dropdown; só aparecem no resultado quando
nenhuma UF está selecionada.

## 2. Estado do filtro e lógica de matching

`filters.uf: string` (substring) vira `filters.ufs: string[]` (igualdade exata):

```ts
const [filters, setFilters] = useState({ nome: '', ufs: [] as string[], empresa: '' })

function handleUfsChange(ufs: string[]) {
  setFilters((prev) => ({ ...prev, ufs }))
  setPage(1)
}

function clearFilters() {
  setFilters({ nome: '', ufs: [], empresa: '' })
  setPage(1)
}

const hasFilters = filters.nome || filters.ufs.length > 0 || filters.empresa
```

Predicado de filtro (linhas 100-110): a condição de UF passa a ser
`(filters.ufs.length === 0 || filters.ufs.includes(row.estado))` — sem
`toLowerCase()`/`includes` de substring, já que `estado` já é normalizado (ver
`normalizarUF` em `lib/pente-fino.ts`) e as opções vêm diretamente dos valores
presentes nos dados.

## 3. Componente `Combobox` multi-seleção com chips (versão atual)

Usa `components/ui/combobox.tsx` (instalado via shadcn CLI, base
`@base-ui/react/combobox`, que suporta `multiple` da mesma forma que o `Select`:
`value`/`onValueChange` tipados como array). Segue o padrão oficial de exemplo do
shadcn para combobox multi-seleção com chips:

```tsx
const ufsAnchor = useComboboxAnchor()

<Combobox multiple items={ufsDisponiveis} value={filters.ufs} onValueChange={handleUfsChange}>
  <ComboboxChips ref={ufsAnchor} className="min-w-28 text-sm">
    <ComboboxValue>
      {(values: string[]) => (
        <>
          {values.map((uf) => (
            <ComboboxChip key={uf}>{uf}</ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder="UF..." />
        </>
      )}
    </ComboboxValue>
  </ComboboxChips>
  <ComboboxContent anchor={ufsAnchor}>
    <ComboboxEmpty>Nenhuma UF encontrada.</ComboboxEmpty>
    <ComboboxList>
      {(uf: string) => (
        <ComboboxItem key={uf} value={uf}>
          {uf}
        </ComboboxItem>
      )}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

- Cada UF selecionada vira uma chip removível (`ComboboxChip`) dentro do próprio
  campo — sem truncamento, sem resumo textual, sem componente/helper de formatação
  (`formatarResumoUfs` foi removido; `derivarUfsDisponiveis` continua sendo usado,
  agora como o `items` do `Combobox`).
- O campo também funciona como busca: digitar filtra a lista de UFs no popup
  (comportamento nativo do Base UI Combobox).
- `useComboboxAnchor()` cria a ref que ancora o popup (`ComboboxContent`) ao container
  das chips (`ComboboxChips`), conforme o padrão de composição do Base UI Combobox.

## 4. Casos de borda

- Nenhuma UF presente nos dados (todas vazias) → dropdown sem itens, mas renderiza
  normalmente (sem crash).
- Trocar de aba (Não feitos ↔ Feitos) não reseta `filters.ufs` nem muda as opções
  disponíveis (união fixa, independente de `modo`).
- `clearFilters` zera `ufs` junto com `nome`/`empresa`, como já fazia antes.

## Fora de escopo

- Não altera `lib/pente-fino.ts` (a exportação de `UF_POR_NOME_ESTADO`/`UFS_VALIDAS`
  mencionada na issue como "sugestão" não é necessária — as opções vêm dos dados da
  auditoria, não da lista estática de UFs válidas do Brasil).
- Não adiciona opção "Sem UF" no dropdown (decisão do usuário: alunos sem UF só
  aparecem quando o filtro está limpo).
- Não adiciona ações de "selecionar todos"/"limpar" dentro do popup do dropdown — o
  botão "Limpar" já existente na barra de filtros cobre isso.
