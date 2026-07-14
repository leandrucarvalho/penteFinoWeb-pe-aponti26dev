# Anexar múltiplos relatórios de uma vez

## Contexto

Hoje o anexo de relatórios semanais (`app/(protected)/relatorios/actions.ts`, `adicionarRelatorio`) só aceita um arquivo CSV por submissão, com `nome` (ex: "Relatório 1") e `semana` (ex: "Semana 1") digitados manualmente pelo admin no formulário (`components/AdicionarRelatorioForm.tsx`). Para anexar vários relatórios, o admin precisa repetir o fluxo completo (escolher arquivo → digitar nome → digitar semana → enviar → fechar o diálogo de "gerar auditoria?") uma vez por arquivo.

`nome`/`semana` são hoje só dados de exibição (badges na lista, `components/RelatoriosList.tsx`) — desde a introdução do identificador único de cruzamento (issue #58), eles não são mais usados para casar alunos entre planilha geral e relatórios, então não há necessidade funcional de o admin controlá-los manualmente linha a linha.

`relatorios` usa soft delete (`deleted_at`), então "quantidade de relatórios" sempre deve significar "quantidade de relatórios ativos" (`deleted_at is null`).

## Objetivo

Permitir escolher e anexar vários arquivos CSV numa única submissão, com `nome`/`semana` gerados automaticamente (sequenciais, baseados na quantidade de relatórios ativos), sem exigir digitação manual por arquivo.

## Arquitetura

### `app/(protected)/relatorios/actions.ts`

`adicionarRelatorio` (singular) é substituída por `adicionarRelatorios` (plural) — uma única action cobre 1 ou N arquivos, já que não existe mais distinção funcional entre "anexar 1" e "anexar vários" (ambos usam numeração automática).

```ts
type ActionState = {
  error?: string
  sucesso?: { id: string; nome: string }[]
  falhas?: { nome: string; erro: string }[]
} | null

export async function adicionarRelatorios(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState>
```

Fluxo:
1. `verificarAdmin()` (inalterado).
2. Lê todos os arquivos via `formData.getAll('arquivos')`, filtrando só `File` com `size > 0`. Se a lista ficar vazia, retorna `{ error: 'Selecione ao menos um arquivo CSV.' }`.
3. Busca `id_coluna` da planilha geral mais recente **uma vez** (não por arquivo, diferente de hoje). Se ausente, retorna erro global igual ao atual (`'Configure a coluna de identificador...'`) — nada é processado.
4. Busca a contagem de relatórios ativos (`supabase.from('relatorios').select('id', { count: 'exact', head: true }).is('deleted_at', null)`) para calcular o próximo número: `proximoNumero = (count ?? 0) + 1`.
5. Para cada arquivo, em sequência:
   - `nome = \`Relatório ${proximoNumero}\``, `semana = \`Semana ${proximoNumero}\`` (calculado antes de saber se este arquivo vai ter sucesso).
   - Lê o texto do arquivo, valida com `planilhaTemColuna(texto, idColuna)`. Se ausente, empurra `{ nome: arquivo.name, erro: '...' }` para `falhas` e **não incrementa** `proximoNumero` (o próximo arquivo do lote reaproveita o mesmo número).
   - Se a coluna existir: sobe pro Storage, insere em `relatorios` (mesma lógica de hoje: `crypto.randomUUID()`, `storage_path`, `user_id`), registra log (`registrarLog`). Em caso de erro em qualquer uma dessas etapas, empurra pra `falhas` (com a mensagem de erro específica) e também não incrementa o número.
   - Em caso de sucesso completo: empurra `{ id: relatorioId, nome }` para `sucesso` e **incrementa** `proximoNumero`.
6. Se `sucesso.length > 0`, chama `revalidatePath('/relatorios')` uma vez, no final (não por arquivo).
7. Retorna `{ sucesso, falhas }` (ambos podem estar vazios, mas não simultaneamente — passo 2 já barrou o caso de zero arquivos).

`deletarRelatorio` e `gerarAuditoriaManual` não mudam de assinatura. `gerarAuditoriaManual` continua recebendo um único `relatorioTriggerId: string | null` — para o lote, o chamador (client) passa o `id` do único sucesso quando `sucesso.length === 1` (mantém o comportamento atual idêntico pra esse caso), ou `null` quando há mais de um (não existe um "relatório gatilho" único quando vários entraram juntos).

### `components/AdicionarRelatorioForm.tsx`

- Remove os campos `nome`/`semana` (`<Input>` de texto) e o `grid sm:grid-cols-2` que os continha.
- O `<Input type="file">` ganha o atributo `multiple` e `name="arquivos"` (plural — o browser já envia uma entrada de `FormData` por arquivo selecionado sob o mesmo nome, sem lógica extra necessária no submit).
- Estado local: `fileNames: string[]` no lugar de `fileName: string | null`. `onChange` popula a partir de `Array.from(e.target.files ?? []).map(f => f.name)`.
- Dropzone: mostra "Clique para selecionar um ou mais arquivos" quando vazio; quando `fileNames.length > 0`, mostra a contagem ("3 arquivos selecionados") e a lista de nomes (mesmo estilo de texto truncado já usado).
- `handleSubmit`: bloqueia envio (com `toast.error`) se `fileNames.length === 0` — mesmo padrão de validação via toast já usado no resto do app, sem `required` nativo.
- Reação ao novo `state`:
  - `state?.error` → `toast.error(state.error)` (erro global, ex: sem `id_coluna` configurada).
  - `state?.falhas` (se houver) → um `toast.error` por item, com `\`${falha.nome}: ${falha.erro}\``.
  - `state?.sucesso` com `length > 0` → reseta o formulário (`fileNames` volta a `[]`), `toast.success` (singular ou plural conforme a quantidade), e abre o diálogo de "gerar auditoria?" — que agora chama `gerarAuditoriaManual('add', sucesso.length === 1 ? sucesso[0].id : null)`.
  - Falha e sucesso podem coexister no mesmo retorno (lote parcial) — os dois comportamentos acima disparam juntos nesse caso.
- Texto do diálogo ("Relatório anexado" / "O relatório foi anexado com sucesso...") passa a variar no plural conforme `sucesso.length` (ex: "3 relatórios anexados").

### `next.config.ts`

Adiciona `experimental.serverActions.bodySizeLimit: '10mb'` (hoje sem configuração, usando o padrão de 1MB do Next.js). Com vários CSVs num único request, o limite padrão fica fácil de estourar; 10mb dá folga confortável para lotes razoáveis de relatórios semanais.

## Fluxo de dados (resumo)

```
admin seleciona N arquivos (input multiple)
        │
        ▼
submit único → adicionarRelatorios(formData)
        │
        ├─► busca id_coluna (1x) ─── ausente? ──► retorna erro global, nada processado
        │
        ├─► busca contagem de relatorios ativos ──► proximoNumero inicial
        │
        └─► para cada arquivo, em ordem:
              valida coluna (planilhaTemColuna)
                ├─ falha ──► falhas[] (numero NÃO consumido)
                └─ ok ──► upload + insert + log
                            ├─ falha ──► falhas[] (numero NÃO consumido)
                            └─ ok ──► sucesso[] (numero consumido, proximoNumero++)
        │
        ▼
retorna { sucesso, falhas } ──► client:
    falhas.length > 0  → 1 toast.error por falha
    sucesso.length > 0 → toast.success + diálogo único "gerar auditoria?"
```

## Tratamento de erros / casos de borda

- Zero arquivos selecionados no submit → bloqueado no client (toast, sem chamar a action) e também validado na action (defesa).
- Todos os arquivos falham → `sucesso` vazio, nenhum diálogo de gerar auditoria aparece, só os toasts de falha.
- Falha parcial (alguns sim, alguns não) → toasts de falha E diálogo de gerar auditoria aparecem juntos.
- Números nunca ficam com buraco dentro de um mesmo lote nem entre lotes: só são "gastos" por arquivos que realmente terminam inseridos com sucesso. Exclusão de um relatório existente libera esse número pro próximo lote (a contagem de ativos é recalculada do zero a cada submissão).
- Corrida entre dois admins enviando lotes ao mesmo tempo pode gerar números duplicados (a contagem é lida uma vez no início do request, sem lock) — aceito como limitação conhecida, não é um cenário realista para esta ferramenta interna de uso administrativo pontual.
- `revalidatePath('/relatorios')` só é chamado se pelo menos um arquivo teve sucesso (evita revalidação desnecessária quando o lote inteiro falha).

## Testes

`adicionarRelatorios` depende de `SupabaseClient` real (sem mocks no projeto, mesmo padrão de `adicionarRelatorio`/`uploadPlanilhaGeral` hoje) — sem suíte automatizada, mesma situação já aceita para as outras Server Actions deste projeto. Verificação manual descrita no plano de implementação.

## Fora de escopo

- Não adiciona edição de `nome`/`semana` de relatórios já anexados (renomear depois do upload). Se um lote gerar uma numeração que o admin não gosta, a correção continua sendo excluir e reanexar.
- Não paraleliza os uploads (segue sequencial, um arquivo por vez, dentro da mesma Server Action) — simplicidade sobre performance, volume esperado é baixo (relatórios semanais, não centenas de arquivos).
- Não adiciona lock/transação entre requests concorrentes para a numeração — ver limitação aceita acima.
