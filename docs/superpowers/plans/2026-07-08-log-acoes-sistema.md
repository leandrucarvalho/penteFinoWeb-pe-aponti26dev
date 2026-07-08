# Log de ações do sistema + tela de administração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar ações administrativas e de negócio (quem fez o quê e quando) numa nova tabela `system_logs`, e oferecer uma tela `/configuracoes/logs`, restrita a administradores, para consultar esse histórico.

**Architecture:** Uma migration versionada (primeira do projeto) cria `system_logs` com RLS (leitura só-admin, escrita só via service client). Um helper `lib/system-log.ts` (`registrarLog`, best-effort, nunca lança) é chamado ao final de cada Server Action relevante. Login (hoje 100% client-side) vira Server Action para poder ser logado. A tela admin usa paginação no servidor (`.range()`), não client-side como `AuditResultTable`.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `useActionState`), Supabase (Postgres + RLS, aplicado via MCP), TypeScript.

Spec: `docs/superpowers/specs/2026-07-08-log-acoes-sistema-design.md`

Projeto Supabase: `chuppzvaanyasljuknen` (org `aponti-pente-fino`) — confirme que o MCP do Supabase está conectado a este projeto (`mcp__claude_ai_Supabase__list_projects`) antes de aplicar qualquer coisa.

---

### Task 1: Migration `system_logs`

**Files:**
- Create: `supabase/migrations/<version>_create_system_logs.sql` (pasta nova — primeiro precedente de migration versionada no projeto)

Esta task usa ferramentas MCP do Supabase, não comandos de terminal. Se as ferramentas `mcp__claude_ai_Supabase__*` não aparecerem disponíveis diretamente, use a ferramenta `ToolSearch` com a query `"select:mcp__claude_ai_Supabase__apply_migration,mcp__claude_ai_Supabase__list_migrations,mcp__claude_ai_Supabase__list_tables"` para carregá-las antes de chamá-las.

- [ ] **Step 1: Confirmar o projeto Supabase correto**

Chame `mcp__claude_ai_Supabase__list_projects`. Confirme que a lista contém um projeto com `id`/`ref` igual a `chuppzvaanyasljuknen` e `name` igual a `aponti-pente-fino`. Se esse projeto não aparecer na lista, PARE e reporte BLOCKED — não aplique a migration no projeto errado.

- [ ] **Step 2: Aplicar a migration via MCP**

Chame `mcp__claude_ai_Supabase__apply_migration` com:
- `project_id`: `chuppzvaanyasljuknen`
- `name`: `create_system_logs`
- `query`:

```sql
create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  action text not null,
  target text,
  details jsonb
);

alter table public.system_logs enable row level security;

create policy "Admins podem ler logs"
  on public.system_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid() and profiles.role = 'admin'
    )
  );
```

- [ ] **Step 3: Descobrir a versão atribuída à migration**

Chame `mcp__claude_ai_Supabase__list_migrations` com `project_id: chuppzvaanyasljuknen`. Encontre na resposta a migration com `name` igual a `create_system_logs` e anote seu `version` (um número tipo `20260708...`, mesmo formato dos 3 já existentes: `20260618133207`, `20260618135939`, `20260701174149`).

- [ ] **Step 4: Verificar a tabela criada**

Chame `mcp__claude_ai_Supabase__list_tables` com `project_id: chuppzvaanyasljuknen`, `schemas: ["public"]`, `verbose: true`. Confirme que `public.system_logs` aparece na resposta com `rls_enabled: true` e as 7 colunas (`id`, `created_at`, `user_id`, `user_email`, `action`, `target`, `details`). Se algo estiver diferente do esperado, reporte BLOCKED com o que a resposta realmente mostrou.

- [ ] **Step 5: Criar o arquivo local da migration**

