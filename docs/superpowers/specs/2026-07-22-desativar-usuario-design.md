# Desativar (em vez de excluir) usuário

## Contexto

Hoje `deletarUsuario` (`app/(protected)/configuracoes/usuarios/actions.ts`) chama `supabase.auth.admin.deleteUser(userId)`, removendo a linha de `auth.users` permanentemente. Isso quebra sempre que o usuário tem linhas em `planilha_geral` ou `relatorios` — essas duas tabelas têm FK pra `auth.users(id)` sem `ON DELETE` configurado (diferente de `profiles`, que tem `CASCADE`, e `system_logs`, que tem `SET NULL`), então o Postgres recusa a exclusão com uma violação de constraint. O erro chega no browser como `{}` porque o GoTrue devolve um corpo malformado quando o erro de origem é do Postgres em vez de um erro nativo dele.

Em vez de mexer nas FKs pra permitir a exclusão (o que apagaria/orfanaria dados de auditoria), a decisão é trocar a exclusão permanente por uma desativação reversível — protege os dados associados ao usuário e evita esse bug por completo, já que a linha de `auth.users` nunca é removida.

## Objetivo

Substituir a exclusão permanente de usuários por desativação de acesso (reversível), preservando todos os dados associados (relatórios, planilhas, logs).

## Arquitetura

### Mecanismo: ban nativo do Supabase Auth

`supabase.auth.admin.updateUserById(userId, { ban_duration })` — recurso já embutido no GoTrue:
- `ban_duration: '876000h'` (~100 anos, convenção usada na própria documentação do SDK para "banir indefinidamente") desativa.
- `ban_duration: 'none'` reativa.
- O GoTrue já rejeita login de usuário banido automaticamente, com um código de erro próprio (`user_banned`), sem precisar de checagem manual em `login()`.
- `banned_until` já vem de graça em `listUsers()` — a função `UsuariosPage` já chama isso hoje, não precisa de query nova nem coluna nova em `profiles`.

### Revogação de sessão ativa

Banir bloqueia login futuro e renovação de token, mas o *access token* já emitido (curta duração, padrão ~1h) continua válido até expirar — limitação normal de JWT, não é possível revogar instantaneamente sem custo extra de infraestrutura. Pra chegar o mais perto possível de "agora", a ação de desativar também apaga as sessões ativas do usuário (`auth.sessions`), derrubando o refresh token na hora. O acesso residual dura, no pior caso, até a expiração do token corrente — isso fica explícito no texto de confirmação pro admin.

`auth.sessions` não é exposta via REST/`supabase-js` diretamente, então a revogação precisa de uma function no Postgres:

**Nova migration** `supabase/migrations/<timestamp>_add_revoke_user_sessions_function.sql`:

```sql
create or replace function public.revoke_user_sessions(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = target_user_id;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
```

Chamada via `supabase.rpc('revoke_user_sessions', { target_user_id: userId })` usando o client de service role (mesmo client já usado pra `updateUserById`).

### `app/(protected)/configuracoes/usuarios/actions.ts`

`deletarUsuario` é removida. Duas novas actions:

```ts
export async function desativarUsuario(userId: string) {
  const admin = await verificarAdmin()
  if (admin.id === userId) throw new Error('Não é possível desativar seu próprio usuário')

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })
  if (error) throw new Error(error.message)

  await supabase.rpc('revoke_user_sessions', { target_user_id: userId })

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'usuario.desativar',
    target: userId,
  })

  revalidatePath('/configuracoes/usuarios')
}

export async function reativarUsuario(userId: string) {
  const admin = await verificarAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (error) throw new Error(error.message)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'usuario.reativar',
    target: userId,
  })

  revalidatePath('/configuracoes/usuarios')
}
```

A chamada a `revoke_user_sessions` não precisa de tratamento de erro próprio: se falhar, o ban já foi aplicado (login futuro bloqueado) — só o "derrubar na hora" fica comprometido, o que não justifica abortar a operação inteira nem confundir o admin com um erro. Um `await` sem checar `error` é suficiente aqui; se o RPC falhar, ele resolve normalmente (o cliente Supabase não lança exceção nesse caso), então não há necessidade de silenciar nada.

