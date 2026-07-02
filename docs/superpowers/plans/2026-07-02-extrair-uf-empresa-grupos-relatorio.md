# Extrair UF/empresa da coluna "Grupos" dos relatórios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the "planilha geral" (master roster) doesn't have a student's UF/empresa, extract it from the `Grupos` column of the weekly relatório CSVs instead, without ever overwriting data that already came from the planilha geral.

**Architecture:** Four new pure functions in `lib/pente-fino.ts` (`normalizarUF`, updated `parsearGrupos`, `extrairGruposRelatorio`, `aplicarFallbackGrupos`) plus wiring in `lib/gerar-auditoria.ts` that orders relatórios chronologically and folds each one's `Grupos` data into the student list before the existing `calcularAusencias`/`calcularPresencas` run unchanged.

**Tech Stack:** TypeScript, Vitest, PapaParse (CSV parsing already in use).

**Spec:** [docs/superpowers/specs/2026-07-02-extrair-uf-empresa-grupos-relatorio-design.md](../specs/2026-07-02-extrair-uf-empresa-grupos-relatorio-design.md)

---

### Task 1: `normalizarUF` — normalize state names/abbreviations to a 2-letter UF code

**Files:**
- Modify: `lib/pente-fino.ts`
- Test: `lib/pente-fino.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `lib/pente-fino.test.ts`, right after the `import` line (add `normalizarUF` to the import list — see Step 1a):

```ts
describe('normalizarUF', () => {
  it('converte nome completo do estado (com acento) para sigla', () => {
    expect(normalizarUF('Maranhão')).toBe('MA')
  })

  it('mantém sigla já válida inalterada', () => {
    expect(normalizarUF('PE')).toBe('PE')
  })

  it('converte sigla em minúsculo para maiúsculo', () => {
    expect(normalizarUF('pe')).toBe('PE')
  })

  it('mantém valor desconhecido sem alteração', () => {
    expect(normalizarUF('Nao Existe')).toBe('Nao Existe')
  })

  it('retorna string vazia para entrada vazia', () => {
    expect(normalizarUF('')).toBe('')
  })
})
```

**Step 1a:** update the top of `lib/pente-fino.test.ts` — change:

```ts
import {
  normalizarNome,
  parsearGrupos,
  carregarAlunos,
  carregarRelatorio,
  calcularAusencias,
  calcularPresencas,
} from './pente-fino'
```

to:

```ts
import {
  normalizarNome,
  normalizarUF,
  parsearGrupos,
  carregarAlunos,
  carregarRelatorio,
  extrairGruposRelatorio,
  aplicarFallbackGrupos,
  calcularAusencias,
  calcularPresencas,
} from './pente-fino'
```

(`extrairGruposRelatorio` and `aplicarFallbackGrupos` aren't implemented yet — that's fine, TypeScript/Vitest will fail on the missing exports, which is the expected failure for this step.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `normalizarUF is not a function` (or a module resolution / TS error citing the missing exports `extrairGruposRelatorio`/`aplicarFallbackGrupos`, since they're imported but don't exist yet).

- [ ] **Step 3: Implement `normalizarUF`**

Add to `lib/pente-fino.ts`, right after the `normalizarNome` function (before `parsearGrupos`):

```ts
const UF_POR_NOME_ESTADO: Record<string, string> = {
  'acre': 'AC',
  'alagoas': 'AL',
  'amapa': 'AP',
  'amazonas': 'AM',
  'bahia': 'BA',
  'ceara': 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  'goias': 'GO',
  'maranhao': 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  'para': 'PA',
  'paraiba': 'PB',
  'parana': 'PR',
  'pernambuco': 'PE',
  'piaui': 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  'rondonia': 'RO',
  'roraima': 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  'sergipe': 'SE',
  'tocantins': 'TO',
}

const UFS_VALIDAS = new Set(Object.values(UF_POR_NOME_ESTADO))