Crie a pasta `supabase/migrations/` (não existe ainda) e o arquivo
`supabase/migrations/<version>_create_system_logs.sql` (usando o `version` exato do Step 3) com o **mesmo SQL** usado no Step 2, byte a byte.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: adicionar migration da tabela system_logs"
```

---

### Task 2: Helper `registrarLog`

**Files:**
- Create: `lib/system-log.ts`

Sem teste automatizado nesta task: o único "dado" que teria valor testar
(`ACTION_LABELS` cobrir todo `SystemLogAction`) já é garantido em tempo de
compilação pelo tipo `Record<SystemLogAction, string>` — se faltar uma chave, o
`tsc` já falha. `registrarLog` em si só faz uma chamada ao Supabase (sem lógica
pura para isolar); será exercitado indiretamente nas Tasks 3-7 e verificado depois
com `tsc`/`build`.

- [ ] **Step 1: Criar `lib/system-log.ts`**

```ts
import { createServiceClient } from '@/lib/supabase/server'

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

export async function registrarLog(params: {
  userId: string
  userEmail: string
  action: SystemLogAction
  target?: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('system_logs').insert({
      user_id: params.userId,
      user_email: params.userEmail,
      action: params.action,
      target: params.target ?? null,
      details: params.details ?? null,
    })
  } catch {
    // Log é best-effort: uma falha aqui nunca deve derrubar a ação principal.
  }
}
```

- [ ] **Step 2: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/system-log.ts
git commit -m "feat: adicionar helper registrarLog para log de acoes do sistema"
```

---

### Task 3: Log em `configuracoes/usuarios/actions.ts`

**Files:**
- Modify: `app/(protected)/configuracoes/usuarios/actions.ts`

Chame `registrarLog` sempre **depois** que a operação principal já teve sucesso (nunca antes, e nunca se a operação falhou).

- [ ] **Step 1: Importar o helper**

No topo do arquivo, troque:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
```

por:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { registrarLog } from '@/lib/system-log'
```

- [ ] **Step 2: Logar `criarUsuario`**

Troque:

```ts
    if (error) return { error: error.message }

    revalidatePath('/configuracoes/usuarios')
    return { success: true }
```

por:

```ts
    if (error) return { error: error.message }

    const admin = await verificarAdmin()
    await registrarLog({
      userId: admin.id,
      userEmail: admin.email!,
      action: 'usuario.criar',
      target: email,
    })

    revalidatePath('/configuracoes/usuarios')
    return { success: true }
```

Nota: `verificarAdmin()` já foi chamado no início da função — chamar de novo aqui é redundante em termos de autorização, mas é a forma mais simples de obter o `admin` (id/email de quem está fazendo a ação) sem alterar a assinatura da função ou guardar a variável antes. `verificarAdmin()` é barato (uma consulta ao usuário autenticado já em cache da requisição) — não é um problema de performance real.

- [ ] **Step 3: Logar `atualizarUsuario`**

Troque:

```ts
export async function atualizarUsuario(
  userId: string,
  data: { nome: string; telefone: string; cargo: string; funcao: string; role: 'admin' | 'user' }
) {
  await verificarAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { nome: data.nome, telefone: data.telefone, cargo: data.cargo, funcao: data.funcao },
    app_metadata: { role: data.role },
  })
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/usuarios')
}
```

por:

```ts
export async function atualizarUsuario(
  userId: string,
  data: { nome: string; telefone: string; cargo: string; funcao: string; role: 'admin' | 'user' }
) {
  const admin = await verificarAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { nome: data.nome, telefone: data.telefone, cargo: data.cargo, funcao: data.funcao },
    app_metadata: { role: data.role },
  })
  if (error) throw new Error(error.message)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'usuario.atualizar',
    target: userId,
    details: { role: data.role },
  })

  revalidatePath('/configuracoes/usuarios')
}
```

- [ ] **Step 4: Logar `deletarUsuario`**

Troque:

```ts
export async function deletarUsuario(userId: string) {
  const admin = await verificarAdmin()
  if (admin.id === userId) throw new Error('Não é possível deletar seu próprio usuário')
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/usuarios')
}
```

por:

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

- [ ] **Step 5: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/configuracoes/usuarios/actions.ts"
git commit -m "feat: registrar log de acoes de usuarios (criar/atualizar/deletar)"
```

---

### Task 4: Log em `relatorios/actions.ts`

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts`

