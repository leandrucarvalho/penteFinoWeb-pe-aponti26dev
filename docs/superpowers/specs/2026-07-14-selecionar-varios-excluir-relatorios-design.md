# Selecionar vários e excluir relatórios em lote

## Contexto

`components/RelatoriosList.tsx` mostra os relatórios ativos como uma lista de cards, cada um com um botão de lixeira individual que abre um `AlertDialog` de confirmação e chama `deletarRelatorio(id)` (`app/(protected)/relatorios/actions.ts`). Depois da exclusão, um segundo diálogo pergunta se o admin quer gerar a auditoria agora (`gerarAuditoriaManual('delete', relatorioExcluidoId)`).

Não existe hoje nenhuma forma de selecionar vários relatórios e excluir de uma vez — é um clique de confirmação por item. Esta mudança acontece na mesma branch/PR que acabou de implementar o anexo de vários relatórios de uma vez (`adicionarRelatorios`), então segue os mesmos padrões já estabelecidos ali: tolerância a falha parcial em lote, `{ sucesso, falhas }` como formato de retorno, e um único diálogo de "gerar auditoria?" no final cobrindo o lote inteiro.

Não existe ainda um componente `Checkbox` neste projeto (`components/ui/`). Os componentes de UI existentes (`Select`, `Badge`, `Input`, `AlertDialog` etc.) foram todos adicionados via CLI do shadcn (`components.json` já configurado), sobre `@base-ui/react`.

## Objetivo

Permitir selecionar vários relatórios ativos e excluí-los numa única confirmação, mantendo a exclusão individual (lixeira por linha) já existente.

## Arquitetura

### `components/ui/checkbox.tsx` (novo)

Adicionado via `npx shadcn add checkbox`, consistente com o restante da UI do projeto — não escrito à mão, para garantir que segue o mesmo padrão (Base UI, variantes, dark mode) dos componentes já instalados.

### `app/(protected)/relatorios/actions.ts`

`deletarRelatorio(relatorioId: string)` é substituída por `deletarRelatorios(relatorioIds: string[])` — mesma ideia de `adicionarRelatorio` → `adicionarRelatorios`: uma função cobre 1 ou N IDs, já que a exclusão individual também passa a usar essa mesma action (com array de 1 elemento), evitando duplicar a lógica de soft-delete + log.

```ts
export async function deletarRelatorios(
  relatorioIds: string[]
): Promise<{ sucesso: string[]; falhas: { id: string; erro: string }[] }>
```

Fluxo: `verificarAdmin()` → para cada ID, em sequência, faz o soft-delete (`update({ deleted_at: ... }).eq('id', id)`); erro nesse update empurra pra `falhas` e continua pro próximo ID (não aborta o lote); sucesso chama `registrarLog` e empurra pra `sucesso`. Ao final, `revalidatePath('/relatorios')` uma vez (só se `sucesso.length > 0`), retorna `{ sucesso, falhas }`.

`gerarAuditoriaManual` e `adicionarRelatorios` não mudam.

### `components/RelatoriosList.tsx`

- Novo estado `selecionados: Set<string>` (IDs marcados).
- `todosSelecionados = relatorios.length > 0 && selecionados.size === relatorios.length`; `algunsSelecionados = selecionados.size > 0 && !todosSelecionados` (estado indeterminado do checkbox "selecionar todos").
- Barra acima da `<ul>`: checkbox "selecionar todos" (marca/desmarca todos de uma vez) + texto (contador de selecionados, ou "Selecionar todos" quando zero) + botão "Excluir selecionados (N)" (só aparece quando `selecionados.size > 0`), com `AlertDialog` de confirmação própria (texto: "Isso vai remover N relatório(s). Esta ação não pode ser desfeita.").
- Cada `<li>` ganha um `Checkbox` antes do ícone do arquivo, marcando/desmarcando aquele ID em `selecionados`.
- A lixeira individual continua existindo em cada linha, com seu próprio `AlertDialog` de confirmação — só que agora chama a mesma função interna de exclusão (`excluir([r.id])`) usada pelo botão em lote, em vez de ter sua própria implementação.
- Função interna `excluir(ids: string[])`: chama `deletarRelatorios(ids)`, mostra um `toast.error` por item em `falhas`, remove de `selecionados` os IDs que tiveram sucesso, e — se `sucesso.length > 0` — guarda esses IDs num novo estado (substitui o atual `relatorioExcluidoId: string | null` por `idsExcluidos: string[] | null`) que abre o diálogo final de "gerar auditoria?".
- Diálogo final: texto no plural quando `idsExcluidos.length > 1` (ex: "3 relatórios foram excluídos. Deseja gerar a auditoria agora?"), `gerarAuditoriaManual('delete', idsExcluidos.length === 1 ? idsExcluidos[0] : null)` — mesma convenção do `null` para lote já usada em `adicionarRelatorios`/`AdicionarRelatorioForm.tsx`.

## Fluxo de dados (resumo)

```
admin marca checkboxes (ou marca "selecionar todos")
        │
        ▼
clica "Excluir selecionados (N)" → confirma no AlertDialog
        │
        ▼
excluir([...selecionados]) → deletarRelatorios(ids)
        │
        ├─► falhas.length > 0  → 1 toast.error por item que falhou
        │
        └─► sucesso.length > 0 → remove esses IDs de `selecionados`
                                  → abre diálogo "gerar auditoria?"
                                     (plural se sucesso.length > 1,
                                      relatorioTriggerId = null nesse caso)

(exclusão individual pela lixeira segue o mesmo caminho, com ids = [um só ID])
```

## Tratamento de erros / casos de borda

- Excluir um relatório que já foi excluído por outra aba/sessão simultaneamente: o `update` no Supabase não dá erro (linha já tem `deleted_at` preenchido, o `update` só reafirma o mesmo valor ou não encontra a linha pelo filtro — comportamento de soft-delete idempotente já existente hoje, inalterado). Não é tratado como falha.
- Lista vazia (nenhum relatório ativo): checkbox "selecionar todos" fica desabilitado (nada pra selecionar); a barra de seleção não teria efeito prático mas pode continuar renderizada sem problema.
- Falha parcial no lote: itens com sucesso são removidos de `selecionados` e da lista (via `revalidatePath`); itens com falha continuam selecionados e visíveis na lista, com o toast explicando o motivo — admin pode tentar excluir de novo.

## Testes

`deletarRelatorios` depende de `SupabaseClient` real — sem suíte automatizada, mesma situação já aceita para `adicionarRelatorios`/`gerarAuditoria` neste projeto. Verificação manual no plano de implementação.

## Fora de escopo

- Não adiciona exclusão em lote em nenhuma outra tela (ex: `/auditorias`, `/configuracoes/usuarios`) — só na lista de relatórios ativos.
- Não adiciona atalhos de teclado (shift-click pra selecionar intervalo, etc.).
- Não muda o comportamento de soft-delete em si (continua marcando `deleted_at`, sem exclusão física).
