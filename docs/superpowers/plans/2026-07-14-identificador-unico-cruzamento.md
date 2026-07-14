# Identificador único para cruzamento planilha/relatórios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir nome+sobrenome por uma coluna de identificador único (escolhida pelo administrador) como chave de cruzamento entre a planilha geral de alunos e os relatórios semanais.

**Architecture:** O admin escolhe a coluna de ID ao subir a planilha geral (preview do cabeçalho no navegador, sem round-trip ao servidor); a escolha fica salva em `planilha_geral.id_coluna`. `lib/pente-fino.ts` passa a receber essa coluna como parâmetro e usá-la (em vez do nome normalizado) para montar/casar os registros. `lib/gerar-auditoria.ts` e a action de anexar relatório passam a validar, antes de processar, que a coluna configurada existe no CSV — bloqueando com uma mensagem clara quando não existir, em vez de gerar um cruzamento parcial ou incorreto.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `useActionState`), Supabase (Postgres + Storage, migrations aplicadas via MCP), PapaParse, shadcn/ui (`Select`, base-ui), Vitest, TypeScript.

Spec: `docs/superpowers/specs/2026-07-13-identificador-unico-cruzamento-design.md`

Projeto Supabase: `chuppzvaanyasljuknen` (org `aponti-pente-fino`) — confirme que o MCP do Supabase está conectado a este projeto (`mcp__claude_ai_Supabase__list_projects`) antes de aplicar qualquer migration.

---

### Task 1: Migration `planilha_geral.id_coluna`

**Files:**
- Create: `supabase/migrations/<version>_add_id_coluna_to_planilha_geral.sql`

Esta task usa ferramentas MCP do Supabase, não comandos de terminal. Se as ferramentas `mcp__claude_ai_Supabase__*` não aparecerem disponíveis diretamente, use a ferramenta `ToolSearch` com a query `"select:mcp__claude_ai_Supabase__apply_migration,mcp__claude_ai_Supabase__list_migrations,mcp__claude_ai_Supabase__list_tables"` para carregá-las antes de chamá-las.

- [ ] **Step 1: Confirmar o projeto Supabase correto**

Chame `mcp__claude_ai_Supabase__list_projects`. Confirme que a lista contém um projeto com `id`/`ref` igual a `chuppzvaanyasljuknen` e `name` igual a `aponti-pente-fino`. Se esse projeto não aparecer na lista, PARE e reporte BLOCKED — não aplique a migration no projeto errado.

- [ ] **Step 2: Aplicar a migration via MCP**

Chame `mcp__claude_ai_Supabase__apply_migration` com:
- `project_id`: `chuppzvaanyasljuknen`
- `name`: `add_id_coluna_to_planilha_geral`
- `query`:

```sql
alter table public.planilha_geral
  add column id_coluna text;
```

- [ ] **Step 3: Descobrir a versão atribuída à migration**

Chame `mcp__claude_ai_Supabase__list_migrations` com `project_id: chuppzvaanyasljuknen`. Encontre na resposta a migration com `name` igual a `add_id_coluna_to_planilha_geral` e anote seu `version` (número tipo `20260714...`, mesmo formato das migrations já existentes: `20260708162759`, `20260708163612`).

- [ ] **Step 4: Verificar a coluna criada**

Chame `mcp__claude_ai_Supabase__list_tables` com `project_id: chuppzvaanyasljuknen`, `schemas: ["public"]`, `verbose: true`. Confirme que `public.planilha_geral` aparece na resposta com uma coluna `id_coluna` do tipo `text`, nullable. Se algo estiver diferente do esperado, reporte BLOCKED com o que a resposta realmente mostrou.

- [ ] **Step 5: Criar o arquivo local da migration**

Crie o arquivo `supabase/migrations/<version>_add_id_coluna_to_planilha_geral.sql` (usando o `version` exato do Step 3) com o **mesmo SQL** usado no Step 2, byte a byte:

```sql
alter table public.planilha_geral
  add column id_coluna text;
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: adicionar coluna id_coluna na tabela planilha_geral"
```

---

### Task 2: `lib/pente-fino.ts` — casar por identificador em vez de nome

**Files:**
- Modify: `lib/pente-fino.ts`
- Test: `lib/pente-fino.test.ts`

Este arquivo é totalmente coeso (todas as funções de casamento vivem juntas e mudam juntas), então esta task reescreve o arquivo de teste e o arquivo de implementação por completo, em vez de fazer edições pontuais.