- [ ] **Step 1: Importar o helper**

Troque:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarAuditoria } from '@/lib/gerar-auditoria'
```

por:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarAuditoria } from '@/lib/gerar-auditoria'
import { registrarLog } from '@/lib/system-log'
```

- [ ] **Step 2: Logar `adicionarRelatorio`**

Troque:

```ts
    if (insertError) return { error: `Erro ao registrar: ${insertError.message}` }

    revalidatePath('/relatorios')
    return { success: true, relatorioId }
```

por:

```ts
    if (insertError) return { error: `Erro ao registrar: ${insertError.message}` }

    await registrarLog({
      userId: user.id,
      userEmail: user.email!,
      action: 'relatorio.adicionar',
      target: relatorioId,
      details: { nome, semana },
    })

    revalidatePath('/relatorios')
    return { success: true, relatorioId }
```

- [ ] **Step 3: Logar `deletarRelatorio`**

Troque:

```ts
export async function deletarRelatorio(relatorioId: string) {
  await verificarAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('relatorios')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', relatorioId)

  if (error) throw new Error(`Erro ao deletar: ${error.message}`)

  revalidatePath('/relatorios')
}
```

por:

```ts
export async function deletarRelatorio(relatorioId: string) {
  const admin = await verificarAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('relatorios')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', relatorioId)

  if (error) throw new Error(`Erro ao deletar: ${error.message}`)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'relatorio.deletar',
    target: relatorioId,
  })

  revalidatePath('/relatorios')
}
```

- [ ] **Step 4: Logar `gerarAuditoriaManual`**

Troque:

```ts
export async function gerarAuditoriaManual(
  triggerType: 'add' | 'delete' | 'manual',
  relatorioTriggerId: string | null
): Promise<{ error?: string; success?: boolean }> {
  try {
    await verificarAdmin()
    const supabase = await createClient()

    await gerarAuditoria(triggerType, relatorioTriggerId, supabase)

    revalidatePath('/relatorios')
    revalidatePath('/auditorias')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
```

por:

```ts
export async function gerarAuditoriaManual(
  triggerType: 'add' | 'delete' | 'manual',
  relatorioTriggerId: string | null
): Promise<{ error?: string; success?: boolean }> {
  try {
    const admin = await verificarAdmin()
    const supabase = await createClient()

    await gerarAuditoria(triggerType, relatorioTriggerId, supabase)

    await registrarLog({
      userId: admin.id,
      userEmail: admin.email!,
      action: 'auditoria.gerar',
      details: { triggerType, relatorioTriggerId },
    })

    revalidatePath('/relatorios')
    revalidatePath('/auditorias')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
```

Nota: não há um `auditId` fácil de usar como `target` aqui — `gerarAuditoria` não
retorna o id gerado internamente (ele é criado dentro da função, em
`lib/gerar-auditoria.ts`). Usar `details: { triggerType, relatorioTriggerId }` no
lugar é suficiente para o escopo desta issue; não alterar a assinatura de
`gerarAuditoria` só para expor o id (fora de escopo).

- [ ] **Step 5: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts"
git commit -m "feat: registrar log de acoes de relatorios e geracao de auditoria"
```

---

### Task 5: Log em `perfil/actions.ts`

**Files:**
- Modify: `app/(protected)/perfil/actions.ts`

- [ ] **Step 1: Importar o helper**

Troque:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
```

por:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { registrarLog } from '@/lib/system-log'
```

- [ ] **Step 2: Logar `alterarSenha`**

Troque:

```ts
  const { error } = await supabase.auth.updateUser({ password: novaSenha })

  if (error) return { error: 'Não foi possível atualizar a senha. Tente novamente.' }

  return {}
}
```

por:

```ts
  const { error } = await supabase.auth.updateUser({ password: novaSenha })

  if (error) return { error: 'Não foi possível atualizar a senha. Tente novamente.' }

  await registrarLog({
    userId: user.id,
    userEmail: user.email,
    action: 'senha.alterar',
    target: user.id,
  })

  return {}
}
```

(Esse é o final de `alterarSenha` — a última função do arquivo, então não há
ambiguidade sobre qual `return {}` está sendo trocado.)

- [ ] **Step 3: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/perfil/actions.ts"
git commit -m "feat: registrar log de alteracao de senha"
```

