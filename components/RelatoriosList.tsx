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
