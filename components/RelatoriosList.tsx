'use client'

import { useMemo, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { FileText, Trash2, InboxIcon } from 'lucide-react'
import { deletarRelatorios, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

type Relatorio = {
  id: string
  nome: string
  semana: string
  created_at: string
}

export function RelatoriosList({ relatorios }: { relatorios: Relatorio[] }) {
  const [selecionadosBruto, setSelecionados] = useState<Set<string>>(new Set())
  const [excluindo, setExcluindo] = useState(false)
  const [idsExcluidos, setIdsExcluidos] = useState<string[] | null>(null)
  const [gerando, setGerando] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [openRowId, setOpenRowId] = useState<string | null>(null)

  // Reconcilia contra `relatorios` durante o render (sem efeito) para que IDs
  // que deixaram de existir na prop (ex.: excluídos em outra sessão) nunca
  // fiquem "presos" em `selecionados`.
  const selecionados = useMemo(
    () => new Set([...selecionadosBruto].filter((id) => relatorios.some((r) => r.id === id))),
    [selecionadosBruto, relatorios]
  )

  const todosSelecionados = relatorios.length > 0 && selecionados.size === relatorios.length
  const algunsSelecionados = selecionados.size > 0 && !todosSelecionados

  function toggleSelecionado(id: string, checked: boolean) {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      if (checked) {
        proximo.add(id)
      } else {
        proximo.delete(id)
      }
      return proximo
    })
  }

  function toggleTodos(checked: boolean) {
    setSelecionados(checked ? new Set(relatorios.map((r) => r.id)) : new Set())
  }

  async function excluir(ids: string[]) {
    setExcluindo(true)
    try {
      const { sucesso, falhas } = await deletarRelatorios(ids)

      for (const falha of falhas) {
        const relatorio = relatorios.find((r) => r.id === falha.id)
        toast.error(`${relatorio?.nome ?? falha.id}: ${falha.erro}`)
      }

      if (sucesso.length > 0) {
        setSelecionados((atual) => {
          const proximo = new Set(atual)
          for (const id of sucesso) proximo.delete(id)
          return proximo
        })
        setIdsExcluidos(sucesso)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir relatório(s)')
    } finally {
      setExcluindo(false)
      setBulkDialogOpen(false)
      setOpenRowId(null)
    }
  }

  async function handleGerarAuditoria() {
    if (!idsExcluidos || idsExcluidos.length === 0) return
    setGerando(true)
    try {
      const triggerId = idsExcluidos.length === 1 ? idsExcluidos[0] : null
      const res = await gerarAuditoriaManual('delete', triggerId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setIdsExcluidos(null)
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={todosSelecionados}
            indeterminate={algunsSelecionados}
            onCheckedChange={(checked) => toggleTodos(checked === true)}
          />
          <span className="text-sm text-muted-foreground">
            {selecionados.size > 0
              ? `${selecionados.size} selecionado(s)`
              : 'Selecionar todos'}
          </span>
        </div>

        {selecionados.size > 0 && (
          <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <AlertDialogTrigger render={
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              />
            }>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Excluir selecionados ({selecionados.size})
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai remover {selecionados.size} relatório(s). Esta ação não pode ser
                  desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => excluir([...selecionados])}
                  disabled={excluindo}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <ul className="space-y-2">
        {relatorios.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Checkbox
                checked={selecionados.has(r.id)}
                onCheckedChange={(checked) => toggleSelecionado(r.id, checked === true)}
              />
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{r.nome}</p>
                <div className="flex gap-2 mt-1 items-center">
                  <Badge variant="secondary" className="text-xs px-2 py-0">
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

            <AlertDialog
              open={openRowId === r.id}
              onOpenChange={(open) => setOpenRowId(open ? r.id : null)}
            >
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
                  <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => excluir([r.id])}
                    disabled={excluindo}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={idsExcluidos !== null}
        onOpenChange={(open) => {
          if (!open) setIdsExcluidos(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {idsExcluidos && idsExcluidos.length > 1 ? 'Relatórios excluídos' : 'Relatório excluído'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {idsExcluidos && idsExcluidos.length > 1
                ? `${idsExcluidos.length} relatórios foram excluídos. Deseja gerar a auditoria agora?`
                : 'O relatório foi excluído. Deseja gerar a auditoria agora?'}
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