- [ ] **Step 1: Escrever os testes (vão falhar) — substituir todo o conteúdo de `lib/pente-fino.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
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

// Formato A: coluna "residente" (estado fica vazio, empresa da coluna "empresa") + coluna de ID
const CSV_ALUNOS_A = `ID,residente,empresa
A1,João  Silva,Empresa X
A2,maria souza,Empresa Y`

// Formato B: colunas "Nome", "Sobrenome", "Grupos" + coluna de ID
const CSV_ALUNOS_B = `ID,Nome,Sobrenome,Grupos
B1,João,Silva,PE:Empresa X - 12345678/0001-99
B2,Maria,Souza,CE:Empresa Y - 98765432/0001-11`

// Planilha com identificador vazio numa linha
const CSV_ALUNOS_ID_VAZIO = `ID,residente,empresa
,João Silva,Empresa X
A2,Maria Souza,Empresa Y`

// Planilha com identificador duplicado
const CSV_ALUNOS_ID_DUPLICADO = `ID,residente,empresa
A1,João Silva,Empresa X
A1,João Segundo,Empresa Z`

// Relatório com coluna de ID e "Nome completo"
const CSV_REL_COM_COLUNA = `ID,Nome completo,Email
A1,João Silva,joao@x.com
P1,Pedro Lima,pedro@y.com`

// Relatório sem a coluna de ID configurada
const CSV_REL_SEM_COLUNA = `Outro,Header
A,B`

// Relatório com coluna "Grupos" preenchida para um aluno, vazia para outro
const CSV_REL_COM_GRUPOS = `ID,Nome completo,Grupos,Email
A1,João Silva,Maranhão: Hermes - 42.441.933/0001-64,joao@x.com
P1,Pedro Lima,,pedro@x.com`

describe('normalizarNome', () => {
  it('coloca em minúsculo e colapsa espaços múltiplos', () => {
    expect(normalizarNome('  João  Silva  ')).toBe('joão silva')
  })

  it('mantém nome simples sem alteração além de minúsculo', () => {
    expect(normalizarNome('Maria Souza')).toBe('maria souza')
  })
})

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

  it('normaliza nome completo do estado todo em maiúsculo', () => {
    expect(normalizarUF('MARANHÃO')).toBe('MA')
  })
})

describe('parsearGrupos', () => {
  it('extrai estado e empresa do formato "UF:Empresa - CNPJ"', () => {
    const [estado, empresa] = parsearGrupos('PE:Empresa X - 12345678/0001-99')
    expect(estado).toBe('PE')
    expect(empresa).toBe('Empresa X')
  })

  it('funciona com espaço após os dois-pontos', () => {
    const [estado, empresa] = parsearGrupos('CE: Empresa Y - 98765432/0001-11')
    expect(estado).toBe('CE')
    expect(empresa).toBe('Empresa Y')
  })

  it('retorna strings vazias para entrada inválida', () => {
    const [estado, empresa] = parsearGrupos('semformato')
    expect(estado).toBe('')
  })

  it('normaliza nome completo do estado para sigla', () => {
    const [estado, empresa] = parsearGrupos('Maranhão: Hermes - 42.441.933/0001-64')
    expect(estado).toBe('MA')
    expect(empresa).toBe('Hermes')
  })
})

describe('carregarAlunos', () => {
  it('carrega formato A (coluna residente) — identificador e nome corretos', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    expect(alunos).toHaveLength(2)
    expect(alunos[0].identificador).toBe('A1')
    expect(alunos[0].nomeNormalizado).toBe('joão silva')
    expect(alunos[0].empresa).toBe('Empresa X')
  })

  it('carrega formato B (Nome + Sobrenome + Grupos) — estado e empresa extraídos', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_B, 'ID')
    expect(alunos).toHaveLength(2)
    expect(alunos[0].identificador).toBe('B1')
    expect(alunos[0].estado).toBe('PE')
    expect(alunos[0].empresa).toBe('Empresa X')
  })

  it('descarta linha com identificador vazio', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_ID_VAZIO, 'ID')
    expect(alunos).toHaveLength(1)
    expect(alunos[0].identificador).toBe('A2')
  })

  it('mantém a primeira ocorrência quando o identificador está duplicado', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_ID_DUPLICADO, 'ID')
    expect(alunos).toHaveLength(1)
    expect(alunos[0].empresa).toBe('Empresa X')
  })
})

describe('carregarRelatorio', () => {
  it('retorna Set de identificadores da coluna de ID configurada', () => {
    const ids = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')
    expect(ids).not.toBeNull()
    expect(ids!.has('A1')).toBe(true)
    expect(ids!.has('P1')).toBe(true)
    expect(ids!.size).toBe(2)
  })

  it('retorna null se a coluna de ID configurada estiver ausente', () => {
    expect(carregarRelatorio(CSV_REL_SEM_COLUNA, 'ID')).toBeNull()
  })
})

describe('extrairGruposRelatorio', () => {
  it('extrai estado (normalizado) e empresa por identificador', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS, 'ID')
    expect(grupos.get('A1')).toEqual(['MA', 'Hermes'])
  })

  it('ignora aluno com célula de Grupos vazia', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS, 'ID')
    expect(grupos.has('P1')).toBe(false)
  })

  it('retorna Map vazio se não houver coluna Grupos', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_COLUNA, 'ID')
    expect(grupos.size).toBe(0)
  })
})

describe('aplicarFallbackGrupos', () => {
  it('preenche estado vazio a partir do fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID') // Formato A: estado sempre vazio
    const grupos = new Map<string, [string, string]>([['A1', ['MA', 'Hermes']]])
    const resultado = aplicarFallbackGrupos(alunos, grupos)

    const joao = resultado.find((a) => a.identificador === 'A1')!
    expect(joao.estado).toBe('MA')
  })

  it('não sobrescreve estado já preenchido pela planilha geral', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_B, 'ID') // já tem estado 'PE' para B1
    const grupos = new Map<string, [string, string]>([['B1', ['MA', 'Outra Empresa']]])
    const resultado = aplicarFallbackGrupos(alunos, grupos)

    const joao = resultado.find((a) => a.identificador === 'B1')!
    expect(joao.estado).toBe('PE')
  })

  it('ignora alunos sem correspondência no fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const resultado = aplicarFallbackGrupos(alunos, new Map())
    expect(resultado).toEqual(alunos)
  })

  it('preenche empresa vazia a partir do fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const alunoSemEmpresa = alunos.map((a) => ({ ...a, empresa: '' }))
    const grupos = new Map<string, [string, string]>([['A1', ['MA', 'Hermes']]])
    const resultado = aplicarFallbackGrupos(alunoSemEmpresa, grupos)

    const joao = resultado.find((a) => a.identificador === 'A1')!
    expect(joao.empresa).toBe('Hermes')
  })
})

describe('calcularAusencias', () => {
  it('detecta quem NÃO fez o relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')! // só A1 e P1 estão — A2 (Maria) ausente
    const resultado = calcularAusencias(alunos, { 'Relatório 1': rel })

    const maria = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('maria'))!
    expect(maria.totalAusencias).toBe(1)
    expect(maria.relatoriosAusentes).toContain('Relatório 1')

    const joao = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('joão'))!
    expect(joao.totalAusencias).toBe(0)
    expect(joao.relatoriosAusentes).toBe('')
  })
})

describe('calcularPresencas', () => {
  it('detecta quem FEZ o relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')!
    const resultado = calcularPresencas(alunos, { 'Relatório 1': rel })

    const joao = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('joão'))!
    expect(joao.totalFeitos).toBe(1)
    expect(joao.relatoriosFeitos).toContain('Relatório 1')

    const maria = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('maria'))!
    expect(maria.totalFeitos).toBe(0)
  })

  it('casa relatório e planilha pelo identificador mesmo quando o nome muda', () => {
    const planilhaComNomeNovo = `ID,residente,empresa
