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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'
import { ACTION_LABELS, type SystemLogAction } from '@/lib/system-log'

const PER_PAGE = 30

type LogRow = {
  id: string
  created_at: string
  user_email: string
  action: SystemLogAction
  target: string | null
  details: Record<string, unknown> | null
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const parsedPage = Math.floor(Number(pageParam))
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.app_metadata?.role !== 'admin') redirect('/auditorias')

  const { count } = await supabase
    .from('system_logs')
    .select('*', { count: 'exact', head: true })

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE))
  const safePage = Math.min(page, totalPages)

  const from = (safePage - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const { data: logs } = await supabase
    .from('system_logs')
    .select('id, created_at, user_email, action, target, details')
    .order('created_at', { ascending: false })
    .range(from, to)

  const rows = (logs ?? []) as LogRow[]

  return (
    <div className="space-y-6">
      <Link href="/configuracoes">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Configurações
        </Button>
      </Link>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <ScrollText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Logs do sistema</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Histórico de ações administrativas e de negócio
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ações registradas</CardTitle>
          <CardDescription>{count ?? 0} registro(s) no total</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
                  <TableHead className="py-3">Data/Hora</TableHead>
                  <TableHead className="py-3">Usuário</TableHead>
                  <TableHead className="py-3">Ação</TableHead>
                  <TableHead className="py-3">Alvo</TableHead>
                  <TableHead className="py-3">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum log registrado ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((log) => (
                    <TableRow key={log.id} className="border-b border-border/40 last:border-0">
                      <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })}
                      </TableCell>
                      <TableCell className="py-3 text-sm">{log.user_email}</TableCell>
                      <TableCell className="py-3 text-sm">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {log.target ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground whitespace-normal break-words max-w-xs">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground tabular-nums">
                Página {safePage} de {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                {safePage === 1 ? (
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Link href={`/configuracoes/logs?page=${safePage - 1}`}>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                )}
                {safePage === totalPages ? (
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Link href={`/configuracoes/logs?page=${safePage + 1}`}>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