> **Nota pós-implementação:** "não precisa de tratamento" acabou sendo half-certo — não precisa *abortar* a operação, mas ignorar o erro por completo deixaria uma falha real do RPC (ex: permissão revogada num ambiente específico) completamente invisível pra sempre. A revisão de qualidade de código pegou isso; o erro passou a ser capturado e logado via `console.error`, sem alterar a decisão de não abortar (commit `d880c7c`).

### `app/(auth)/login/actions.ts`

Sem mudança de lógica — só a mensagem de erro passa a diferenciar o caso `user_banned`:

```ts
if (error || !data.user) {
  if (error?.code === 'user_banned') {
    return { error: 'Sua conta foi desativada. Entre em contato com o administrador.' }
  }
  return { error: 'Email ou senha inválidos' }
}
```

### `components/UsuariosList.tsx`

- `UsuarioItem` ganha `banned_until?: string | null`.
- `isDesativado = !!u.banned_until && new Date(u.banned_until) > new Date()`.
- Badge "Inativo" (estilo similar às badges de `admin`/`você` já existentes) quando `isDesativado`.
- O botão de lixeira vira condicional:
  - Ativo → ícone `UserX`, abre `AlertDialog` de confirmação com texto atualizado (explica que é reversível e sobre a limitação do token residual), chama `desativarUsuario(u.id)`.
  - Desativado → ícone `UserCheck`, sem `AlertDialog` (ação de baixo risco, é a reversão) — chama `reativarUsuario(u.id)` direto no clique.
- Import troca `deletarUsuario` por `desativarUsuario, reativarUsuario`; ícone `Trash2` sai, entram `UserX`, `UserCheck`.

### `app/(protected)/configuracoes/usuarios/page.tsx`

Sem mudança estrutural — `listUsers()` já retorna `banned_until` dentro de cada `User`; só precisa passar adiante (o tipo `UsuarioItem` já cobre isso via o ajuste acima).

## Fluxo de dados (resumo)

```
admin clica UserX numa linha ativa → confirma no AlertDialog
        │
        ▼
desativarUsuario(userId)
        │
        ├─► updateUserById(ban_duration: '876000h')  → bloqueia login/refresh futuro
        ├─► rpc revoke_user_sessions(userId)          → derruba sessão ativa (best-effort)
        └─► registrarLog('usuario.desativar')
        │
        ▼
revalidatePath → lista recarrega → usuário aparece com badge "Inativo" e UserCheck no lugar do UserX

(reativar é o caminho inverso, sem confirmação e sem revoke de sessão)

usuário desativado tenta logar → GoTrue retorna user_banned → login() mostra
"Sua conta foi desativada. Entre em contato com o administrador."
```

## Tratamento de erros / casos de borda

- Admin tentando desativar a própria conta: bloqueado com mensagem clara (mesmo padrão do guard atual, só que agora é "desativar" em vez de "deletar").
- `revoke_user_sessions` falhando (ex: função ainda não migrada em algum ambiente): não aborta `desativarUsuario` — o ban em si já é suficiente pra bloquear acesso futuro, só a parte "imediata" fica degradada.
- Usuário sem nenhuma sessão ativa no momento da desativação: `delete from auth.sessions where user_id = ...` simplesmente não afeta nenhuma linha, sem erro.
- Reativar um usuário que nunca foi desativado (`banned_until` null): `ban_duration: 'none'` é idempotente, não há erro.
- Nenhuma mudança de schema em `planilha_geral`/`relatorios`/`profiles`/`system_logs` — o bug de FK original deixa de ser alcançável porque a única forma de "remover" um usuário passa a ser o ban, que nunca deleta a linha de `auth.users`.

## Testes

`desativarUsuario`/`reativarUsuario` dependem de `SupabaseClient` real (admin API + RPC) — sem suíte automatizada, mesma situação já aceita pras outras Server Actions deste projeto. Verificação manual no plano de implementação.

## Fora de escopo

- Não adiciona nenhuma tela/filtro separado para usuários desativados — continuam na mesma lista, com badge.
- Não expõe motivo/data da desativação na UI (ex: "desativado em 22/07 por Fulano") — só o estado atual (ativo/inativo). Fica registrado no log de ações (`system_logs`) pra quem precisar consultar.
- Não adiciona exclusão permanente como opção alternativa em nenhum lugar da UI — foi removida por completo.
- Não migra os dados de `planilha_geral`/`relatorios` de usuários já desativados para outro dono — o `user_id` continua apontando pro usuário desativado, exatamente como antes.
