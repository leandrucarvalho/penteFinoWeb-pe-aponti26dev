# Recuperação de Senha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issue #29 — a full "esqueci minha senha" flow: request a reset link, receive it by email (Supabase Auth's built-in mechanism), and set a new password, ending logged in.

**Architecture:** Three new routes (`/esqueci-senha`, `/auth/callback`, `/redefinir-senha`) plus a proxy.ts change to let unauthenticated requests reach them, plus one link added to the existing login page. `/esqueci-senha` is a Server Component (reads the `?erro=` query param via the `searchParams` page prop, per this Next.js version's docs — no `useSearchParams`/Suspense needed) that renders a Client Component form. `/redefinir-senha` is a single Client Component page (same pattern as the existing `/login` page), which checks for an active session on mount and redirects away if there isn't one. `/auth/callback` is a Route Handler that exchanges the Supabase code for a session and redirects onward.

**Tech Stack:** Next.js 16 App Router, Supabase Auth (`@supabase/ssr`), existing shadcn `Button`/`Input`/`Label` components, `lucide-react` icons.

---

### Task 1: Allow public routes through the proxy

**Files:**
- Modify: `proxy.ts` (entire file)

- [ ] **Step 1: Replace the file content**

Current content of `proxy.ts` only exempts `/login` from the "no session → redirect" rule. Replace the whole file with:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ROUTES = ['/relatorios', '/configuracoes']
const PUBLIC_ROUTES = ['/login', '/esqueci-senha', '/redefinir-senha', '/auth/callback']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname === '/login'
  const isRoot = request.nextUrl.pathname === '/'
  const isPublicRoute = PUBLIC_ROUTES.some((r) => request.nextUrl.pathname === r)

  if (isRoot) {
    const dest = user ? '/dashboard' : '/login'
    return NextResponse.redirect(new URL(dest, request.url))
  }
  const isAdminRoute = ADMIN_ROUTES.some((r) =>
    request.nextUrl.pathname.startsWith(r)
  )

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && isAdminRoute && user.app_metadata?.role !== 'admin') {
    return NextResponse.redirect(new URL('/auditorias', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

The only change from the current file: `isLoginPage` is no longer used for the "block unauthenticated access" check — a new `isPublicRoute` (checking against `PUBLIC_ROUTES`) is used instead, and `/esqueci-senha`, `/redefinir-senha`, `/auth/callback` were added to that list. The rest of the logic (root redirect, admin route guard, redirect-away-from-login-if-authenticated) is unchanged.

- [ ] **Step 2: Verify it still typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean) — this only fails later if a task introduces a type error, but run it now as a baseline.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat: liberar rotas publicas de recuperacao de senha no proxy"
```

---

### Task 2: Auth callback route handler

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = request.nextUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/esqueci-senha?erro=link-invalido', request.url))
}
```

This follows the existing Route Handler pattern in `app/api/auth/signout/route.ts` (uses `createClient` from `lib/supabase/server.ts`, which is cookie-aware — `exchangeCodeForSession` here sets the session cookies on the response).

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat: adicionar route handler de callback para recuperacao de senha"
```

---

### Task 3: "Esqueci minha senha" page

**Files:**
- Create: `components/EsqueciSenhaForm.tsx`
- Create: `app/(auth)/esqueci-senha/page.tsx`

- [ ] **Step 1: Write the form component**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

export function EsqueciSenhaForm({ linkInvalido }: { linkInvalido: boolean }) {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    })

    setLoading(false)

    if (error) {
      setErro('Não foi possível enviar o email agora. Tente novamente em instantes.')
      return
    }

    setEnviado(true)
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">Esqueci minha senha</h2>
        <p className="text-muted-foreground text-sm">
          Informe seu email e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      {linkInvalido && !enviado && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Link inválido ou expirado. Solicite um novo abaixo.
        </div>
      )}

      {enviado ? (
        <div className="flex items-center gap-2 text-sm bg-primary/8 border border-primary/20 px-3 py-2.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
          Se esse email tiver uma conta, você vai receber um link de recuperação em instantes.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              autoComplete="email"
              className="h-11"
            />
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erro}
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar link de recuperação'
            )}
          </Button>
        </form>
      )}

      <Link
        href="/login"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para o login
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Write the page (Server Component, reads `?erro=` via the `searchParams` prop)**

```tsx
import { EsqueciSenhaForm } from '@/components/EsqueciSenhaForm'

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <EsqueciSenhaForm linkInvalido={erro === 'link-invalido'} />
    </div>
  )
}
```

Note: this page intentionally does NOT use the `useSearchParams` client hook — in this Next.js version, a Client Component using `useSearchParams` must be wrapped in `<Suspense>` or the production build fails ("Missing Suspense boundary with useSearchParams"). Reading `erro` via the Server Component's `searchParams` prop and passing it down as a plain boolean avoids that entirely. Do not "fix" this by switching to `useSearchParams` in `EsqueciSenhaForm.tsx`.

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add components/EsqueciSenhaForm.tsx "app/(auth)/esqueci-senha/page.tsx"
git commit -m "feat: adicionar tela de esqueci minha senha"
```

