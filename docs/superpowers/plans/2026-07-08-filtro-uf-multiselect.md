# Filtro de UF multi-seleção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o filtro de texto livre de UF em `AuditResultTable` por um dropdown de múltipla seleção, cujas opções são os UFs realmente presentes na auditoria.

**Architecture:** Duas funções puras (`derivarUfsDisponiveis`, `formatarResumoUfs`) extraídas para um módulo testável com Vitest; o componente `AuditResultTable` passa a manter `filters.ufs: string[]` em vez de `filters.uf: string`, e a UI troca o `<Input>` de UF por `<Select multiple>` (Base UI, já suportado nativamente por `components/ui/select.tsx` sem alterações nesse arquivo).

**Tech Stack:** Next.js 16 / React 19 / TypeScript, `@base-ui/react/select` (via `components/ui/select.tsx`), Vitest.

Spec: `docs/superpowers/specs/2026-07-08-filtro-uf-multiselect-design.md`

---

### Task 1: Funções puras de derivação e formatação de UFs

**Files:**
- Create: `components/audit-result-table-utils.ts`
- Test: `components/audit-result-table-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `components/audit-result-table-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { derivarUfsDisponiveis, formatarResumoUfs } from './audit-result-table-utils'

describe('derivarUfsDisponiveis', () => {
  it('retorna vazio quando as duas listas estão vazias', () => {
    expect(derivarUfsDisponiveis([], [])).toEqual([])
  })

  it('exclui estados vazios', () => {
    const naoFeitos = [{ estado: '' }, { estado: 'PE' }]
    const feitos = [{ estado: '' }]
    expect(derivarUfsDisponiveis(naoFeitos, feitos)).toEqual(['PE'])
  })

  it('deduplica UFs repetidos entre as duas listas', () => {
    const naoFeitos = [{ estado: 'PE' }, { estado: 'SP' }]
    const feitos = [{ estado: 'SP' }, { estado: 'PE' }]
    expect(derivarUfsDisponiveis(naoFeitos, feitos)).toEqual(['PE', 'SP'])
  })

  it('ordena alfabeticamente (pt-BR)', () => {
    const naoFeitos = [{ estado: 'SP' }, { estado: 'AC' }, { estado: 'PE' }]
    expect(derivarUfsDisponiveis(naoFeitos, [])).toEqual(['AC', 'PE', 'SP'])
  })
})