A1,João Santos,Empresa X` // nome mudou de "Silva" para "Santos", identificador continua A1
    const relatorio = `ID,Nome completo,Email
A1,Qualquer Nome no Relatório,x@x.com`

    const alunos = carregarAlunos(planilhaComNomeNovo, 'ID')
    const rel = carregarRelatorio(relatorio, 'ID')!
    const resultado = calcularPresencas(alunos, { 'Relatório 1': rel })

    expect(resultado[0].totalFeitos).toBe(1)
  })
})

describe('integração: fallback de UF do relatório semanal', () => {
  it('aluno sem UF na planilha geral (Formato A) recebe UF/empresa extraídas do relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS, 'ID')
    const enriquecidos = aplicarFallbackGrupos(alunos, grupos)

    const joao = enriquecidos.find((a) => a.identificador === 'A1')!
    expect(joao.estado).toBe('MA')
    // empresa já vinha preenchida pela planilha geral (Empresa X) — não é sobrescrita
    expect(joao.empresa).toBe('Empresa X')

    const maria = enriquecidos.find((a) => a.identificador === 'A2')!
    // Maria não aparece em nenhum relatório com Grupos preenchido — segue vazia
    expect(maria.estado).toBe('')
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- pente-fino`
Expected: FAIL — várias asserções de `identificador` recebendo `undefined` (o campo ainda não existe em `Aluno`), e chamadas com 2 argumentos sendo aceitas mas ignorando o segundo (implementação antiga ainda casa por nome).

