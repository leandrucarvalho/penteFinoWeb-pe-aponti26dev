'use client'

import { useActionState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Loader2, UserPlus } from 'lucide-react'
import { criarUsuario } from '@/app/(protected)/configuracoes/usuarios/actions'

export function CriarUsuarioForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(criarUsuario, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="space-y-2">
            <Label htmlFor="senha">Senha <span className="text-destructive">*</span></Label>
            <PasswordInput
              id="senha"
              name="senha"
              required
              placeholder="mínimo 6 caracteres"
              disabled={pending}
              className="h-10"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="role">Perfil de acesso <span className="text-destructive">*</span></Label>
          <select
            id="role"
            name="role"
            required
            disabled={pending}
            defaultValue="user"
            className="flex h-10 w-full sm:w-[200px] items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="user">Usuário</option>
            <option value="admin">Admin</option>
          </select>
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
