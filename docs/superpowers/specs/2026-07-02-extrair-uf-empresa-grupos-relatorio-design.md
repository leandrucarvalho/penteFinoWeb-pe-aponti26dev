# Extrair UF/empresa da coluna "Grupos" dos relatórios semanais

## Contexto

O grid de resultado de auditoria (`/auditorias/[id]`) exibe uma coluna "UF" por aluno. Hoje esse valor vem exclusivamente de `Aluno.estado`, populado em [carregarAlunos](../../../lib/pente-fino.ts) a partir da planilha geral (roster mestre). Quando a planilha geral está no "Formato A" (colunas `residente`/`empresa`, sem informação de estado — ver comentário em `pente-fino.test.ts`), `estado` fica sempre vazio e a coluna UF não aparece no grid.

Cada relatório semanal individual (CSV exportado do Moodle, upload feito em `/relatorios`) também tem uma coluna `Grupos`, no mesmo formato usado no Formato B da planilha geral: `"<Estado>: <Empresa> - <CNPJ>"` (ex: `"Maranhão: Hermes - 42.441.933/0001-64"`). Essa informação hoje é ignorada por `carregarRelatorio`, que só extrai a coluna `Nome completo` para checar presença/ausência.

## Objetivo

Usar a coluna `Grupos` dos relatórios semanais como fonte alternativa (fallback) de UF e empresa, para alunos cuja planilha geral não tenha essa informação — sem alterar o comportamento para quem já tem `estado`/`empresa` preenchidos pela planilha geral.

## Arquitetura

### `lib/pente-fino.ts`

**`normalizarUF(valor: string): string`** (nova função pura)
Normaliza um valor de estado para sigla de 2 letras:
- Se já for uma sigla válida de UF (2 letras, case-insensitive), retorna em maiúsculas.
- Senão, remove acentos e busca em um mapa estático dos 27 estados (nome completo → sigla, ex: `"maranhao" → "MA"`).
- Se não encontrar correspondência, retorna o valor original sem alteração (nunca perde dado).

**`parsearGrupos`** passa a chamar `normalizarUF(estado)` antes de retornar, nos dois ramos (formato `:` e formato `|`). Isso beneficia tanto a planilha geral (Formato B) quanto o novo fallback dos relatórios, já que ambos passam por essa função. O teste existente `parsearGrupos('PE:Empresa X...')` continua retornando `'PE'` (sigla já válida passa direto).

**`extrairGruposRelatorio(csvText: string): Map<string, [string, string]>`** (nova função pura)
Recebe o texto de um relatório semanal, procura a coluna `Grupos` (nome exato, mesmo critério usado em `carregarAlunos`) e retorna um `Map` de nome normalizado → `[estado, empresa]` via `parsearGrupos`. Se a coluna não existir ou uma célula estiver vazia, o aluno correspondente simplesmente não entra no `Map` (sem erro — mesmo padrão de tolerância já usado em `carregarRelatorio`).

**`aplicarFallbackGrupos(alunos: Aluno[], grupos: Map<string, [string, string]>): Aluno[]`** (nova função pura)
Retorna uma nova lista de `Aluno[]`, preenchendo `estado`/`empresa` a partir do `Map` **somente** quando o campo já não estiver vazio, campo a campo (ex: se só `estado` estiver vazio, só `estado` é preenchido; `empresa` já existente nunca é sobrescrita). Alunos sem correspondência no `Map` retornam inalterados.

### `lib/gerar-auditoria.ts`

1. A query de relatórios ativos passa a incluir `.order('created_at', { ascending: true })` — hoje não há ordenação. Isso define determinísticamente o que significa "primeiro relatório" para efeito de fallback.
2. Ao baixar e parsear cada relatório (loop já existente), além de `carregarRelatorio` (para o Set de presença), também chama `extrairGruposRelatorio` no mesmo texto.
3. Após montar a lista de `alunos` (via `carregarAlunos` da planilha geral), aplica `aplicarFallbackGrupos` **em sequência**, um relatório por vez, na ordem cronológica do passo 1. Como a função só preenche o que está vazio, o primeiro relatório (mais antigo) que tiver a UF/empresa de um aluno "vence" automaticamente, sem precisar de lógica de merge adicional.
4. A lista resultante (`alunosEnriquecidos`) substitui `alunos` nas chamadas a `calcularAusencias`/`calcularPresencas`. As assinaturas dessas duas funções **não mudam**.

## Fluxo de dados (resumo)

```
planilha geral ──► carregarAlunos ──► alunos (estado/empresa podem vir vazios)
                                          │
relatório 1 (mais antigo) ──► extrairGruposRelatorio ──► aplicarFallbackGrupos ──┐
relatório 2               ──► extrairGruposRelatorio ──► aplicarFallbackGrupos ──┤──► alunosEnriquecidos
relatório N (mais recente) ──► extrairGruposRelatorio ──► aplicarFallbackGrupos ──┘
                                          │
                                          ▼
                        calcularAusencias / calcularPresencas (inalteradas)
```

## Tratamento de erros / casos de borda

- Relatório sem coluna `Grupos`: tratado como se não tivesse essa informação (comportamento atual preservado).
- Aluno não aparece em nenhum relatório: `estado`/`empresa` seguem vazios, como hoje (exibe "—" no grid).
- Valor de estado não reconhecido pelo mapa de normalização (ex: erro de digitação): mantém o valor original, sem quebrar a extração.
- Nenhuma alteração no formato de saída (`ResultadoAusencia`/`ResultadoPresenca`) nem no grid (`AuditResultTable.tsx`) — a UF/empresa já preenchidas simplesmente passam a aparecer mais vezes.

## Testes

Adicionar em `lib/pente-fino.test.ts`:
- `normalizarUF`: nome completo com acento → sigla (`"Maranhão"` → `"MA"`); sigla já válida → mantém (`"PE"` → `"PE"`); valor desconhecido → mantém como veio.
- `extrairGruposRelatorio`: extrai `Map` corretamente de um CSV com coluna `Grupos`; relatório sem a coluna retorna `Map` vazio.
- `aplicarFallbackGrupos`: preenche campos vazios; não sobrescreve campos já preenchidos; ignora alunos sem correspondência no `Map`.
- Teste de integração: planilha geral em Formato A (sem UF) + relatório com `Grupos` preenchido → aluno aparece no resultado de `calcularAusencias`/`calcularPresencas` já com a UF extraída do relatório.

## Fora de escopo

- Não altera `AuditResultTable.tsx` nem a UI do grid — o fix já é totalmente na camada de dados.
- Não normaliza nomes de empresa (só estado tem normalização de sigla).
- Não retroalimenta a planilha geral com os dados extraídos dos relatórios — o fallback é calculado a cada geração de auditoria, não persistido.
