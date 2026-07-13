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
