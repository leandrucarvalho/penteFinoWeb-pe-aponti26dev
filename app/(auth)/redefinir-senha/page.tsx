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
