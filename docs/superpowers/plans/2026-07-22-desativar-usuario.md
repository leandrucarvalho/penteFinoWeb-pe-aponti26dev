# Desativar (em vez de excluir) usuário — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a exclusão permanente de usuários (`deletarUsuario`, que quebra por violação de foreign key quando o usuário tem relatórios/planilhas associados) por uma desativação reversível via ban nativo do Supabase Auth, preservando todos os dados associados.

**Architecture:** `ban_duration` no `auth.admin.updateUserById()` para desativar/reativar (reversível, já enforced pelo GoTrue no login), mais uma function Postgres `revoke_user_sessions` (chamada via RPC) para derrubar sessões ativas no momento da desativação. A UI troca a lixeira por um alternador desativar/reativar com badge de status.

**Tech Stack:** Next.js 16 App Router (Server Actions), Supabase Auth Admin API, Postgres (migration com function `SECURITY DEFINER`), React 19.

Spec de referência: `docs/superpowers/specs/2026-07-22-desativar-usuario-design.md`

Projeto Supabase: `chuppzvaanyasljuknen` (aponti-pente-fino).

---

## File Structure

- **Create** `supabase/migrations/20260722162937_add_revoke_user_sessions_function.sql` — function `revoke_user_sessions(target_user_id uuid)`, `SECURITY DEFINER`, apaga sessões ativas do usuário.
- **Modify** `app/(protected)/configuracoes/usuarios/actions.ts` — remove `deletarUsuario`, adiciona `desativarUsuario`/`reativarUsuario`.
- **Modify** `app/(auth)/login/actions.ts` — mensagem específica para login de usuário desativado (`user_banned`).
- **Modify** `components/UsuariosList.tsx` — badge "Inativo" + alternador desativar/reativar no lugar da lixeira.

---

### Task 1: Migration — function `revoke_user_sessions`

**Files:**
- Create: `supabase/migrations/20260722162937_add_revoke_user_sessions_function.sql`

- [ ] **Step 1: Criar o arquivo de migration**

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

- [ ] **Step 2: Aplicar a migration no projeto Supabase**

Use a ferramenta MCP do Supabase (`apply_migration`) com `project_id: "chuppzvaanyasljuknen"`, `name: "add_revoke_user_sessions_function"`, e o SQL do Step 1 como `query`. Isso aplica a migration no banco remoto e já registra o arquivo correspondente.

> **Nota pós-implementação:** o `apply_migration` atribuiu o timestamp `20260722163959` (não o `20260722162937` usado no nome do arquivo local original, que era só o placeholder do momento em que este plano foi escrito). A revisão de qualidade de código pegou esse drift; o arquivo local foi renomeado no commit `c092779` para `supabase/migrations/20260722163959_add_revoke_user_sessions_function.sql`, batendo com o que está de fato registrado no Supabase.

- [ ] **Step 3: Verificar que a function foi criada e só o service_role pode chamá-la**

Rode via MCP `execute_sql` (project_id `chuppzvaanyasljuknen`):

```sql
select p.proname, p.prosecdef,
  (select array_agg(rolname) from pg_roles r
   where has_function_privilege(r.oid, p.oid, 'EXECUTE')
     and r.rolname in ('anon', 'authenticated', 'service_role')) as pode_chamar
from pg_proc p
where p.proname = 'revoke_user_sessions';
```

Expected: uma linha, `prosecdef = true`, `pode_chamar` contendo só `{service_role}` (não `anon` nem `authenticated`).

- [ ] **Step 4: Testar a function manualmente (não-destrutivo)**

Rode via MCP `execute_sql`:

```sql
select public.revoke_user_sessions('00000000-0000-0000-0000-000000000000'::uuid);
```

