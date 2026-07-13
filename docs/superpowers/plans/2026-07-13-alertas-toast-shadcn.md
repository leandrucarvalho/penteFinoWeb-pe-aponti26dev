# Alertas com toast (shadcn/sonner) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as caixas de aviso fixas (erro/sucesso) espalhadas por ~10 componentes por `toast.error()`/`toast.success()` do shadcn (sonner), já instalado e montado globalmente.

**Architecture:** Cada componente perde sua `<div>` condicional de erro/sucesso e o `useState` (ou o campo do `useActionState`) que só existia para controlar essa div. No lugar, chama `toast.error(...)`/`toast.success(...)` diretamente no ponto onde o resultado é conhecido — em `useEffect` para componentes com `useActionState`, ou inline nos handlers para componentes com `useState` local. Duas exceções mantêm a caixa fixa por serem estado persistente de tela, não notificação pontual (ver spec).

**Tech Stack:** Next.js 16 App Router, React 19, `sonner` (via `components/ui/sonner.tsx`, já mostrado em `app/layout.tsx`).

**Spec:** `docs/superpowers/specs/2026-07-13-alertas-toast-shadcn-design.md`

---

### Task 1: PlanilhaGeralForm.tsx

**Files:**
- Modify: `components/PlanilhaGeralForm.tsx`

- [ ] **Step 1: Substituir as caixas por toast**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react'
import { uploadPlanilhaGeral } from '@/app/(protected)/configuracoes/actions'

