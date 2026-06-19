'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, ShieldCheck, BarChart3, FileText } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro('Email ou senha inválidos')
      setLoading(false)
      return
    }

    router.push('/auditorias')
    router.refresh()
  }

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

        <div className="relative">
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
            <div className="lg:hidden text-2xl font-bold bg-gradient-to-r from-primary to-[oklch(0.710_0.191_294)] bg-clip-text text-transparent mb-4">
              Aponti
            </div>
            <h2 className="text-2xl font-bold text-foreground">Entrar</h2>
            <p className="text-muted-foreground text-sm">
              Use suas credenciais de acesso
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
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

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
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