- [ ] **Step 3: Substituir todo o conteúdo de `lib/pente-fino.ts`**

```ts
import Papa from 'papaparse'

export type Aluno = {
  nomeCompleto: string
  nomeNormalizado: string
  identificador: string
  estado: string
  empresa: string
}

export type ResultadoAusencia = {
  nomeCompleto: string
  estado: string
  empresa: string
  relatoriosAusentes: string
  totalAusencias: number
}

export type ResultadoPresenca = {
  nomeCompleto: string
  estado: string
  empresa: string
  relatoriosFeitos: string
  totalFeitos: number
}

export function normalizarNome(nome: string): string {
  if (typeof nome !== 'string') return ''
  return nome.trim().toLowerCase().replace(/\s+/g, ' ')
}

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
  const chave = removerAcentos(limpo.toLowerCase())
  return UF_POR_NOME_ESTADO[chave] ?? limpo
}

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

export function carregarAlunos(csvText: string, idColuna: string): Aluno[] {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = (meta.fields ?? []).map((h) => h.toLowerCase())
  const isFormatoA = headers.includes('residente')
  const idKey = meta.fields?.find((f) => f === idColuna) ?? idColuna

  const vistos = new Set<string>()
  const alunos: Aluno[] = []

  for (const row of data) {
    let nomeCompleto: string
    let estado = ''
    let empresa = ''

    if (isFormatoA) {
      const nomeKey = Object.keys(row).find((k) => k.toLowerCase() === 'residente') ?? ''
      const empresaKey = Object.keys(row).find((k) => k.toLowerCase() === 'empresa') ?? ''
      nomeCompleto = (row[nomeKey] ?? '').trim()
      empresa = (row[empresaKey] ?? '').trim()
    } else {
      const nomeKey = Object.keys(row).find((k) => k === 'Nome') ?? 'Nome'
      const sobrenomeKey = Object.keys(row).find((k) => k === 'Sobrenome') ?? 'Sobrenome'
      const gruposKey = Object.keys(row).find((k) => k === 'Grupos') ?? 'Grupos'
      nomeCompleto = `${row[nomeKey] ?? ''} ${row[sobrenomeKey] ?? ''}`.trim()
      if (row[gruposKey]) {
        ;[estado, empresa] = parsearGrupos(row[gruposKey])
      }
    }

    const nomeNormalizado = normalizarNome(nomeCompleto)
    const identificador = (row[idKey] ?? '').trim()
    if (!identificador || vistos.has(identificador)) continue
    vistos.add(identificador)
    alunos.push({ nomeCompleto, nomeNormalizado, identificador, estado, empresa })
  }

  return alunos
}

// Retorna null se a coluna de identificador configurada estiver ausente (arquivo inválido)
export function carregarRelatorio(csvText: string, idColuna: string): Set<string> | null {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const col = meta.fields?.find((f) => f === idColuna)
  if (!col) return null

  return new Set(
    data
      .map((row) => (row[col] ?? '').trim())
      .filter(Boolean)
  )
}

export function extrairGruposRelatorio(
  csvText: string,
  idColuna: string
): Map<string, [string, string]> {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const idKey = meta.fields?.find((f) => f === idColuna)
  const gruposKey = meta.fields?.find((f) => f === 'Grupos')
  const grupos = new Map<string, [string, string]>()

  if (!idKey || !gruposKey) return grupos

  for (const row of data) {
    const identificador = (row[idKey] ?? '').trim()
    const valorGrupos = row[gruposKey]
    if (!identificador || !valorGrupos) continue
    grupos.set(identificador, parsearGrupos(valorGrupos))
  }

  return grupos
}

export function aplicarFallbackGrupos(
  alunos: Aluno[],
  grupos: Map<string, [string, string]>
): Aluno[] {
  return alunos.map((aluno) => {
    const fallback = grupos.get(aluno.identificador)
    if (!fallback) return aluno
    const [estadoFallback, empresaFallback] = fallback
    return {
      ...aluno,
      estado: aluno.estado || estadoFallback,
      empresa: aluno.empresa || empresaFallback,
    }
  })
}

export function calcularAusencias(
  alunos: Aluno[],
  relatorios: Record<string, Set<string>>
): ResultadoAusencia[] {
  return alunos.map((aluno) => {
    const ausentes = Object.entries(relatorios)
      .filter(([, ids]) => !ids.has(aluno.identificador))
      .map(([nome]) => nome)

    return {
      nomeCompleto: aluno.nomeCompleto,
      estado: aluno.estado,
      empresa: aluno.empresa,
      relatoriosAusentes: ausentes.join(', '),
      totalAusencias: ausentes.length,
    }
  })
}

export function calcularPresencas(
  alunos: Aluno[],
  relatorios: Record<string, Set<string>>
): ResultadoPresenca[] {
  return alunos.map((aluno) => {
    const feitos = Object.entries(relatorios)
      .filter(([, ids]) => ids.has(aluno.identificador))
      .map(([nome]) => nome)

    return {
      nomeCompleto: aluno.nomeCompleto,
      estado: aluno.estado,
      empresa: aluno.empresa,
      relatoriosFeitos: feitos.join(', '),
      totalFeitos: feitos.length,
    }
  })
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- pente-fino`
Expected: PASS — todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add lib/pente-fino.ts lib/pente-fino.test.ts
git commit -m "feat: casar planilha geral e relatorios por identificador em vez de nome"
```

---

### Task 3: `lib/gerar-auditoria.ts` — exigir e validar a coluna de identificador

**Files:**
- Modify: `lib/gerar-auditoria.ts`

Sem teste automatizado nesta task: `gerarAuditoria` já não tinha suíte antes desta mudança (depende de um `SupabaseClient` real, sem mocks no projeto). A lógica pura que ela orquestra (`carregarAlunos`, `carregarRelatorio`, etc.) já está coberta na Task 2. Esta task é verificada por `npx tsc --noEmit` e, no final do plano (Task 7), manualmente na UI.

- [ ] **Step 1: Selecionar `id_coluna` junto da planilha geral e abortar se ausente**

Find:

```ts
  // 1. Planilha geral mais recente
  const { data: planilhas, error: errPlanilha } = await supabase
    .from('planilha_geral')
    .select('storage_path')
    .order('uploaded_at', { ascending: false })
    .limit(1)

  if (errPlanilha || !planilhas?.length) {
    throw new Error('Nenhuma planilha geral encontrada. Faça upload em /configuracoes primeiro.')
  }

  const { data: planilhaFile } = await supabase.storage
    .from('planilha-geral')
    .download(planilhas[0].storage_path)