Expected: executa sem erro, retorna `void` (nenhuma sessão é afetada, já que esse UUID não existe — é só pra confirmar que a function roda sem erro de permissão/sintaxe).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260722162937_add_revoke_user_sessions_function.sql
git commit -m "feat: adicionar function para revogar sessoes de usuario"
```

---

### Task 2: `desativarUsuario`/`reativarUsuario` — Server Actions

**Files:**
- Modify: `app/(protected)/configuracoes/usuarios/actions.ts:95-110`
- Modify: `lib/system-log.ts` (`SystemLogAction` é um union fechado — precisa incluir as duas novas ações antes de compilar)

> **Nota pós-implementação:** esta task originalmente só listava `actions.ts`. Durante a execução, o `tsc` acusou que `'usuario.desativar'`/`'usuario.reativar'` não são membros válidos de `SystemLogAction` (`lib/system-log.ts`), um gap que passou batido na escrita do plano. A correção — adicionar as duas novas ações a `SystemLogAction`/`ACTION_LABELS`, mantendo `'usuario.deletar'` intacto (existem linhas históricas em `system_logs` com essa ação, usadas por `app/(protected)/configuracoes/logs/page.tsx`) — está incorporada no Step 1 abaixo.

O arquivo atual (linhas 95-110) tem:

```ts
export async function deletarUsuario(userId: string) {
  const admin = await verificarAdmin()
  if (admin.id === userId) throw new Error('Não é possível deletar seu próprio usuário')
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'usuario.deletar',
    target: userId,
  })

  revalidatePath('/configuracoes/usuarios')
}
```

- [ ] **Step 1: Substituir pelas duas novas actions**

Trocar o bloco acima por:

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

Note: a chamada a `supabase.rpc('revoke_user_sessions', ...)` não checa `error` de propósito — se a revogação de sessão falhar, o ban já foi aplicado com sucesso (login futuro bloqueado), e não vale a pena abortar a operação inteira ou confundir o admin por causa só da parte "derrubar agora". O `await` sem uso do retorno é intencional, não um descuido.

> **Nota pós-implementação:** a revisão de qualidade de código apontou que ignorar completamente o erro do RPC (sem nem logar) deixaria uma eventual quebra da function `revoke_user_sessions` invisível pra sempre. Correção aplicada no commit `d880c7c`: o erro passou a ser capturado e reportado via `console.error('revoke_user_sessions falhou', rpcError)`, mantendo o comportamento de não abortar a desativação.

- [ ] **Step 2: Atualizar `SystemLogAction`/`ACTION_LABELS` em `lib/system-log.ts`**

`SystemLogAction` é um union fechado; `'usuario.desativar'`/`'usuario.reativar'` usados no Step 1 não existem ainda. O arquivo atual tem:

```ts
export type SystemLogAction =
  | 'usuario.criar'
  | 'usuario.atualizar'
  | 'usuario.deletar'
  | 'relatorio.adicionar'
  | 'relatorio.deletar'
  | 'auditoria.gerar'
  | 'senha.alterar'
  | 'auth.login'
  | 'auth.logout'

export const ACTION_LABELS: Record<SystemLogAction, string> = {
  'usuario.criar': 'Criou usuário',
  'usuario.atualizar': 'Atualizou usuário',
  'usuario.deletar': 'Removeu usuário',
  'relatorio.adicionar': 'Adicionou relatório',
  'relatorio.deletar': 'Removeu relatório',
  'auditoria.gerar': 'Gerou auditoria',
  'senha.alterar': 'Alterou senha',
  'auth.login': 'Login',
  'auth.logout': 'Logout',
}
```

Substituir por:

```ts
export type SystemLogAction =
  | 'usuario.criar'
  | 'usuario.atualizar'
  | 'usuario.deletar'
  | 'usuario.desativar'
  | 'usuario.reativar'
  | 'relatorio.adicionar'
  | 'relatorio.deletar'
  | 'auditoria.gerar'
  | 'senha.alterar'
  | 'auth.login'
  | 'auth.logout'

