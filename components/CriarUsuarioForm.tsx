'use client'

import { useActionState, useRef, useEffect } from 'react'
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
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import { criarUsuario } from '@/app/(protected)/configuracoes/usuarios/actions'

export function CriarUsuarioForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(criarUsuario, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success && !state?.emailFalhou) {
      formRef.current?.reset()
      const timer = setTimeout(() => onSuccess?.(), 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success, state?.emailFalhou])

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

      {state?.error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}
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
      {state?.success && !state?.emailFalhou && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 px-3 py-2.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Usuário criado com sucesso! A senha foi enviada por email.
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