```

Replace with:

```ts
  // 1. Planilha geral mais recente
  const { data: planilhas, error: errPlanilha } = await supabase
    .from('planilha_geral')
    .select('storage_path, id_coluna')
    .order('uploaded_at', { ascending: false })
    .limit(1)

  if (errPlanilha || !planilhas?.length) {
    throw new Error('Nenhuma planilha geral encontrada. Faça upload em /configuracoes primeiro.')
  }

  const idColuna = planilhas[0].id_coluna
  if (!idColuna) {
    throw new Error(
      'A planilha geral atual não tem uma coluna de identificador configurada. Reenvie a planilha geral em /configuracoes escolhendo a coluna de ID.'
    )
  }

  const { data: planilhaFile } = await supabase.storage
    .from('planilha-geral')
    .download(planilhas[0].storage_path)
```

- [ ] **Step 2: Validar a coluna em todos os relatórios ativos antes de processar, abortando se algum não tiver**

Find:

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

  // 4. Processar
  const alunos = carregarAlunos(planilhaText)
```

Replace with:

```ts
  // 3. Baixar cada CSV de relatório e validar a coluna de identificador antes de processar
  const relatoriosValidos: { rel: { id: string; nome: string }; ids: Set<string>; texto: string }[] = []
  const semColuna: string[] = []

  for (const rel of relatorios) {
    const { data: relFile } = await supabase.storage
      .from('relatorios')
      .download(rel.storage_path)

    if (!relFile) {
      console.warn(`Relatório ${rel.nome}: falha ao baixar do Storage`)
      continue
    }

    const texto = await relFile.text()
    const ids = carregarRelatorio(texto, idColuna)

    if (ids === null) {
      semColuna.push(rel.nome)
      continue
    }

    relatoriosValidos.push({ rel, ids, texto })
  }

  if (semColuna.length > 0) {
    throw new Error(
      `Os relatórios a seguir não têm a coluna de identificador "${idColuna}": ${semColuna.join(', ')}. Corrija os arquivos antes de gerar a auditoria.`
    )
  }

  const relatoriosMap: Record<string, Set<string>> = {}
  const relatoriosIds: string[] = []
  const gruposPorRelatorio: Map<string, [string, string]>[] = []

  for (const { rel, ids, texto } of relatoriosValidos) {
    relatoriosMap[rel.nome] = ids
    relatoriosIds.push(rel.id)
    gruposPorRelatorio.push(extrairGruposRelatorio(texto, idColuna))
  }

  // 4. Processar
  const { meta: metaPlanilha } = Papa.parse<Record<string, string>>(planilhaText, {
    header: true,
    preview: 1,
  })
  if (!metaPlanilha.fields?.includes(idColuna)) {
    throw new Error(
      `A planilha geral atual não tem a coluna de identificador "${idColuna}". Reenvie a planilha geral em /configuracoes com essa coluna, ou escolha outra coluna.`
    )
  }

  const alunos = carregarAlunos(planilhaText, idColuna)
```

