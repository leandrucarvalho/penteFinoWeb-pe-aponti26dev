import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users } from 'lucide-react'
import { CriarUsuarioDialog } from '@/components/CriarUsuarioDialog'
import { UsuariosList } from '@/components/UsuariosList'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.app_metadata?.role !== 'admin') redirect('/auditorias')

  const service = createServiceClient()
  const {
    data: { users },
  } = await service.auth.admin.listUsers({ perPage: 1000 })

  const sorted = [...users].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="space-y-6">
      <Link href="/configuracoes">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Configurações
        </Button>
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gerenciar usuários</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Crie, altere o perfil e desative usuários do sistema
            </p>
          </div>
        </div>
        <CriarUsuarioDialog />
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usuários cadastrados</CardTitle>
          <CardDescription>
            {sorted.length} usuário(s) no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsuariosList users={sorted} currentUserId={user!.id} />
        </CardContent>
      </Card>
    </div>
  )
}