describe('formatarResumoUfs', () => {
  it('retorna "UF" quando nenhuma UF está selecionada', () => {
    expect(formatarResumoUfs([])).toBe('UF')
  })

  it('retorna a sigla quando 1 UF está selecionada', () => {
    expect(formatarResumoUfs(['PE'])).toBe('PE')
  })

  it('junta as duas siglas quando 2 UFs estão selecionadas', () => {
    expect(formatarResumoUfs(['PE', 'SP'])).toBe('PE, SP')
  })

  it('mostra as duas primeiras + contagem do restante quando 3+ UFs estão selecionadas', () => {
    expect(formatarResumoUfs(['AC', 'AL', 'AM', 'AP'])).toBe('AC, AL +2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/audit-result-table-utils.test.ts`
Expected: FAIL — `Failed to resolve import "./audit-result-table-utils"` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `components/audit-result-table-utils.ts`:

```ts
type ComEstado = { estado: string }

export function derivarUfsDisponiveis(
  naoFeitos: ComEstado[],
  feitos: ComEstado[]
): string[] {
  const set = new Set<string>()
  for (const row of naoFeitos) if (row.estado) set.add(row.estado)
  for (const row of feitos) if (row.estado) set.add(row.estado)
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function formatarResumoUfs(ufs: string[]): string {
  if (ufs.length === 0) return 'UF'
  if (ufs.length <= 2) return ufs.join(', ')
  return `${ufs.slice(0, 2).join(', ')} +${ufs.length - 2}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/audit-result-table-utils.test.ts`
Expected: PASS — 8 tests passed.

- [ ] **Step 5: Commit**

```bash
git add components/audit-result-table-utils.ts components/audit-result-table-utils.test.ts
git commit -m "feat: adicionar funcoes puras para filtro de UF multi-selecao"
```

---

### Task 2: Estado e lógica de filtro em `AuditResultTable`

**Files:**
- Modify: `components/AuditResultTable.tsx:1-3` (imports)
- Modify: `components/AuditResultTable.tsx:68` (state)
- Modify: `components/AuditResultTable.tsx:86-94` (handlers)
- Modify: `components/AuditResultTable.tsx:96` (hasFilters)
- Modify: `components/AuditResultTable.tsx:100-110` (filter predicate)

Não há testes automatizados de componente neste projeto (sem `@testing-library/react` instalado — só Vitest com funções puras). A verificação desta task é `tsc`/`build` (Task 4) mais a Task 3, que completa a UI.

- [ ] **Step 1: Atualizar imports**

No topo de `components/AuditResultTable.tsx`, troque:

```ts
import { useState } from 'react'
```

por:

```ts
import { useState, useMemo } from 'react'
```

E adicione, logo abaixo do import de `Input` (linha 15):

```ts
import { derivarUfsDisponiveis, formatarResumoUfs } from './audit-result-table-utils'
```

- [ ] **Step 2: Trocar o estado de `filters.uf` por `filters.ufs`**

Troque (linha 68):

```ts
  const [filters, setFilters] = useState({ nome: '', uf: '', empresa: '' })
```

por:

```ts
  const [filters, setFilters] = useState({ nome: '', ufs: [] as string[], empresa: '' })
```

- [ ] **Step 3: Adicionar `ufsDisponiveis` derivado**

Logo abaixo da linha do `useState` de `filters` (após o Step 2), adicione:

```ts
  const ufsDisponiveis = useMemo(
    () => derivarUfsDisponiveis(naoFeitos, feitos),
    [naoFeitos, feitos]
  )
```

- [ ] **Step 4: Ajustar `handleFilter` (só nome/empresa) e adicionar `handleUfsChange`**

Troque (linhas 86-89):

```ts
  function handleFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }
```

por:

```ts
  function handleFilter(key: 'nome' | 'empresa', value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  function handleUfsChange(ufs: string[]) {
    setFilters((prev) => ({ ...prev, ufs }))
    setPage(1)
  }
```

- [ ] **Step 5: Atualizar `clearFilters`**

Troque (linhas 91-94):

```ts
  function clearFilters() {
    setFilters({ nome: '', uf: '', empresa: '' })
    setPage(1)
  }
```

por:

```ts
  function clearFilters() {
    setFilters({ nome: '', ufs: [], empresa: '' })
    setPage(1)
  }
```

- [ ] **Step 6: Atualizar `hasFilters`**

Troque (linha 96):

```ts
  const hasFilters = filters.nome || filters.uf || filters.empresa
```

por:

```ts
  const hasFilters = filters.nome || filters.ufs.length > 0 || filters.empresa
```

- [ ] **Step 7: Atualizar o predicado de filtro**

Troque (linhas 100-110):

```ts
  const filtered = base.filter((row) => {
    const n = filters.nome.toLowerCase()
    const u = filters.uf.toLowerCase()
    const e = filters.empresa.toLowerCase()
    return (
      (!n || row.nomeCompleto.toLowerCase().includes(n)) &&
      (!u || row.estado.toLowerCase().includes(u)) &&
      (!e || row.empresa.toLowerCase().includes(e))
    )
  })
```

por:

```ts
  const filtered = base.filter((row) => {
    const n = filters.nome.toLowerCase()
    const e = filters.empresa.toLowerCase()
    return (
      (!n || row.nomeCompleto.toLowerCase().includes(n)) &&
      (filters.ufs.length === 0 || filters.ufs.includes(row.estado)) &&
      (!e || row.empresa.toLowerCase().includes(e))
    )
  })
```

- [ ] **Step 8: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: uma nova falha esperada — `components/AuditResultTable.tsx` linha do JSX que ainda referencia `filters.uf`/`handleFilter('uf', ...)` (Task 3 corrige isso). Se o único erro reportado for nessa linha do JSX antigo, está correto até aqui; qualquer outro erro precisa ser investigado antes de prosseguir.

- [ ] **Step 9: Commit**

```bash
git add components/AuditResultTable.tsx
git commit -m "feat: migrar estado de filtro de UF para selecao multipla (string[])"
```

---

### Task 3: Substituir o `<Input>` de UF pelo `<Select multiple>`

**Files:**
- Modify: `components/AuditResultTable.tsx:1-16` (imports)
- Modify: `components/AuditResultTable.tsx:243-248` (JSX do filtro de UF)

- [ ] **Step 1: Importar os componentes de `Select`**

Logo abaixo do import de `Input` (linha 15, ou do novo import de `audit-result-table-utils` se já adicionado na Task 2), adicione:

```ts
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
```

- [ ] **Step 2: Substituir o Input de UF pelo Select multi-seleção**

Troque (linhas 243-248):

```tsx
        <Input
          placeholder="UF"
          value={filters.uf}
          onChange={(e) => handleFilter('uf', e.target.value)}
          className="h-8 w-20 text-sm"
        />
```

por:

```tsx
        <Select multiple value={filters.ufs} onValueChange={handleUfsChange}>
          <SelectTrigger className="min-w-20">
            <SelectValue>
              {(value: string[]) =>
                formatarResumoUfs([...value].sort((a, b) => a.localeCompare(b, 'pt-BR')))
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ufsDisponiveis.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
```

- [ ] **Step 3: Verificar que o TypeScript compila sem erros**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm run test`
Expected: todos os testes passam (os pré-existentes + os 8 novos da Task 1).

- [ ] **Step 5: Rodar o build de produção**

Run: `npm run build`
Expected: build concluído sem erros, todas as rotas compiladas normalmente.

- [ ] **Step 6: Commit**

```bash
git add components/AuditResultTable.tsx
git commit -m "feat: trocar filtro de UF de texto livre para dropdown multi-selecao"
```

---

### Task 4: Verificação manual e fechamento

**Files:** nenhum (checklist de verificação).

- [ ] **Step 1: Checklist de verificação manual no navegador**

Esta etapa não pode ser executada por um agente sem acesso a navegador — deixar explícito para quem revisar a PR:

- Abrir uma auditoria com alunos de pelo menos 3 UFs diferentes.
- Confirmar que o dropdown de UF lista exatamente as UFs presentes nos alunos daquela auditoria (não as 27 UFs do Brasil).
- Selecionar 1 UF → tabela filtra corretamente; trigger mostra a sigla.
- Selecionar 2 UFs → trigger mostra "XX, YY"; tabela mostra alunos de qualquer uma das duas.
- Selecionar 3+ UFs → trigger mostra "XX, YY +N".
- Clicar "Limpar" → UFs selecionadas são desmarcadas, trigger volta a mostrar "UF".
- Trocar de aba (Não feitos ↔ Feitos) com UFs selecionadas → seleção e opções do dropdown permanecem as mesmas.
- Alunos com UF vazia (exibidos como "sem envio"/"—") não aparecem no dropdown como opção, e somem da tabela quando qualquer UF é selecionada (só aparecem com o filtro de UF limpo).

- [ ] **Step 2: Push da branch**

Run: `git push origin feat/filtro-uf-multiselect`

- [ ] **Step 3: Abrir PR fechando a issue #31**

```bash
gh pr create --title "feat: trocar filtro de UF de texto para dropdown multi-selecao" --body "$(cat <<'EOF'
## Summary
- Substitui o filtro de UF (texto livre, substring) por um dropdown de multipla selecao
- Opcoes derivadas dinamicamente dos UFs presentes nos alunos da auditoria (uniao de naoFeitos+feitos), nao a lista estatica de 27 UFs
- Reaproveita components/ui/select.tsx (Base UI ja suporta `multiple` nativamente) - nenhum componente novo

Closes #31

## Test plan
- [x] npx tsc --noEmit
- [x] npm run test
- [x] npm run build
- [ ] Verificacao manual no navegador (checklist na Task 4 do plano)
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Seção 1 (fonte de dados) → Task 1 (`derivarUfsDisponiveis`) + Task 2 Step 3. Seção 2 (estado/matching) → Task 2. Seção 3 (componente Select) → Task 3. Seção 4 (casos de borda) → cobertos pelos testes da Task 1 (lista vazia, dedupe, exclusão de vazio) e pelo checklist manual da Task 4 (troca de aba, clearFilters). Nenhuma lacuna encontrada.
- **Placeholder scan:** nenhum "TBD"/"similar to Task N" — todo código está completo em cada step.
- **Type consistency:** `filters.ufs: string[]` (Task 2 Step 2) usado consistentemente em `handleUfsChange` (Step 4), `clearFilters` (Step 5), `hasFilters` (Step 6), predicado de filtro (Step 7) e no JSX (Task 3 Step 2). `derivarUfsDisponiveis`/`formatarResumoUfs` (Task 1) importados e usados com as mesmas assinaturas em Task 2/3.

## Revisão pós-implementação: `Select` → `Combobox` com chips

Depois que a Task 3 (Select multi-seleção) passou pelas duas revisões e foi
aprovada, o usuário viu o resultado e não gostou do visual do dropdown (resumo
truncado tipo "PE, SP +2" no trigger). A Task 3 foi refeita usando
`components/ui/combobox.tsx` (instalado via `npx shadcn@latest add combobox`) no
padrão oficial de multi-seleção com chips (`Combobox multiple` +
`ComboboxChips`/`ComboboxChip`/`ComboboxChipsInput` ancorados a `ComboboxContent`
via `useComboboxAnchor()`), removendo o `Select`/`SelectTrigger`/`SelectContent`/
`SelectItem`/`SelectValue` da Task 3 original. `formatarResumoUfs` (Task 1) ficou sem
uso com o novo padrão de chips (que não trunca, mostra cada UF selecionada
individualmente) e foi removido de `audit-result-table-utils.ts`/`.test.ts` junto com
seus 4 testes — `derivarUfsDisponiveis` continua igual, agora alimentando o `items`
do `Combobox` em vez do `.map` manual de `SelectItem`s. Ver a seção "Revisão" na spec
(`docs/superpowers/specs/2026-07-08-filtro-uf-multiselect-design.md`) para o detalhe
completo. `tsc --noEmit`, `npm run test` (30/30) e `npm run build` todos limpos após a
troca.