export const ACTION_LABELS: Record<SystemLogAction, string> = {
  'usuario.criar': 'Criou usuário',
  'usuario.atualizar': 'Atualizou usuário',
  'usuario.deletar': 'Removeu usuário',
  'usuario.desativar': 'Desativou usuário',
  'usuario.reativar': 'Reativou usuário',
  'relatorio.adicionar': 'Adicionou relatório',
  'relatorio.deletar': 'Removeu relatório',
  'auditoria.gerar': 'Gerou auditoria',
  'senha.alterar': 'Alterou senha',
  'auth.login': 'Login',
  'auth.logout': 'Logout',
}
```

`'usuario.deletar'` **fica**, mesmo sem nada mais produzindo esse valor a partir desta branch — existem linhas históricas reais em `system_logs` com essa ação, e `ACTION_LABELS` é consultado por `app/(protected)/configuracoes/logs/page.tsx` pra renderizar cada linha; remover quebraria a exibição de entradas antigas.

- [ ] **Step 3: Verificar que não sobrou nenhuma referência a `deletarUsuario`**

Run: `grep -rn "deletarUsuario" app components --include="*.ts" --include="*.tsx"` (ou a ferramenta de busca do editor)
Expected: só a referência em `components/UsuariosList.tsx` (import e uso) — será corrigida na Task 4, que ainda não foi feita nesse ponto. Nenhuma outra ocorrência deve aparecer.

- [ ] **Step 4: Rodar lint e typecheck**

Run: `npx eslint "app/(protected)/configuracoes/usuarios/actions.ts" lib/system-log.ts`
Expected: sem erros.

Run: `npx tsc --noEmit`
Expected: erro esperado em `components/UsuariosList.tsx` (ainda importa `deletarUsuario`, que não existe mais) — corrigido na Task 4. Nenhum outro erro novo deve aparecer.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/configuracoes/usuarios/actions.ts" lib/system-log.ts
git commit -m "feat: substituir deletarUsuario por desativarUsuario/reativarUsuario"
```

---

### Task 3: Mensagem de login para usuário desativado

**Files:**
- Modify: `app/(auth)/login/actions.ts:20`

O arquivo atual (linha 20, dentro de `login`) tem:

```ts
  if (error || !data.user) return { error: 'Email ou senha inválidos' }
```

- [ ] **Step 1: Diferenciar o caso de usuário banido**

Trocar essa linha por:

```ts
  if (error || !data.user) {
    if (error?.code === 'user_banned') {
      return { error: 'Sua conta foi desativada. Entre em contato com o administrador.' }
    }
    return { error: 'Email ou senha inválidos' }
  }
```

`error.code` existe diretamente na classe base `AuthError` do `@supabase/supabase-js` (tipado como `ErrorCode | (string & {}) | undefined`), então não precisa de type guard nem cast — `'user_banned'` é um dos valores documentados de `ErrorCode`.

- [ ] **Step 2: Rodar lint e typecheck**

Run: `npx eslint "app/(auth)/login/actions.ts"`
Expected: sem erros.

Run: `npx tsc --noEmit`
Expected: mesmo estado da Task 2 (só o erro esperado em `UsuariosList.tsx`, nada novo).

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login/actions.ts"
git commit -m "feat: exibir mensagem especifica para login de usuario desativado"
```

---

### Task 4: `UsuariosList.tsx` — badge de status e alternador desativar/reativar

**Files:**
- Modify: `components/UsuariosList.tsx` (edições pontuais, arquivo inteiro tem 358 linhas hoje)

- [ ] **Step 1: Atualizar imports**

Localizar (linhas 27-40 atuais):

```tsx
import {
  Loader2,
  Shield,
  Trash2,
  User,
  Pencil,
  Phone,
  Briefcase,
  Tag,
} from 'lucide-react'
import {
  deletarUsuario,
  atualizarUsuario,
} from '@/app/(protected)/configuracoes/usuarios/actions'
```

Substituir por:

```tsx
import {
  Loader2,
  Shield,
  UserX,
  UserCheck,
  User,
  Pencil,
  Phone,
  Briefcase,
  Tag,
} from 'lucide-react'
import {
  desativarUsuario,
  reativarUsuario,
  atualizarUsuario,
} from '@/app/(protected)/configuracoes/usuarios/actions'
```

- [ ] **Step 2: Adicionar `banned_until` ao tipo `UsuarioItem`**

Localizar (linhas 42-48 atuais):

```tsx
type UsuarioItem = {
  id: string
  email?: string
  created_at: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}