export function PlanilhaGeralForm() {
  const [state, action, pending] = useActionState(uploadPlanilhaGeral, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      setFileName(null)
      toast.success('Planilha atualizada com sucesso!')
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-4">
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
          required
          disabled={pending}
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

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

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/PlanilhaGeralForm.tsx`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add components/PlanilhaGeralForm.tsx
git commit -m "refactor: usar toast em vez de caixa fixa no upload de planilha geral"
```

---

### Task 2: AlterarSenhaForm.tsx

**Files:**
- Modify: `components/AlterarSenhaForm.tsx`

- [ ] **Step 1: Substituir `erro`/`sucesso` por toast**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { alterarSenha } from '@/app/(protected)/perfil/actions'

export function AlterarSenhaForm() {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (novaSenha.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres')
      return
    }
    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não coincidem')
      return
    }

    setLoading(true)
    const result = await alterarSenha(senhaAtual, novaSenha)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setSenhaAtual('')
    setNovaSenha('')
    setConfirmarSenha('')
    toast.success('Senha alterada com sucesso!')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="senhaAtual">Senha atual</Label>
        <PasswordInput
          id="senhaAtual"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          required
          placeholder="••••••••"
          autoComplete="current-password"
          className="h-10"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="novaSenha">Nova senha</Label>
          <PasswordInput
            id="novaSenha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            placeholder="mínimo 6 caracteres"
            autoComplete="new-password"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
          <PasswordInput
            id="confirmarSenha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="new-password"
            className="h-10"
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Alterar senha'
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/AlterarSenhaForm.tsx`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add components/AlterarSenhaForm.tsx
git commit -m "refactor: usar toast em vez de caixa fixa ao alterar senha"
```

---

### Task 3: PerfilForm.tsx

**Files:**
- Modify: `components/PerfilForm.tsx`

- [ ] **Step 1: Substituir `erro`/`sucesso` por toast**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { atualizarPerfil } from '@/app/(protected)/perfil/actions'

type PerfilFormProps = {
  nome: string
  telefone: string
  cargo: string
  funcao: string
}

export function PerfilForm({
  nome: nomeInicial,
  telefone: telefoneInicial,
  cargo: cargoInicial,
  funcao: funcaoInicial,
}: PerfilFormProps) {
  const [nome, setNome] = useState(nomeInicial)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [cargo, setCargo] = useState(cargoInicial)
  const [funcao, setFuncao] = useState(funcaoInicial)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await atualizarPerfil({ nome, telefone, cargo, funcao })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Dados atualizados com sucesso!')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="João da Silva"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(81) 99999-9999"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cargo">Cargo</Label>
          <Input
            id="cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="ex: Coordenador"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="funcao">Função</Label>
          <Input
            id="funcao"
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            placeholder="ex: Operações"
            className="h-10"
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar dados'
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/PerfilForm.tsx`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add components/PerfilForm.tsx
git commit -m "refactor: usar toast em vez de caixa fixa ao salvar perfil"
```

---

### Task 4: redefinir-senha/page.tsx

**Files:**
- Modify: `app/(auth)/redefinir-senha/page.tsx`

- [ ] **Step 1: Substituir `erro` por toast**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [verificandoSessao, setVerificandoSessao] = useState(true)
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/esqueci-senha?erro=link-invalido')
        return
      }
      setVerificandoSessao(false)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (senha.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres')
      return
    }
    if (senha !== confirmarSenha) {
      toast.error('As senhas não coincidem')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)

    if (error) {
      toast.error('Não foi possível atualizar a senha. Tente novamente.')
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
            <PasswordInput
              id="senha"
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
            <PasswordInput
              id="confirmarSenha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
            />
          </div>

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

- [ ] **Step 2: Verificar lint**

Run: `npx eslint "app/(auth)/redefinir-senha/page.tsx"`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/redefinir-senha/page.tsx"
git commit -m "refactor: usar toast em vez de caixa fixa ao redefinir senha"
```

---

### Task 5: EsqueciSenhaForm.tsx

**Files:**
- Modify: `components/EsqueciSenhaForm.tsx`

- [ ] **Step 1: Substituir só o `erro` de envio por toast — manter `linkInvalido` e `enviado` fixos**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

export function EsqueciSenhaForm({ linkInvalido }: { linkInvalido: boolean }) {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    })

    setLoading(false)

    if (error) {
      toast.error('Não foi possível enviar o email agora. Tente novamente em instantes.')
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

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/EsqueciSenhaForm.tsx`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add components/EsqueciSenhaForm.tsx
git commit -m "refactor: usar toast no erro de envio do link de recuperacao"
```

---

### Task 6: CriarUsuarioForm.tsx

**Files:**
- Modify: `components/CriarUsuarioForm.tsx`

- [ ] **Step 1: Mover erro/sucesso para toast, manter só a caixa de `emailFalhou`, remover o delay de 1500ms**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useActionState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Loader2, UserPlus } from 'lucide-react'
import { criarUsuario } from '@/app/(protected)/configuracoes/usuarios/actions'

export function CriarUsuarioForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(criarUsuario, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success && !state?.emailFalhou) {
      formRef.current?.reset()
      toast.success('Usuário criado com sucesso!')
      onSuccess?.()
    } else if (state?.error) {
      toast.error(state.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {/* Acesso */}
      <div>
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
          Acesso
        </p>
        <div className="space-y-2">
          <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="usuario@email.com"
            disabled={pending}
            className="h-10"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="role">Perfil de acesso <span className="text-destructive">*</span></Label>
          <Select name="role" required disabled={pending} defaultValue="user">
            <SelectTrigger id="role" className="h-10 w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Perfil */}
      <div>
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
          Perfil
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              name="nome"
              type="text"
              placeholder="João da Silva"
              disabled={pending}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              name="telefone"
              type="tel"
              placeholder="(81) 99999-9999"
              disabled={pending}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input
              id="cargo"
              name="cargo"
              type="text"
              placeholder="ex: Coordenador"
              disabled={pending}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="funcao">Função</Label>
            <Input
              id="funcao"
              name="funcao"
              type="text"
              placeholder="ex: Operações"
              disabled={pending}
              className="h-10"
            />
          </div>
        </div>
      </div>

      {state?.success && state?.emailFalhou && (
        <div className="flex flex-col gap-1.5 text-amber-700 text-sm bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Usuário criado, mas o envio do email falhou.
          </div>
          <p className="text-xs">
            Repasse esta senha manualmente ao usuário:{' '}
            <code className="bg-amber-100 px-1.5 py-0.5 rounded">{state.senhaGerada}</code>
          </p>
        </div>
      )}

      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Criando...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            Criar usuário
          </>
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/CriarUsuarioForm.tsx`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add components/CriarUsuarioForm.tsx
git commit -m "refactor: usar toast ao criar usuario, manter caixa fixa so no fallback de senha"
```

---

### Task 7: AdicionarRelatorioForm.tsx

**Files:**
- Modify: `components/AdicionarRelatorioForm.tsx`

- [ ] **Step 1: Substituir erro de upload e erro de gerar auditoria por toast**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useActionState, useRef, useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react'
import { adicionarRelatorio, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

export function AdicionarRelatorioForm() {
  const [state, action, pending] = useActionState(adicionarRelatorio, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [showGerarDialog, setShowGerarDialog] = useState(false)
  const [gerando, startGerarTransition] = useTransition()

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      setFileName(null)
      setShowGerarDialog(true)
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  function handleGerarAuditoria() {
    if (!state?.relatorioId) return
    startGerarTransition(async () => {
      const res = await gerarAuditoriaManual('add', state.relatorioId!)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setShowGerarDialog(false)
    })
  }

  return (
    <>
      <form ref={formRef} action={action} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do relatório</Label>
            <Input
              id="nome"
              name="nome"
              required
              placeholder="ex: Relatório 1"
              disabled={pending}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="semana">Semana</Label>
            <Input
              id="semana"
              name="semana"
              required
              placeholder="ex: Semana 1"
              disabled={pending}
              className="h-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Arquivo CSV (exportado do Moodle)</Label>
          <label
            htmlFor="arquivo-rel"
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
                <span className="text-xs text-muted-foreground mt-1">CSV exportado do Moodle</span>
              </>
            )}
          </label>
          <Input
            id="arquivo-rel"
            name="arquivo"
            type="file"
            accept=".csv"
            required
            disabled={pending}
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </div>

        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              Adicionar relatório
            </>
          )}
        </Button>
      </form>

      <AlertDialog
        open={showGerarDialog}
        onOpenChange={(open) => {
          if (!open) setShowGerarDialog(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Relatório anexado</AlertDialogTitle>
            <AlertDialogDescription>
              O relatório foi anexado com sucesso. Deseja gerar a auditoria agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gerando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerarAuditoria} disabled={gerando}>
              {gerando ? 'Gerando...' : 'Gerar auditoria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/AdicionarRelatorioForm.tsx`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add components/AdicionarRelatorioForm.tsx
git commit -m "refactor: usar toast ao anexar relatorio e gerar auditoria"
```

---

### Task 8: login/page.tsx

**Files:**
- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Substituir a caixa de erro de login por toast**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { login } from './actions'
import { Logomark } from '@/components/Logomark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck, BarChart3, FileText } from 'lucide-react'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

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

- [ ] **Step 2: Verificar lint**

Run: `npx eslint "app/(auth)/login/page.tsx"`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "refactor: usar toast no erro de login"
```

---

### Task 9: RelatoriosList.tsx

**Files:**
- Modify: `components/RelatoriosList.tsx`

- [ ] **Step 1: Substituir `deleteError`/`gerarError` por toast**

Conteúdo completo do arquivo:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Trash2, InboxIcon } from 'lucide-react'
import { deletarRelatorio, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

type Relatorio = {
  id: string
  nome: string
  semana: string
  created_at: string
}

export function RelatoriosList({ relatorios }: { relatorios: Relatorio[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [relatorioExcluidoId, setRelatorioExcluidoId] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deletarRelatorio(id)
      setRelatorioExcluidoId(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir relatório')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleGerarAuditoria() {
    if (!relatorioExcluidoId) return
    setGerando(true)
    try {
      const res = await gerarAuditoriaManual('delete', relatorioExcluidoId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setRelatorioExcluidoId(null)
    } finally {
      setGerando(false)
    }
  }

  if (!relatorios.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center mb-3">
          <InboxIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">Nenhum relatório adicionado</p>
        <p className="text-muted-foreground text-xs mt-1">
          Faça upload do CSV exportado do Moodle acima.
        </p>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-2">
        {relatorios.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{r.nome}</p>
                <div className="flex gap-2 mt-1 items-center">
                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-0"
                  >
                    {r.semana}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 shrink-0 ml-2"
                />
              }>
                <Trash2 className="w-3.5 h-3.5" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso vai remover <strong>{r.nome}</strong>. Esta ação não pode ser
                    desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingId === r.id ? 'Deletando...' : 'Confirmar exclusão'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={relatorioExcluidoId !== null}
        onOpenChange={(open) => {
          if (!open) setRelatorioExcluidoId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Relatório excluído</AlertDialogTitle>
            <AlertDialogDescription>
              O relatório foi excluído. Deseja gerar a auditoria agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gerando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerarAuditoria} disabled={gerando}>
              {gerando ? 'Gerando...' : 'Gerar auditoria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/RelatoriosList.tsx`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add components/RelatoriosList.tsx
git commit -m "refactor: usar toast ao excluir relatorio e gerar auditoria"
```

---

### Task 10: UsuariosList.tsx

**Files:**
- Modify: `components/UsuariosList.tsx`

- [ ] **Step 1: Substituir `editError` por toast**

Trecho a modificar — imports (topo do arquivo):

```tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

Trecho a modificar — state e handlers (substitui as linhas 65-113 do arquivo atual):

```tsx
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()
  const [editingUser, setEditingUser] = useState<UsuarioItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    nome: '',
    telefone: '',
    cargo: '',
    funcao: '',
    role: 'user',
  })
  const [isSaving, startSave] = useTransition()

  useEffect(() => {
    if (editingUser) {
      setEditForm({
        nome: (editingUser.user_metadata?.nome as string) ?? '',
        telefone: (editingUser.user_metadata?.telefone as string) ?? '',
        cargo: (editingUser.user_metadata?.cargo as string) ?? '',
        funcao: (editingUser.user_metadata?.funcao as string) ?? '',
        role: ((editingUser.app_metadata?.role as string) ?? 'user') as 'admin' | 'user',
      })
    }
  }, [editingUser])

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

  function handleSave() {
    if (!editingUser) return
    startSave(async () => {
      try {
        await atualizarUsuario(editingUser.id, editForm)
        setEditingUser(null)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }
```

Trecho a remover — a caixa de erro no dialog de edição (logo antes de `<DialogFooter>`, por volta da linha 347-352 do arquivo atual):

```tsx
          {editError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {editError}
            </div>
          )}

```

Remova esse bloco inteiro (a `<DialogFooter>` passa a vir logo depois de fechar a `<div className="space-y-4">` do formulário de edição).

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/UsuariosList.tsx`
Expected: sem output (limpo)

- [ ] **Step 3: Commit**

```bash
git add components/UsuariosList.tsx
git commit -m "refactor: usar toast ao editar usuario"
```

---

### Task 11: Verificação final

**Files:** nenhum (só validação)

- [ ] **Step 1: Rodar a suíte de testes**

Run: `npm test`
Expected: todos os testes passando (nenhum teste depende do texto das caixas removidas)

- [ ] **Step 2: Rodar o lint completo**

Run: `npx eslint .`
Expected: sem erros novos (os 3 erros/3 avisos pré-existentes em `PlanilhaGeralForm.tsx`/`UsuariosList.tsx`/`lib/gerar-auditoria.ts`/`lib/pente-fino.test.ts` continuam fora de escopo — conferir que nenhum novo apareceu)

- [ ] **Step 3: Rodar o build de produção**

Run: `npm run build`
Expected: build concluído sem erros, todas as rotas geradas

- [ ] **Step 4: Checklist de verificação manual (reportar ao usuário)**

Rodar `npm run dev` e conferir manualmente, em cada tela:

- Configurações → Planilha geral: submeter sem arquivo (toast de erro "Selecione um arquivo CSV."); enviar um CSV válido (toast de sucesso)
- Configurações → Usuários → Criar usuário: erro de validação (toast); sucesso sem falha de email (toast + diálogo fecha na hora); forçar falha de email — se possível — e confirmar que a caixa amarela com a senha continua fixa (não vira toast)
- Configurações → Usuários → Editar usuário: forçar um erro ao salvar (toast)
- Configurações → Usuários → Deletar usuário: fluxo normal (sem regressão)
- Relatórios → Adicionar relatório: erro de upload (toast); anexar com sucesso, depois forçar erro ao gerar auditoria no diálogo (toast, diálogo permanece aberto)
- Relatórios → lista: excluir um relatório e forçar erro ao gerar auditoria (toast)
- Perfil → dados pessoais: erro e sucesso (toast)
- Perfil → alterar senha: as 2 validações client-side + erro do servidor + sucesso (toast)
- Login: credenciais inválidas (toast)
- Esqueci a senha: forçar erro de envio (toast); conferir que a mensagem "Se esse email tiver uma conta..." continua fixa, não vira toast
- Redefinir senha (link de recuperação): validações + erro (toast)
- Acessar `/redefinir-senha` sem sessão válida: confirma que ainda redireciona para `/esqueci-senha?erro=link-invalido` e que a caixa "Link inválido ou expirado" aparece fixa lá (não é um toast)

Reportar ao usuário qualquer caso que não bater com o esperado antes de finalizar a branch.