---

### Task 6: Login como Server Action + log de login/logout

**Files:**
- Create: `app/(auth)/login/actions.ts`
- Modify: `app/(auth)/login/page.tsx` (rewrite completo — arquivo pequeno, mais claro que um diff)
- Modify: `app/api/auth/signout/route.ts`

- [ ] **Step 1: Criar `app/(auth)/login/actions.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { registrarLog } from '@/lib/system-log'

export async function login(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const email = formData.get('email') as string
  const senha = formData.get('senha') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (error || !data.user) return { error: 'Email ou senha inválidos' }

  await registrarLog({
    userId: data.user.id,
    userEmail: data.user.email!,
    action: 'auth.login',
    target: data.user.id,
  })

  redirect('/dashboard')
}
```

- [ ] **Step 2: Reescrever `app/(auth)/login/page.tsx`**

Conteúdo completo do arquivo (substitui o arquivo inteiro):

```tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from './actions'
import { Logomark } from '@/components/Logomark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, ShieldCheck, BarChart3, FileText } from 'lucide-react'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[oklch(0.301_0.215_292)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle, white 1.5px, transparent 1.5px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-1/3 -left-16 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-56 h-56 rounded-full bg-accent/25 blur-2xl" />

        <div className="relative flex items-center gap-2">
          <Logomark className="w-7 h-7 text-white" />
          <span className="text-2xl font-bold tracking-tight">Aponti</span>
        </div>

        <div className="relative space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight">
            Pente Fino
          </h1>
          <p className="text-primary-foreground/65 text-base leading-relaxed max-w-xs">
            Auditoria automática de relatórios Moodle. Identifique ausências e presenças em segundos.
          </p>

          <div className="pt-4 space-y-3">
            {[
              { icon: BarChart3, text: 'Histórico completo de auditorias' },
              { icon: FileText, text: 'Upload de relatórios CSV do Moodle' },
              { icon: ShieldCheck, text: 'Acesso por perfil (admin / visualizador)' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-primary-foreground/70 text-sm">
                <Icon className="w-4 h-4 shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-primary-foreground/40 text-xs">
          © {new Date().getFullYear()} Aponti Academy
        </div>
      </div>

      {/* Painel de formulário */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <Logomark className="w-7 h-7 text-primary" />
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-[oklch(0.710_0.191_294)] bg-clip-text text-transparent">
                Aponti
              </span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Entrar</h2>
            <p className="text-muted-foreground text-sm">
              Use suas credenciais de acesso
            </p>
          </div>

          <form action={action} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={pending}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <PasswordInput
                id="senha"
                name="senha"
                required
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={pending}
                className="h-11"
              />
              <div className="flex justify-end">
                <Link
                  href="/esqueci-senha"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            {state?.error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {state.error}
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

Mudanças em relação ao arquivo anterior: removidos `useState`/`useRouter`/
`createClient` (client-side) e `handleLogin`; `email`/`senha` agora são inputs não
controlados (`name="email"`/`name="senha"`, lidos via `FormData` no Server Action);
`useActionState(login, null)` substitui o estado local de `erro`/`loading`; o
`<form onSubmit={handleLogin}>` vira `<form action={action}>`.

- [ ] **Step 3: Logar logout em `app/api/auth/signout/route.ts`**

Troque o arquivo inteiro:

```ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

por:

```ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { registrarLog } from '@/lib/system-log'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await registrarLog({
      userId: user.id,
      userEmail: user.email!,
      action: 'auth.logout',
      target: user.id,
    })
  }

  await supabase.auth.signOut()
  redirect('/login')
}
```

Nota: a busca por `user` precisa acontecer **antes** de `signOut()` — depois do
`signOut()` a sessão já foi invalidada e `getUser()` não retornaria mais o usuário.

- [ ] **Step 4: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Rodar a suíte de testes**

