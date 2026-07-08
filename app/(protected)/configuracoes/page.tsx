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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlanilhaGeralForm } from '@/components/PlanilhaGeralForm'
import { Settings, Clock, Users, ChevronRight, ScrollText } from 'lucide-react'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.app_metadata?.role !== 'admin') redirect('/auditorias')

  const { data: planilhas } = await supabase
    .from('planilha_geral')
    .select('id, uploaded_at')
    .order('uploaded_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie a planilha de alunos e usuários do sistema
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Planilha geral de alunos</CardTitle>
          <CardDescription>
            CSV com colunas{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">residente, empresa</code>{' '}
            (Formato A) ou{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Nome, Sobrenome, Grupos</code>{' '}
            (Formato B). Será usada em todas as próximas auditorias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PlanilhaGeralForm />

          {planilhas && planilhas.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Histórico de uploads
              </p>
              <ul className="space-y-2">
                {planilhas.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {new Date(p.uploaded_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </span>
                    {i === 0 && (
                      <Badge className="text-xs h-5 px-2 bg-primary/10 text-primary border-primary/20 border">
                        atual
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma planilha carregada ainda.
            </p>
          )}
        </CardContent>
      </Card>

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