**Por que este passo existe (não estava no design original):** a revisão de qualidade da Task 2 encontrou uma lacuna — `carregarAlunos` não tem como sinalizar "coluna de ID ausente no cabeçalho" (ao contrário de `carregarRelatorio`, que retorna `null` nesse caso); se a coluna configurada não bater com nenhum cabeçalho da planilha geral, `carregarAlunos` simplesmente descarta todas as linhas (identificador vira `''` em todas) e retorna `[]` silenciosamente. Sem este check, uma planilha geral com a coluna renomeada/ausente geraria uma auditoria "vazia" sem nenhum erro claro — exatamente o tipo de falha silenciosa que a issue #58 pede para eliminar. `Papa` já está importado neste arquivo (usado por `Papa.unparse` mais abaixo), então não é necessário um novo import.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/gerar-auditoria.ts
git commit -m "feat: exigir coluna de identificador ao gerar auditoria"
```

---

### Task 4: Seleção da coluna de ID ao subir a planilha geral

**Files:**
- Modify: `app/(protected)/configuracoes/actions.ts`
- Modify: `components/PlanilhaGeralForm.tsx`

- [ ] **Step 1: `uploadPlanilhaGeral` passa a exigir e gravar `idColuna`**

Find (em `app/(protected)/configuracoes/actions.ts`):

```ts
    const arquivo = formData.get('arquivo') as File
    if (!arquivo || arquivo.size === 0) return { error: 'Selecione um arquivo CSV.' }

    const planilhaId = crypto.randomUUID()
    const storagePath = `${planilhaId}/arquivo.csv`

    const { error: uploadError } = await supabase.storage
      .from('planilha-geral')
      .upload(storagePath, arquivo, { upsert: true })

    if (uploadError) return { error: `Erro no upload: ${uploadError.message}` }

    const { error: insertError } = await supabase.from('planilha_geral').insert({
      storage_path: storagePath,
      user_id: user.id,
    })
```

Replace with:

```ts
    const arquivo = formData.get('arquivo') as File
    if (!arquivo || arquivo.size === 0) return { error: 'Selecione um arquivo CSV.' }

    const idColuna = (formData.get('idColuna') as string | null)?.trim()
    if (!idColuna) return { error: 'Selecione a coluna de identificador.' }

    const planilhaId = crypto.randomUUID()
    const storagePath = `${planilhaId}/arquivo.csv`

    const { error: uploadError } = await supabase.storage
      .from('planilha-geral')
      .upload(storagePath, arquivo, { upsert: true })

    if (uploadError) return { error: `Erro no upload: ${uploadError.message}` }

    const { error: insertError } = await supabase.from('planilha_geral').insert({
      storage_path: storagePath,
      user_id: user.id,
      id_coluna: idColuna,
    })
```

- [ ] **Step 2: Substituir todo o conteúdo de `components/PlanilhaGeralForm.tsx`**

```tsx
'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react'
import { uploadPlanilhaGeral } from '@/app/(protected)/configuracoes/actions'