Run: `npm run test`
Expected: todos os testes pré-existentes passam (nenhum teste automatizado cobre
login/logout — projeto não tem `@testing-library/react`; verificação real é manual,
ver Task 8).

- [ ] **Step 6: Rodar o build de produção**

Run: `npm run build`
Expected: build concluído sem erros, `/login` continua listado como rota.

- [ ] **Step 7: Commit**

```bash
git add "app/(auth)/login/actions.ts" "app/(auth)/login/page.tsx" "app/api/auth/signout/route.ts"
git commit -m "feat: converter login para Server Action e registrar log de login/logout"
```

---

### Task 7: Tela `/configuracoes/logs`

**Files:**
- Create: `app/(protected)/configuracoes/logs/page.tsx`
- Modify: `app/(protected)/configuracoes/page.tsx`

- [ ] **Step 1: Criar `app/(protected)/configuracoes/logs/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'
import { ACTION_LABELS, type SystemLogAction } from '@/lib/system-log'

const PER_PAGE = 30

type LogRow = {
  id: string
  created_at: string
  user_email: string
  action: SystemLogAction
  target: string | null
  details: Record<string, unknown> | null
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.app_metadata?.role !== 'admin') redirect('/auditorias')

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const { data: logs, count } = await supabase
    .from('system_logs')
    .select('id, created_at, user_email, action, target, details', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  const rows = (logs ?? []) as LogRow[]
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE))

  return (
    <div className="space-y-6">
      <Link href="/configuracoes">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Configurações
        </Button>
      </Link>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <ScrollText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Logs do sistema</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Histórico de ações administrativas e de negócio
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ações registradas</CardTitle>
          <CardDescription>{count ?? 0} registro(s) no total</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                  <TableHead className="py-3">Data/Hora</TableHead>
                  <TableHead className="py-3">Usuário</TableHead>
                  <TableHead className="py-3">Ação</TableHead>
                  <TableHead className="py-3">Alvo</TableHead>
                  <TableHead className="py-3">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum log registrado ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((log) => (
                    <TableRow key={log.id} className="border-b border-border/40 last:border-0">
                      <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })}
                      </TableCell>
                      <TableCell className="py-3 text-sm">{log.user_email}</TableCell>
                      <TableCell className="py-3 text-sm">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {log.target ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground whitespace-normal break-words max-w-xs">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground tabular-nums">
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                {page === 1 ? (
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Link href={`/configuracoes/logs?page=${page - 1}`}>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                )}
                {page === totalPages ? (
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Link href={`/configuracoes/logs?page=${page + 1}`}>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

Nota sobre o Step 1: os botões Anterior/Próxima usam `disabled` (sem `Link` ao
redor) quando estão no limite, e só ficam dentro de um `Link` quando realmente
navegáveis — um `<Button disabled>` dentro de um `<Link>` continua clicável (o
`Link` não sabe que o botão interno está desabilitado), então envolver com `Link`
só quando o botão não está no limite evita esse bug de navegação.

- [ ] **Step 2: Adicionar o card de entrada em `app/(protected)/configuracoes/page.tsx`**

Troque o import de ícones:

```tsx
import { Settings, Clock, Users, ChevronRight } from 'lucide-react'
```

por:

```tsx
import { Settings, Clock, Users, ChevronRight, ScrollText } from 'lucide-react'
```

Troque o final do arquivo:

```tsx
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Gerenciar usuários</CardTitle>
          <CardDescription>
            Crie usuários, defina perfis (admin ou usuário) e remova acessos diretamente pelo
            sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/configuracoes/usuarios">
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              Gerenciar usuários
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
```

por:

```tsx
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Gerenciar usuários</CardTitle>
          <CardDescription>
            Crie usuários, defina perfis (admin ou usuário) e remova acessos diretamente pelo
            sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/configuracoes/usuarios">
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              Gerenciar usuários
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Logs do sistema</CardTitle>
          <CardDescription>
            Consulte o histórico de ações administrativas e de negócio realizadas no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/configuracoes/logs">
            <Button variant="outline" className="gap-2">
              <ScrollText className="w-4 h-4" />
              Ver logs
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Rodar a suíte de testes**