---

### Task 4: "Redefinir senha" page

**Files:**
- Create: `app/(auth)/redefinir-senha/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [verificandoSessao, setVerificandoSessao] = useState(true)
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/esqueci-senha')
        return
      }
      setVerificandoSessao(false)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) {
      setErro('Senha deve ter pelo menos 6 caracteres')
      return
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)

    if (error) {
      setErro('Não foi possível atualizar a senha. Tente novamente.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (verificandoSessao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">Definir nova senha</h2>
          <p className="text-muted-foreground text-sm">
            Escolha uma nova senha para sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar senha</Label>
            <Input
              id="confirmarSenha"
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
            />
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erro}
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar nova senha'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

`senha.length < 6` matches the existing rule enforced server-side for admin-created users in `app/(protected)/configuracoes/usuarios/actions.ts:31`.

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/redefinir-senha/page.tsx"
git commit -m "feat: adicionar tela de redefinir senha"
```

---

### Task 5: Link from the login page

**Files:**
- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Add the `Link` import**

Change:
```tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
```
to:
```tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
```

- [ ] **Step 2: Add the "Esqueci minha senha" link**

Find this block (the closing of the password field, right before the error message block):

```tsx
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Exibir senha'}
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {erro && (
```

Replace it with (adds a new `<div>` with the link right after the password field's closing `</div>`):

```tsx
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Exibir senha'}
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <Link
                  href="/esqueci-senha"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            {erro && (
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "feat: adicionar link esqueci minha senha na tela de login"
```

---

### Task 6: Full verification, push, PR

**Files:** none (verification and git operations only)

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build completes successfully; new routes `/esqueci-senha` (dynamic, ƒ — because it reads `searchParams`), `/redefinir-senha` (dynamic or static, either is fine since it's fully client-rendered), and `/auth/callback` (dynamic, ƒ) appear in the route list alongside the existing ones. No "Missing Suspense boundary" error.

- [ ] **Step 2: Run the test suite**

Run: `npm run test`
Expected: existing Vitest suite passes unchanged (this feature adds no pure functions, so no new automated tests — see spec's "Testes" section).

- [ ] **Step 3: Manual browser verification (report results, do not skip)**

With `npm run dev` running:
1. Go to `/login`, confirm the "Esqueci minha senha" link is visible and navigates to `/esqueci-senha`.
2. On `/esqueci-senha`, submit a real user's email. Confirm the generic success message appears.
3. Check the email inbox for that user, click the reset link. Confirm it lands on `/redefinir-senha` already authenticated (no login prompt).
4. Submit a new password (test both: too short — expect inline error; passwords not matching — expect inline error; valid — expect redirect to `/dashboard`).
5. Log out and log back in with the new password to confirm it was actually changed.
6. Visit `/redefinir-senha` directly in a fresh/incognito session (no recovery cookie). Confirm it redirects to `/esqueci-senha`.
7. Try a stale/already-used reset link a second time (or a manually broken `?code=`). Confirm it redirects to `/esqueci-senha?erro=link-invalido` and the warning message shows.

- [ ] **Step 4: Push branch and open PR into develop**

```bash
git push -u origin feat/recuperar-senha
```

```bash
gh pr create --base develop --title "feat: implementar recuperação de senha (esqueci minha senha)" --body "$(cat <<'EOF'
## Resumo
Implementa a issue #29: fluxo completo de recuperação de senha a partir da tela de login.

- Link "Esqueci minha senha" em `/login`.
- Nova tela `/esqueci-senha`: usuário informa o email, dispara `resetPasswordForEmail` (mensagem de sucesso genérica, não revela se o email existe).
- Novo route handler `/auth/callback`: troca o código do link do Supabase por uma sessão e redireciona para `/redefinir-senha` (ou de volta para `/esqueci-senha?erro=link-invalido` se o link for inválido/expirado).
- Nova tela `/redefinir-senha`: define a nova senha (mínimo 6 caracteres, confirmação obrigatória) e redireciona autenticado para `/dashboard`.
- `proxy.ts` atualizado para liberar essas três rotas para usuários não autenticados.
- Também inclui o commit pendente de renomear `middleware.ts` para `proxy.ts` (convenção depreciada nesta versão do Next.js).

Closes #29

## Test plan
- [x] npm run build
- [x] npm run test
- [ ] Verificação manual completa do fluxo (solicitar link, seguir email, trocar senha, confirmar login com a nova senha) — ver checklist na Task 6 do plano
EOF
)"
```

Expected: PR URL printed.