export function PlanilhaGeralForm() {
  const [state, action, pending] = useActionState(uploadPlanilhaGeral, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [colunas, setColunas] = useState<string[]>([])
  const [idColuna, setIdColuna] = useState<string | null>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      setFileName(null)
      setColunas([])
      setIdColuna(null)
      toast.success('Planilha atualizada com sucesso!')
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setIdColuna(null)

    if (!file) {
      setFileName(null)
      setColunas([])
      return
    }

    setFileName(file.name)

    const texto = await file.text()
    const { meta } = Papa.parse<Record<string, string>>(texto, {
      header: true,
      preview: 1,
    })

    if (!meta.fields || meta.fields.length === 0) {
      setColunas([])
      toast.error('Não foi possível ler as colunas desse arquivo CSV.')
      return
    }

    setColunas(meta.fields)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!fileName) {
      e.preventDefault()
      toast.error('Selecione um arquivo CSV.')
      return
    }
    if (!idColuna) {
      e.preventDefault()
      toast.error('Selecione a coluna de identificador.')
    }
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Arquivo CSV</Label>
        <label
          htmlFor="arquivo-pg"
          className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all py-8 px-4 text-center
            ${pending ? 'opacity-50 cursor-not-allowed' : ''}
            ${fileName
              ? 'border-primary/50 bg-primary/5'
              : 'border-border hover:border-primary/40 hover:bg-primary/3'
            }`}
        >
          {fileName ? (
            <>
              <FileCheck2 className="w-7 h-7 text-primary mb-2" />
              <span className="text-sm font-medium text-primary truncate max-w-full px-4">
                {fileName}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Clique para trocar o arquivo
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="w-7 h-7 text-muted-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">
                Clique para selecionar um arquivo
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Formatos: <code className="text-xs bg-muted px-1 rounded">residente, empresa</code> ou{' '}
                <code className="text-xs bg-muted px-1 rounded">Nome, Sobrenome, Grupos</code>
              </span>
            </>
          )}
        </label>
        <Input
          id="arquivo-pg"
          name="arquivo"
          type="file"
          accept=".csv"
          disabled={pending}
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {colunas.length > 0 && (
        <div className="space-y-2">
          <Label>Coluna de identificador único</Label>
          <Select name="idColuna" value={idColuna} onValueChange={setIdColuna} disabled={pending}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a coluna de identificador" />
            </SelectTrigger>
            <SelectContent>
              {colunas.map((coluna) => (
                <SelectItem key={coluna} value={coluna}>
                  {coluna}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Essa coluna será usada para cruzar os alunos com os relatórios semanais, no lugar do nome.
          </p>
        </div>
      )}

      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <UploadCloud className="w-4 h-4" />
            Atualizar planilha geral
          </>
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/configuracoes/actions.ts" components/PlanilhaGeralForm.tsx
git commit -m "feat: selecionar coluna de identificador ao subir a planilha geral"
```

---

### Task 5: Exibir a coluna configurada em `/configuracoes`

**Files:**
- Modify: `app/(protected)/configuracoes/page.tsx`

- [ ] **Step 1: Buscar `id_coluna` junto do histórico de uploads**

Find:

```ts
  const { data: planilhas } = await supabase
    .from('planilha_geral')
    .select('id, uploaded_at')
    .order('uploaded_at', { ascending: false })
    .limit(5)
```

Replace with:

```ts
  const { data: planilhas } = await supabase
    .from('planilha_geral')
    .select('id, uploaded_at, id_coluna')
    .order('uploaded_at', { ascending: false })
    .limit(5)
```

- [ ] **Step 2: Atualizar o texto de apoio do card**

Find:

```tsx
          <CardTitle>Planilha geral de alunos</CardTitle>
          <CardDescription>
            CSV com colunas{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">residente, empresa</code>{' '}
            (Formato A) ou{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Nome, Sobrenome, Grupos</code>{' '}
            (Formato B). Será usada em todas as próximas auditorias.
          </CardDescription>
```

Replace with:

```tsx
          <CardTitle>Planilha geral de alunos</CardTitle>
          <CardDescription>
            CSV com colunas{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">residente, empresa</code>{' '}
            (Formato A) ou{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Nome, Sobrenome, Grupos</code>{' '}
            (Formato B), mais uma coluna à sua escolha para servir de identificador único do aluno.
            Será usada em todas as próximas auditorias.
          </CardDescription>
```

- [ ] **Step 3: Mostrar a coluna configurada no histórico**

Find:

```tsx
                {planilhas.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {new Date(p.uploaded_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </span>
                    {i === 0 && (
                      <Badge className="text-xs h-5 px-2 bg-primary/10 text-primary border-primary/20 border">
                        atual
                      </Badge>
                    )}
                  </li>
                ))}
```

Replace with:

```tsx
                {planilhas.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {new Date(p.uploaded_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </span>
                    {p.id_coluna && (
                      <Badge variant="outline" className="text-xs h-5 px-2">
                        ID: {p.id_coluna}
                      </Badge>
                    )}
                    {i === 0 && (
                      <Badge className="text-xs h-5 px-2 bg-primary/10 text-primary border-primary/20 border">
                        atual
                      </Badge>
                    )}
                  </li>
                ))}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/configuracoes/page.tsx"
git commit -m "feat: exibir coluna de identificador configurada no historico da planilha geral"
```

---

### Task 6: Bloquear anexo de relatório sem a coluna de identificador

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts`

- [ ] **Step 1: Validar a coluna antes de subir o relatório**

Find:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarAuditoria } from '@/lib/gerar-auditoria'
import { registrarLog } from '@/lib/system-log'
```

Replace with:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'
import { gerarAuditoria } from '@/lib/gerar-auditoria'
import { registrarLog } from '@/lib/system-log'
```

Find:

```ts
    if (!nome || !semana) return { error: 'Preencha nome e semana.' }
    if (!arquivo || arquivo.size === 0) return { error: 'Selecione um arquivo CSV.' }

    const relatorioId = crypto.randomUUID()
```

Replace with:

```ts
    if (!nome || !semana) return { error: 'Preencha nome e semana.' }
    if (!arquivo || arquivo.size === 0) return { error: 'Selecione um arquivo CSV.' }

    const { data: planilhas } = await supabase
      .from('planilha_geral')
      .select('id_coluna')
      .order('uploaded_at', { ascending: false })
      .limit(1)

    const idColuna = planilhas?.[0]?.id_coluna
    if (!idColuna) {
      return {
        error:
          'Configure a coluna de identificador na planilha geral (/configuracoes) antes de anexar relatórios.',
      }
    }

    const texto = await arquivo.text()
    const { meta } = Papa.parse<Record<string, string>>(texto, { header: true, preview: 1 })
    if (!meta.fields?.includes(idColuna)) {
      return {
        error: `Este relatório não possui a coluna de identificador "${idColuna}" configurada na planilha geral.`,
      }
    }

    const relatorioId = crypto.randomUUID()
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts"
git commit -m "feat: bloquear anexo de relatorio sem a coluna de identificador configurada"
```

---

### Task 7: Regressão completa e verificação manual

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes passam (suíte pré-existente + testes atualizados na Task 2).

- [ ] **Step 2: Build completo**

Run: `npm run build`
Expected: build passa sem erros de tipo.

- [ ] **Step 3: Verificação manual na UI (obrigatória — não coberta por teste automatizado)**

Com um usuário admin, em `/configuracoes`:
1. Suba uma planilha geral CSV com uma coluna extra de identificador (ex: `ID,Nome,Sobrenome,Grupos`). Confirme que o dropdown de colunas aparece após escolher o arquivo, liste `ID`, `Nome`, `Sobrenome`, `Grupos`, e que o botão de envio só habilita — ou só efetivamente envia sem erro de toast — depois de escolher uma coluna.
2. Confirme que o histórico de uploads passa a mostrar o badge `ID: <coluna escolhida>` na linha do upload mais recente.
3. Em `/relatorios`, tente anexar um relatório cujo CSV **não** tem a coluna escolhida (ex: `ID` não está no cabeçalho). Confirme que aparece um toast de erro e o relatório não é anexado (não aparece na lista).
4. Anexe um relatório com a coluna `ID` presente, usando o mesmo valor de identificador de um aluno da planilha geral, mas com o nome escrito diferente do que está na planilha. Gere a auditoria e confirme que esse aluno aparece como "feito" no relatório — validando que o cruzamento usou o ID e não o nome.
5. Gere uma auditoria com a planilha geral atual e confirme que ela é concluída normalmente quando todos os relatórios ativos têm a coluna configurada.

Reporte ao usuário humano o resultado dessa verificação manual antes de considerar o trabalho concluído — nenhuma sessão anterior neste projeto teve credenciais de admin disponíveis para testar isso de ponta a ponta automaticamente.
