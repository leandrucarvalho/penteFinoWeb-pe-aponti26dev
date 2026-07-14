'use client'

import { useActionState, useRef, useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react'
import { adicionarRelatorios, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

export function AdicionarRelatorioForm() {
  const [state, action, pending] = useActionState(adicionarRelatorios, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [fileNames, setFileNames] = useState<string[]>([])
  const [showGerarDialog, setShowGerarDialog] = useState(false)
  const [gerando, startGerarTransition] = useTransition()

  useEffect(() => {
    if (!state) return

    if (state.error) {
      toast.error(state.error)
      return
    }

    if (state.falhas && state.falhas.length > 0) {
      state.falhas.forEach((falha) => toast.error(`${falha.nome}: ${falha.erro}`))
    }

    if (state.sucesso && state.sucesso.length > 0) {
      formRef.current?.reset()
      setFileNames([])
      toast.success(
        state.sucesso.length === 1
          ? 'Relatório anexado com sucesso!'
          : `${state.sucesso.length} relatórios anexados com sucesso!`
      )
      setShowGerarDialog(true)
    }
  }, [state])

  function handleGerarAuditoria() {
    const sucesso = state?.sucesso
    if (!sucesso || sucesso.length === 0) return
    const triggerId = sucesso.length === 1 ? sucesso[0].id : null
    startGerarTransition(async () => {
      const res = await gerarAuditoriaManual('add', triggerId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setShowGerarDialog(false)
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (fileNames.length === 0) {
      e.preventDefault()
      toast.error('Selecione ao menos um arquivo CSV.')
    }
  }

  return (
    <>
      <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>Arquivo(s) CSV (exportado do Moodle)</Label>
          <label
            htmlFor="arquivo-rel"
            className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all py-8 px-4 text-center
              ${pending ? 'opacity-50 cursor-not-allowed' : ''}
              ${fileNames.length > 0
                ? 'border-primary/50 bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-primary/3'
              }`}
          >
            {fileNames.length > 0 ? (
              <>
                <FileCheck2 className="w-7 h-7 text-primary mb-2" />
                <span className="text-sm font-medium text-primary truncate max-w-full px-4">
                  {fileNames.length === 1
                    ? fileNames[0]
                    : `${fileNames.length} arquivos selecionados`}
                </span>
                <span className="text-xs text-muted-foreground mt-1 truncate max-w-full px-4">
                  {fileNames.length === 1 ? 'Clique para trocar o arquivo' : fileNames.join(', ')}
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="w-7 h-7 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-foreground">
                  Clique para selecionar um ou mais arquivos
                </span>
                <span className="text-xs text-muted-foreground mt-1">CSV exportado do Moodle</span>
              </>
            )}
          </label>
          <Input
            id="arquivo-rel"
            name="arquivos"
            type="file"
            accept=".csv"
            multiple
            disabled={pending}
            className="sr-only"
            onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
          />
        </div>

        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              Adicionar relatório(s)
            </>
          )}
        </Button>
      </form>

      <AlertDialog
        open={showGerarDialog}
        onOpenChange={(open) => {
          if (!open) setShowGerarDialog(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {state?.sucesso && state.sucesso.length > 1
                ? 'Relatórios anexados'
                : 'Relatório anexado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {state?.sucesso && state.sucesso.length > 1
                ? `${state.sucesso.length} relatórios foram anexados com sucesso. Deseja gerar a auditoria agora?`
                : 'O relatório foi anexado com sucesso. Deseja gerar a auditoria agora?'}
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