const MAPA_ACENTOS: Record<string, string> = {
  'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
  'é': 'e', 'ê': 'e',
  'í': 'i',
  'ó': 'o', 'õ': 'o', 'ô': 'o',
  'ú': 'u',
  'ç': 'c',
}

function removerAcentos(valor: string): string {
  return valor
    .split('')
    .map((c) => MAPA_ACENTOS[c] ?? c)
    .join('')
}

export function normalizarUF(valor: string): string {
  const limpo = valor.trim()
  if (!limpo) return ''
  const maiusculo = limpo.toUpperCase()
  if (maiusculo.length === 2 && UFS_VALIDAS.has(maiusculo)) return maiusculo
  const chave = removerAcentos(limpo).toLowerCase()
  return UF_POR_NOME_ESTADO[chave] ?? limpo
}
```

- [ ] **Step 4: Run tests to verify the `normalizarUF` tests pass**

Run: `npm run test`
Expected: the 5 `normalizarUF` tests PASS. The suite will still fail overall because `extrairGruposRelatorio`/`aplicarFallbackGrupos` don't exist yet — that's expected, continue to Task 3 before it fully passes.

- [ ] **Step 5: Commit**

```bash
git add lib/pente-fino.ts lib/pente-fino.test.ts
git commit -m "feat: adicionar normalizarUF para converter nome de estado em sigla"
```

---

### Task 2: Apply `normalizarUF` inside `parsearGrupos`

**Files:**
- Modify: `lib/pente-fino.ts:32-48` (the `parsearGrupos` function)
- Test: `lib/pente-fino.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe('parsearGrupos', ...)` block in `lib/pente-fino.test.ts` (after the existing 3 `it` blocks, before the closing `})`):

```ts
  it('normaliza nome completo do estado para sigla', () => {
    const [estado, empresa] = parsearGrupos('Maranhão: Hermes - 42.441.933/0001-64')
    expect(estado).toBe('MA')
    expect(empresa).toBe('Hermes')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- -t "normaliza nome completo do estado"`
Expected: FAIL — `estado` is `'Maranhão'`, not `'MA'` (since `parsearGrupos` doesn't call `normalizarUF` yet).

- [ ] **Step 3: Update `parsearGrupos` to normalize the extracted state**

In `lib/pente-fino.ts`, replace the current `parsearGrupos` function:

```ts
// Analisa "UF:Empresa - CNPJ" ou "UF | Empresa" → [estado, empresa]
export function parsearGrupos(valor: string): [string, string] {
  const colonIdx = valor.indexOf(':')
  if (colonIdx !== -1) {
    const estado = valor.slice(0, colonIdx).trim()
    const resto = valor.slice(colonIdx + 1)
    const dashIdx = resto.indexOf(' - ')
    const empresa = dashIdx !== -1 ? resto.slice(0, dashIdx).trim() : resto.trim()
    return [estado, empresa]
  }
  const pipeIdx = valor.indexOf('|')
  if (pipeIdx !== -1) {
    const estado = valor.slice(0, pipeIdx).trim()
    const empresa = valor.slice(pipeIdx + 1).trim()
    return [estado, empresa]
  }
  return ['', valor.trim()]
}
```

with:

```ts
// Analisa "UF:Empresa - CNPJ" ou "UF | Empresa" → [estado, empresa]
export function parsearGrupos(valor: string): [string, string] {
  const colonIdx = valor.indexOf(':')
  if (colonIdx !== -1) {
    const estado = valor.slice(0, colonIdx).trim()
    const resto = valor.slice(colonIdx + 1)
    const dashIdx = resto.indexOf(' - ')
    const empresa = dashIdx !== -1 ? resto.slice(0, dashIdx).trim() : resto.trim()
    return [normalizarUF(estado), empresa]
  }
  const pipeIdx = valor.indexOf('|')
  if (pipeIdx !== -1) {
    const estado = valor.slice(0, pipeIdx).trim()
    const empresa = valor.slice(pipeIdx + 1).trim()
    return [normalizarUF(estado), empresa]
  }
  return ['', valor.trim()]
}
```

(Only the two `return` statements inside the `if` blocks changed, wrapping `estado` in `normalizarUF(...)`. The final fallback `return ['', valor.trim()]` is unchanged since there's no state to normalize there.)

- [ ] **Step 4: Run tests to verify everything in the `parsearGrupos` and `normalizarUF` suites passes**

Run: `npm run test -- -t "parsearGrupos|normalizarUF"`
Expected: PASS — including the pre-existing `parsearGrupos('PE:Empresa X - 12345678/0001-99')` test (still returns `'PE'`, since `normalizarUF('PE')` returns `'PE'` unchanged).

- [ ] **Step 5: Commit**

```bash
git add lib/pente-fino.ts lib/pente-fino.test.ts
git commit -m "feat: normalizar estado extraido em parsearGrupos"
```

---

### Task 3: `extrairGruposRelatorio` — extract per-student `[estado, empresa]` from a relatório's `Grupos` column

**Files:**
- Modify: `lib/pente-fino.ts`
- Test: `lib/pente-fino.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `lib/pente-fino.test.ts`, near the top alongside the other CSV fixture constants (after `CSV_REL_SEM_COLUNA`):

```ts
// Relatório com coluna "Grupos" preenchida para um aluno, vazia para outro
const CSV_REL_COM_GRUPOS = `Nome completo,Grupos,Email
João Silva,Maranhão: Hermes - 42.441.933/0001-64,joao@x.com
Pedro Lima,,pedro@x.com`
```

Add a new `describe` block, after the `describe('carregarRelatorio', ...)` block:

```ts
describe('extrairGruposRelatorio', () => {
  it('extrai estado (normalizado) e empresa por nome normalizado', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS)
    expect(grupos.get('joão silva')).toEqual(['MA', 'Hermes'])
  })

  it('ignora aluno com célula de Grupos vazia', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS)
    expect(grupos.has('pedro lima')).toBe(false)
  })

  it('retorna Map vazio se não houver coluna Grupos', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_COLUNA)
    expect(grupos.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- -t "extrairGruposRelatorio"`
Expected: FAIL — `extrairGruposRelatorio is not a function`.

- [ ] **Step 3: Implement `extrairGruposRelatorio`**

Add to `lib/pente-fino.ts`, right after the `carregarRelatorio` function:

```ts
export function extrairGruposRelatorio(csvText: string): Map<string, [string, string]> {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const nomeKey = meta.fields?.find((f) => f === 'Nome completo')
  const gruposKey = meta.fields?.find((f) => f === 'Grupos')
  const grupos = new Map<string, [string, string]>()

  if (!nomeKey || !gruposKey) return grupos

  for (const row of data) {
    const nomeNormalizado = normalizarNome(row[nomeKey] ?? '')
    const valorGrupos = row[gruposKey]
    if (!nomeNormalizado || !valorGrupos) continue
    grupos.set(nomeNormalizado, parsearGrupos(valorGrupos))
  }

  return grupos
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- -t "extrairGruposRelatorio"`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pente-fino.ts lib/pente-fino.test.ts
git commit -m "feat: adicionar extrairGruposRelatorio para ler Grupos do relatorio semanal"
```

---

### Task 4: `aplicarFallbackGrupos` — fill only empty `estado`/`empresa` fields

**Files:**
- Modify: `lib/pente-fino.ts`
- Test: `lib/pente-fino.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `lib/pente-fino.test.ts`, after the `describe('extrairGruposRelatorio', ...)` block:

```ts
describe('aplicarFallbackGrupos', () => {
  it('preenche estado vazio a partir do fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A) // Formato A: estado sempre vazio
    const grupos = new Map<string, [string, string]>([['joão silva', ['MA', 'Hermes']]])
    const resultado = aplicarFallbackGrupos(alunos, grupos)

    const joao = resultado.find((a) => a.nomeNormalizado === 'joão silva')!
    expect(joao.estado).toBe('MA')
  })

  it('não sobrescreve estado já preenchido pela planilha geral', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_B) // já tem estado 'PE' para João
    const grupos = new Map<string, [string, string]>([['joão silva', ['MA', 'Outra Empresa']]])
    const resultado = aplicarFallbackGrupos(alunos, grupos)

    const joao = resultado.find((a) => a.nomeNormalizado === 'joão silva')!
    expect(joao.estado).toBe('PE')
  })

  it('ignora alunos sem correspondência no fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    const resultado = aplicarFallbackGrupos(alunos, new Map())
    expect(resultado).toEqual(alunos)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- -t "aplicarFallbackGrupos"`
Expected: FAIL — `aplicarFallbackGrupos is not a function`.

- [ ] **Step 3: Implement `aplicarFallbackGrupos`**

Add to `lib/pente-fino.ts`, right after `extrairGruposRelatorio`:

```ts
export function aplicarFallbackGrupos(
  alunos: Aluno[],
  grupos: Map<string, [string, string]>
): Aluno[] {
  return alunos.map((aluno) => {
    const fallback = grupos.get(aluno.nomeNormalizado)
    if (!fallback) return aluno
    const [estadoFallback, empresaFallback] = fallback
    return {
      ...aluno,
      estado: aluno.estado || estadoFallback,
      empresa: aluno.empresa || empresaFallback,
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- -t "aplicarFallbackGrupos"`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pente-fino.ts lib/pente-fino.test.ts
git commit -m "feat: adicionar aplicarFallbackGrupos para preencher estado/empresa vazios"
```

---

### Task 5: Integration test — end-to-end fallback scenario

**Files:**
- Test: `lib/pente-fino.test.ts`

- [ ] **Step 1: Write the integration test**

Add a new `describe` block at the end of `lib/pente-fino.test.ts`:

```ts
describe('integração: fallback de UF do relatório semanal', () => {
  it('aluno sem UF na planilha geral (Formato A) recebe UF/empresa extraídas do relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS)
    const enriquecidos = aplicarFallbackGrupos(alunos, grupos)

    const joao = enriquecidos.find((a) => a.nomeNormalizado === 'joão silva')!
    expect(joao.estado).toBe('MA')
    // empresa já vinha preenchida pela planilha geral (Empresa X) — não é sobrescrita
    expect(joao.empresa).toBe('Empresa X')

    const maria = enriquecidos.find((a) => a.nomeNormalizado === 'maria souza')!
    // Maria não aparece em nenhum relatório com Grupos preenchido — segue vazia
    expect(maria.estado).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test`
Expected: PASS — this test plus every test added in Tasks 1-4, plus the pre-existing suite, all green (should be around 24 total tests now).

- [ ] **Step 3: Commit**

```bash
git add lib/pente-fino.test.ts
git commit -m "test: adicionar teste de integracao do fallback de UF/empresa"
```

---

### Task 6: Wire the fallback into `gerar-auditoria.ts`

**Files:**
- Modify: `lib/gerar-auditoria.ts`

- [ ] **Step 1: Update the imports**

In `lib/gerar-auditoria.ts`, change:

```ts
import {
  carregarAlunos,
  carregarRelatorio,
  calcularAusencias,
  calcularPresencas,
  type ResultadoAusencia,
  type ResultadoPresenca,
} from './pente-fino'
```

to:

```ts
import {
  carregarAlunos,
  carregarRelatorio,
  extrairGruposRelatorio,
  aplicarFallbackGrupos,
  calcularAusencias,
  calcularPresencas,
  type ResultadoAusencia,
  type ResultadoPresenca,
} from './pente-fino'
```

- [ ] **Step 2: Order the relatórios query chronologically**

Find (in the "2. Buscar todos os relatórios ativos" section):

```ts
  const { data: relatorios } = await supabase
    .from('relatorios')
    .select('id, nome, storage_path')
    .is('deleted_at', null)
```

Replace with:

```ts
  const { data: relatorios } = await supabase
    .from('relatorios')
    .select('id, nome, storage_path')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
```

- [ ] **Step 3: Collect per-relatório `Grupos` data during the existing parsing loop**

Find (in the "3. Baixar e parsear cada CSV de relatório" section):

```ts
  // 3. Baixar e parsear cada CSV de relatório
  const relatoriosMap: Record<string, Set<string>> = {}
  const relatoriosIds: string[] = []

  for (const rel of relatorios) {
    const { data: relFile } = await supabase.storage
      .from('relatorios')
      .download(rel.storage_path)

    if (!relFile) {
      console.warn(`Relatório ${rel.nome}: falha ao baixar do Storage`)
      continue
    }

    const text = await relFile.text()
    const nomes = carregarRelatorio(text)

    if (nomes === null) {
      console.warn(`Relatório ${rel.nome}: coluna "Nome completo" ausente — ignorado`)
      continue
    }

    relatoriosMap[rel.nome] = nomes
    relatoriosIds.push(rel.id)
  }
```

Replace with:

```ts
  // 3. Baixar e parsear cada CSV de relatório
  const relatoriosMap: Record<string, Set<string>> = {}
  const relatoriosIds: string[] = []
  const gruposPorRelatorio: Map<string, [string, string]>[] = []

  for (const rel of relatorios) {
    const { data: relFile } = await supabase.storage
      .from('relatorios')
      .download(rel.storage_path)

    if (!relFile) {
      console.warn(`Relatório ${rel.nome}: falha ao baixar do Storage`)
      continue
    }

    const text = await relFile.text()
    const nomes = carregarRelatorio(text)

    if (nomes === null) {
      console.warn(`Relatório ${rel.nome}: coluna "Nome completo" ausente — ignorado`)
      continue
    }

    relatoriosMap[rel.nome] = nomes
    relatoriosIds.push(rel.id)
    gruposPorRelatorio.push(extrairGruposRelatorio(text))
  }
```

(`relatorios` is now ordered oldest-first from Step 2, so `gruposPorRelatorio` ends up in that same chronological order — pushed in the same loop, in the same order, as `relatoriosIds`.)

- [ ] **Step 4: Apply the fallback before computing results**

Find (in the "4. Processar" section):

```ts
  // 4. Processar
  const alunos = carregarAlunos(planilhaText)
  const naoFeitos = calcularAusencias(alunos, relatoriosMap)
  const feitos = calcularPresencas(alunos, relatoriosMap)
```

Replace with:

```ts
  // 4. Processar
  const alunos = carregarAlunos(planilhaText)
  let alunosEnriquecidos = alunos
  for (const grupos of gruposPorRelatorio) {
    alunosEnriquecidos = aplicarFallbackGrupos(alunosEnriquecidos, grupos)
  }
  const naoFeitos = calcularAusencias(alunosEnriquecidos, relatoriosMap)
  const feitos = calcularPresencas(alunosEnriquecidos, relatoriosMap)
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/gerar-auditoria.ts
git commit -m "feat: aplicar fallback de UF/empresa dos relatorios ao gerar auditoria"
```

---

### Task 7: Full regression pass

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (pre-existing suite + every test added in Tasks 1-5).

- [ ] **Step 2: Run the full build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Note the outstanding manual verification**

This plan doesn't include a step to manually re-generate a real auditoria in the browser (no test admin credentials available in past sessions on this machine). Note in your final report to the human that they should generate a new auditoria against a planilha geral in "Formato A" plus at least one relatório with a filled `Grupos` column, and confirm the UF column in `/auditorias/[id]` now shows the extracted value for students who previously showed "—".

- [ ] **Step 4: Final commit (only if any fixups were needed above)**

```bash
git add -A
git commit -m "fix: ajustes de regressao apos extrair UF/empresa da coluna Grupos"
```