Run: `npm run test`
Expected: todos os testes pré-existentes passam.

- [ ] **Step 5: Rodar o build de produção**

Run: `npm run build`
Expected: build concluído sem erros; `/configuracoes/logs` aparece como rota
dinâmica (`ƒ`) na saída do build.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/configuracoes/logs/page.tsx" "app/(protected)/configuracoes/page.tsx"
git commit -m "feat: adicionar tela de administracao de logs do sistema"
```

---

### Task 8: Verificação manual e fechamento

**Files:** nenhum (checklist de verificação).

- [ ] **Step 1: Checklist de verificação manual no navegador**

Esta etapa não pode ser executada por um agente sem acesso a navegador — deixar
explícito para quem revisar a PR:

- Fazer login → verificar em `/configuracoes/logs` que apareceu uma linha
  `Login` com o e-mail correto.
- Fazer logout e login de novo → confirmar que `Logout` também aparece.
- Criar, editar e deletar um usuário de teste em `/configuracoes/usuarios` →
  confirmar as 3 linhas correspondentes em `/configuracoes/logs`.
- Alterar a própria senha em `/perfil` → confirmar linha `Alterou senha`.
- Adicionar e deletar um relatório em `/relatorios` → confirmar as linhas
  correspondentes.
- Gerar uma auditoria manualmente → confirmar linha `Gerou auditoria`.
- Acessar `/configuracoes/logs` com um usuário não-admin → confirmar redirect para
  `/auditorias` (mesmo comportamento das outras páginas admin).
- Com mais de 30 registros, confirmar que a paginação Anterior/Próxima funciona e
  desabilita corretamente nos limites.

- [ ] **Step 2: Push da branch**

Run: `git push origin feat/log-acoes-sistema`

- [ ] **Step 3: Abrir PR fechando a issue #33**

```bash
gh pr create --base develop --title "feat: adicionar log de acoes do sistema e tela de administracao" --body "$(cat <<'EOF'
## Summary
- Nova tabela `system_logs` (primeira migration versionada do projeto, em `supabase/migrations/`), RLS com leitura restrita a admins
- Helper `registrarLog` (best-effort) chamado ao final das acoes: CRUD de usuarios, alteracao de senha, upload/exclusao de relatorio, geracao de auditoria, login e logout
- Login convertido de client-side para Server Action (necessario para poder logar o evento)
- Nova tela `/configuracoes/logs` (admin-only, ja coberta pelo prefixo /configuracoes existente em ADMIN_ROUTES, sem precisar mexer no proxy.ts), com paginacao no servidor

Closes #33

## Test plan
- [x] npx tsc --noEmit
- [x] npm run test
- [x] npm run build
- [ ] Verificacao manual no navegador (checklist na Task 8 do plano)
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Seção 1 (tabela/migration) → Task 1. Seção 2 (helper +
  pontos de chamada) → Task 2 (helper) + Tasks 3/4/5 (pontos de chamada de
  usuários/relatórios/senha). Seção 3 (login como Server Action) → Task 6. Seção 4
  (tela admin) → Task 7. Itens de "Fora de escopo" da spec (sem `requireAdmin()`
  compartilhado, sem backfill de migrations antigas, sem `CHECK` em `action`) —
  nenhuma task os implementa, como esperado.
- **Placeholder scan:** nenhum "TBD"/"similar to Task N" — todo código está
  completo em cada step, inclusive os arquivos reescritos por inteiro (login
  page.tsx, signout route.ts).
- **Type consistency:** `SystemLogAction` (Task 2) usado com os mesmos 9 valores
  literais em todos os pontos de chamada (Tasks 3-6) e no `ACTION_LABELS`/`LogRow`
  da Task 7 — nenhum valor de `action` usado numa chamada que não exista no union
  type (o que já causaria erro de `tsc`, servindo como rede de segurança).
  `registrarLog`'s assinatura (`userId`, `userEmail`, `action`, `target?`,
  `details?`) usada de forma consistente em todas as 9 chamadas.
