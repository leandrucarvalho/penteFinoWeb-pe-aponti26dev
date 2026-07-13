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