```

Substituir por:

```tsx
type UsuarioItem = {
  id: string
  email?: string
  created_at: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  banned_until?: string | null
}
```

- [ ] **Step 3: Trocar `handleDelete` por `handleDesativar`/`handleReativar`**

Localizar (linhas 89-98 atuais):

```tsx
  function handleDelete(userId: string) {
    setPendingId(userId)
    startDelete(async () => {
      try {
        await deletarUsuario(userId)
      } finally {
        setPendingId(null)
      }
    })
  }
```

Substituir por:

```tsx
  function handleDesativar(userId: string) {
    setPendingId(userId)
    startDelete(async () => {
      try {
        await desativarUsuario(userId)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao desativar usuário')
      } finally {
        setPendingId(null)
      }
    })
  }

  function handleReativar(userId: string) {
    setPendingId(userId)
    startDelete(async () => {
      try {
        await reativarUsuario(userId)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao reativar usuário')
      } finally {
        setPendingId(null)
      }
    })
  }
```

Nota: o `handleDelete` original não tinha `catch` (o erro "Não é possível deletar seu próprio usuário" nunca aparecia na tela, já que o botão de excluir já ficava oculto para o próprio usuário — `{!isCurrentUser && (...)}`). Mantemos essa mesma proteção na Task 4 Step 5 abaixo, mas adicionamos o `catch` mesmo assim, como rede de segurança consistente com o resto do app (ex: erro de rede, sessão expirada no meio da ação).

- [ ] **Step 4: Calcular `isDesativado` dentro do `.map`**

Localizar (linhas 119-126 atuais):

```tsx
        {users.map((u) => {
          const role = (u.app_metadata?.role as string) ?? 'user'
          const nome = (u.user_metadata?.nome as string) ?? ''
          const telefone = (u.user_metadata?.telefone as string) ?? ''
          const cargo = (u.user_metadata?.cargo as string) ?? ''
          const funcao = (u.user_metadata?.funcao as string) ?? ''
          const isCurrentUser = u.id === currentUserId
          const isLoadingThis = pendingId === u.id && isDeleting
```

Substituir por:

```tsx
        {users.map((u) => {
          const role = (u.app_metadata?.role as string) ?? 'user'
          const nome = (u.user_metadata?.nome as string) ?? ''
          const telefone = (u.user_metadata?.telefone as string) ?? ''
          const cargo = (u.user_metadata?.cargo as string) ?? ''
          const funcao = (u.user_metadata?.funcao as string) ?? ''
          const isCurrentUser = u.id === currentUserId
          const isLoadingThis = pendingId === u.id && isDeleting
          const isDesativado = !!u.banned_until && new Date(u.banned_until) > new Date()
```

- [ ] **Step 5: Adicionar a badge "Inativo"**

Localizar o bloco de badges (linhas 151-165 atuais):

```tsx
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium truncate">
                      {nome || u.email?.split('@')[0] || '—'}
                    </p>
                    {role === 'admin' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide shrink-0">
                        admin
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        você
                      </span>
                    )}
                  </div>
```

Substituir por:

```tsx
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium truncate">
                      {nome || u.email?.split('@')[0] || '—'}
                    </p>
                    {role === 'admin' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide shrink-0">
                        admin
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        você
                      </span>
                    )}
                    {isDesativado && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive uppercase tracking-wide shrink-0">
                        inativo
                      </span>
                    )}
                  </div>
```

- [ ] **Step 6: Trocar o botão de lixeira pelo alternador desativar/reativar**

Localizar o bloco inteiro do botão de exclusão (linhas 211-243 atuais):

```tsx
                    {!isCurrentUser && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            />
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deletar usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O usuário <strong>{nome || u.email}</strong> será removido
                              permanentemente. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(u.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Deletar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
```

Substituir por:

```tsx
                    {!isCurrentUser && isDesativado && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => handleReativar(u.id)}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {!isCurrentUser && !isDesativado && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            />
                          }
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O usuário <strong>{nome || u.email}</strong> perderá o acesso ao
                              sistema. Sessões abertas são encerradas imediatamente quando
                              possível, mas um token de acesso já emitido pode continuar válido
                              por até 1 hora. Você pode reativar o acesso depois, a qualquer
                              momento.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDesativar(u.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Desativar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
```

Note que reativar (botão simples, sem `AlertDialog`) não passa por confirmação — é a ação de baixo risco que desfaz a desativação, consistente com o spec.

- [ ] **Step 7: Rodar lint e typecheck**

Run: `npx eslint components/UsuariosList.tsx`
Expected: sem erros (confirma que `Trash2` não ficou como import não usado).

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add components/UsuariosList.tsx
git commit -m "feat: trocar exclusao de usuario por desativar/reativar na UI"
```

---

### Task 5: Verificação manual e fechamento

**Files:** nenhum (só verificação; sem alterações de código esperadas nesta task)

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes continuam passando (nenhum teste novo é esperado — `desativarUsuario`/`reativarUsuario` dependem de `SupabaseClient` real, mesma situação já aceita para as outras Server Actions deste projeto).

- [ ] **Step 2: Rodar lint e build do projeto inteiro**

Run: `npm run lint`
Expected: sem erros novos (podem existir avisos/erros pré-existentes em arquivos não tocados por esta branch).

Run: `npm run build`
Expected: build passa.

- [ ] **Step 3: Testar o caminho de desativar**

Run: `npm run dev`, logar como admin, abrir `/configuracoes/usuarios`.

Checklist:
- Escolher um usuário de teste que **não** seja o admin logado atual (ex: um usuário sem relatórios/planilhas associados, criado especificamente para este teste — não usar uma conta com dados reais associados).
- Clicar no ícone de desativar (UserX) → confirmar no `AlertDialog` → usuário passa a exibir a badge "Inativo" e o ícone vira UserCheck.
- Tentar logar com esse usuário (email/senha corretos) → deve aparecer "Sua conta foi desativada. Entre em contato com o administrador." em vez de "Email ou senha inválidos".
- Confirmar em `/configuracoes/logs` que apareceu uma entrada `usuario.desativar` com o admin correto.

- [ ] **Step 4: Testar o caminho de reativar**

Checklist:
- No mesmo usuário desativado, clicar no ícone UserCheck (sem confirmação) → badge "Inativo" some, ícone volta a ser UserX.
- Logar novamente com esse usuário → deve funcionar normalmente.
- Confirmar em `/configuracoes/logs` a entrada `usuario.reativar`.

- [ ] **Step 5: Confirmar que o bug de FK original não acontece mais**

Checklist:
- Desativar um usuário que **tem** relatórios/planilhas associados (ex: `leandrucs@gmail.com`, usado durante a investigação do bug original) — deve funcionar sem nenhum erro, já que a linha de `auth.users` nunca é removida.
- Confirmar que os relatórios/planilhas desse usuário continuam existindo normalmente em `/relatorios` e `/configuracoes` depois da desativação.
- Reativar esse mesmo usuário ao final do teste, para não deixar uma conta real desativada.

- [ ] **Step 6: Se tudo passou, seguir para push + PR**

Use a skill `finishing-a-development-branch` (branch base: `develop`) para dar push e abrir o PR. Nenhum commit é esperado nesta task a menos que a verificação manual encontre um problema — nesse caso, corrija, repita os passos 1-2, e só então prossiga.

---

## Fora de escopo (herdado da spec)

- Não adiciona tela/filtro separado para usuários desativados — continuam na mesma lista, com badge.
- Não expõe motivo/data da desativação na UI — só o estado atual. Fica registrado em `system_logs` para quem precisar consultar.
- Não adiciona exclusão permanente como opção alternativa em nenhum lugar da UI — foi removida por completo.
- Não migra os dados de `planilha_geral`/`relatorios` de usuários já desativados para outro dono.
