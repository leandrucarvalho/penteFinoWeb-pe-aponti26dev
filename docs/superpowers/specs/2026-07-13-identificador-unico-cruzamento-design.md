# Identificador único para cruzamento entre relatórios e planilha geral

Issue: [#58](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/58)

## Contexto

O cruzamento de dados entre relatórios semanais e a planilha geral de alunos é feito hoje inteiramente por nome+sobrenome normalizado (`normalizarNome`, [lib/pente-fino.ts:26](../../../lib/pente-fino.ts)). Toda a lógica de casamento (`calcularAusencias`/`calcularPresencas`, [lib/pente-fino.ts:203-239](../../../lib/pente-fino.ts)) compara o `nomeNormalizado` do aluno contra o `Set` de nomes normalizados extraído de cada relatório. Quando um aluno muda de nome no sistema de origem, o registro deixa de casar entre as duas fontes.

Nem a planilha geral nem os relatórios são persistidos linha a linha: ambos são CSVs enviados via upload, guardados como blob no Supabase Storage (buckets `planilha-geral` e `relatorios`) e só são parseados em memória no momento da geração de auditoria ([lib/gerar-auditoria.ts](../../../lib/gerar-auditoria.ts)). Não existe tabela `alunos` nem UI de edição linha a linha — a única forma de alterar dados de um aluno hoje é editando o CSV antes do upload.

Os relatórios semanais são exportados do Moodle e já trazem uma coluna de identificador nativo (variável conforme a exportação); a planilha geral tem duas variações de formato já suportadas (Formato A: `residente, empresa`; Formato B: `Nome, Sobrenome, Grupos`). Não há hoje nenhum campo de ID reconhecido pelo sistema.

## Objetivo

Permitir que o administrador escolha, no momento do upload da planilha geral, qual coluna do CSV deve ser usada como identificador único de cruzamento — substituindo nome+sobrenome como chave de casamento entre planilha geral e relatórios, mantendo o nome apenas como dado de exibição.

## Arquitetura

### Banco de dados

Nova migration em `supabase/migrations/` adicionando a coluna `id_coluna text` (nullable) à tabela `planilha_geral`. Nullable porque uploads feitos antes desta feature não terão essa configuração.

As tabelas `planilha_geral`, `relatorios` e `auditorias` existem hoje no projeto Supabase mas não têm migrations correspondentes no repositório (foram criadas fora do fluxo de migrations). Esta é a primeira alteração de schema dessas tabelas feita a partir do código — a migration cobre apenas o `ALTER TABLE` da nova coluna, sem tentar recriar o schema existente.

### `components/PlanilhaGeralForm.tsx`

Ao selecionar o arquivo (evento `onChange` do `<Input type="file">`), o componente lê o cabeçalho do CSV no navegador com PapaParse (`Papa.parse(file, { header: true, preview: 1 })`), sem subir nada ainda. As colunas encontradas populam um `<Select>` (shadcn) que aparece abaixo do campo de arquivo, com um placeholder tipo "Selecione a coluna de identificador". O botão de envio fica desabilitado até uma coluna ser escolhida. Um único submit manda o arquivo (`arquivo`) e o nome da coluna escolhida (`idColuna`) juntos.

Se o CSV não puder ser parseado (arquivo inválido) ou não tiver cabeçalho, mostra erro via `toast` e não deixa prosseguir — mesmo padrão de validação client-side já usado no componente (`handleSubmit`).

### `uploadPlanilhaGeral` — `app/(protected)/configuracoes/actions.ts`

Passa a ler `idColuna` do `formData`. Se ausente ou vazio, retorna erro (`{ error: 'Selecione a coluna de identificador.' }`) sem subir o arquivo. Ao inserir a linha em `planilha_geral`, grava `id_coluna: idColuna` junto de `storage_path`/`user_id`.

### `app/(protected)/configuracoes/page.tsx`

Texto de apoio do card "Planilha geral de alunos" passa a mencionar a exigência da coluna de identificador. O histórico de uploads passa a exibir a coluna configurada em cada upload (ex: badge `ID: <nome da coluna>`) para o admin conferir qual está em uso sem precisar reabrir o CSV.

### `lib/pente-fino.ts`

- `Aluno` ganha o campo `identificador: string` (valor bruto da coluna escolhida, após `trim()`). Comparação de identificador é sensível a maiúsculas/minúsculas — sem normalização de caixa ou acentos, diferente do que acontece com nome. `nomeCompleto`/`nomeNormalizado` continuam existindo, mas passam a servir só para exibição, não para casamento.
- `carregarAlunos(csvText, idColuna: string)` — mantém a detecção de Formato A/B para montar `nomeCompleto` (lógica inalterada), e adicionalmente extrai `identificador = (row[idColuna] ?? '').trim()`. O dedup por `vistos`/`Set` passa a usar `identificador` como chave em vez de `nomeNormalizado`: linha com identificador vazio é descartada; identificador duplicado — primeira ocorrência vence, demais são ignoradas (mesmo padrão de tolerância já usado para nome).
- `carregarRelatorio(csvText, idColuna: string): Set<string> | null` — em vez de procurar a coluna fixa `"Nome completo"`, procura `idColuna`. Se a coluna não existir no relatório, retorna `null` (comportamento já existente, só muda qual coluna é checada). Os valores do `Set` passam a ser os identificadores (`trim()`), não nomes normalizados.
- `extrairGruposRelatorio(csvText, idColuna: string): Map<string, [string, string]>` — chave do `Map` passa a ser o identificador em vez do nome normalizado.
- `aplicarFallbackGrupos` — sem mudança de assinatura; já recebe o `Map` pronto, só passa a casar por `aluno.identificador` em vez de `aluno.nomeNormalizado`.
- `calcularAusencias`/`calcularPresencas` — comparam `aluno.identificador` contra os `Set<string>` de cada relatório em vez de `aluno.nomeNormalizado`. `nomeCompleto` continua sendo usado nos objetos de resultado (`ResultadoAusencia`/`ResultadoPresenca`) para exibição — sem mudança nesses tipos.

### `lib/gerar-auditoria.ts`

1. Ao buscar a planilha geral mais recente, também seleciona `id_coluna`. Se `id_coluna` for `null` (planilha enviada antes desta feature), lança erro imediatamente: `"A planilha geral atual não tem uma coluna de identificador configurada. Reenvie a planilha geral em /configuracoes escolhendo a coluna de ID."` — nenhuma auditoria é gerada.
2. Antes de parsear os relatórios, verifica o cabeçalho de cada relatório ativo (via `Papa.parse` com `preview: 1` ou reaproveitando o parse já feito por `carregarRelatorio`) contra `id_coluna`. Se **qualquer** relatório ativo não tiver a coluna, a geração inteira é abortada (não gera uma auditoria parcial) com erro listando o(s) relatório(s) problemático(s) pelo `nome`.
3. `carregarAlunos`, `carregarRelatorio` e `extrairGruposRelatorio` passam a receber `id_coluna` como parâmetro adicional.

### `adicionarRelatorio` — `app/(protected)/relatorios/actions.ts`

Antes de subir o arquivo para o Storage: busca `id_coluna` da planilha geral mais recente. Se não houver planilha geral configurada com `id_coluna`, bloqueia o anexo com erro orientando a configurar a planilha geral primeiro. Caso contrário, lê o texto do CSV enviado (`arquivo.text()`) e verifica se o cabeçalho contém `id_coluna`; se não contiver, retorna erro (`{ error: 'Este relatório não possui a coluna de identificador "<id_coluna>" configurada na planilha geral.' }`) sem subir o arquivo nem inserir linha em `relatorios`. Essa validação é redundante com a checagem em `gerarAuditoria` (passo 2 acima) de propósito — pega o erro o quanto antes, no momento do anexo, mas `gerarAuditoria` continua validando de novo como defesa (caso a coluna configurada mude depois que relatórios já foram anexados).

## Fluxo de dados (resumo)

```
upload planilha geral ──► admin escolhe coluna de ID (client-side, via preview do cabeçalho)
                                  │
                                  ▼
                    planilha_geral.id_coluna (persistido)
                                  │
        ┌─────────────────────────┴─────────────────────────┐
        ▼                                                     ▼
anexar relatório semanal                          gerar auditoria
  → valida coluna id_coluna presente                → valida id_coluna configurada
    no CSV do relatório (bloqueia se ausente)        → valida id_coluna presente em
                                                        todos os relatórios ativos
                                                        (aborta auditoria se ausente)
                                                      → carregarAlunos/carregarRelatorio/
                                                        extrairGruposRelatorio usam id_coluna
                                                      → calcularAusencias/calcularPresencas
                                                        casam por aluno.identificador
```

## Tratamento de erros / casos de borda

- Linha da planilha geral com identificador vazio → aluno descartado (mesmo comportamento hoje para nome vazio).
- Identificadores duplicados na planilha geral → primeira ocorrência vence, demais ignoradas silenciosamente (mesmo padrão de tolerância já usado para nome).
- Planilha geral atual sem `id_coluna` (upload anterior à feature) → bloqueia geração de auditoria com mensagem orientando reenvio.
- Relatório sem a coluna configurada → bloqueado no momento de anexar (erro imediato via toast) e checado de novo na geração de auditoria.
- Comparação de identificador é exata após `trim()` — sem normalização de caixa ou acentos (diferente do nome, que usa `normalizarNome`).
- Nome do aluno permanece sendo exibido normalmente nos resultados de auditoria — só deixa de ser usado como chave de casamento.

## Testes

Atualizar `lib/pente-fino.test.ts`:
- `carregarAlunos`: extrai `identificador` corretamente de uma coluna arbitrária; descarta linha com identificador vazio; dedup por identificador duplicado (mantém primeira ocorrência).
- `carregarRelatorio`: retorna `Set` de identificadores quando a coluna configurada existe; retorna `null` quando a coluna configurada está ausente (troca o teste que hoje usa `"Nome completo"` fixo por uma coluna de ID parametrizável).
- `extrairGruposRelatorio`: chave do `Map` é o identificador, não mais o nome normalizado.
- `calcularAusencias`/`calcularPresencas`: casamento por identificador — inclui caso de aluno com mesmo identificador mas nome diferente entre planilha geral e relatório (simulando troca de nome), confirmando que o cruzamento continua funcionando.

Testes novos/atualizados em `lib/gerar-auditoria.ts` (se houver suíte, ou cobertura manual documentada no plano): planilha geral sem `id_coluna` aborta geração; relatório ativo sem a coluna configurada aborta geração inteira (sem gerar auditoria parcial).

## Fora de escopo

- Não cria tela de edição linha a linha de alunos nem tabela `alunos` persistida — a edição do identificador continua sendo feita no próprio arquivo CSV antes do upload, como já acontece hoje com nome/empresa.
- Não normaliza nem valida o formato do identificador (aceita qualquer string não vazia).
- Não migra dados de auditorias já geradas — o `resultado_json` de auditorias antigas continua como está, só novas gerações usam o identificador.
- Não altera `AuditResultTable.tsx` nem a exibição dos resultados — resultados continuam mostrando nome, estado e empresa como hoje.
