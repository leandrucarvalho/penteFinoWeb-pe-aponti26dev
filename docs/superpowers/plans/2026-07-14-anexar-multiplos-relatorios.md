# Anexar múltiplos relatórios de uma vez — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir anexar vários relatórios CSV numa única submissão, com nome/semana gerados automaticamente, no lugar do fluxo atual de um arquivo por vez com nome/semana digitados à mão.

**Architecture:** `adicionarRelatorio` (1 arquivo) é substituída por `adicionarRelatorios` (1..N arquivos), que processa cada arquivo em sequência dentro da mesma Server Action, numerando `nome`/`semana` automaticamente a partir da contagem de relatórios ativos e só avançando o número para arquivos que realmente terminam inseridos com sucesso. `AdicionarRelatorioForm.tsx` troca o `<input type="file">` único por `multiple`, remove os campos de texto nome/semana, e passa a reagir a um resultado em lote (sucessos + falhas) em vez de sucesso/erro único.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `useActionState`), Supabase (Postgres + Storage), TypeScript.

Spec: `docs/superpowers/specs/2026-07-14-anexar-multiplos-relatorios-design.md`

---

### Task 1: Aumentar o limite de tamanho de request de Server Actions

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Configurar `bodySizeLimit`**

Find:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

Replace with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: aumentar limite de tamanho de request para anexar varios relatorios"
```

---

### Task 2: Anexar relatórios em lote (action + formulário)

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts`
- Modify: `components/AdicionarRelatorioForm.tsx`

Sem teste automatizado nesta task: `adicionarRelatorios` depende de um `SupabaseClient` real (mesma situação já aceita para `adicionarRelatorio`/`uploadPlanilhaGeral`/`gerarAuditoria` neste projeto — nenhuma dessas tem suíte). Verificado por `npx tsc --noEmit` e, na Task 3, manualmente na UI.

- [ ] **Step 1: Substituir todo o conteúdo de `app/(protected)/relatorios/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarAuditoria } from '@/lib/gerar-auditoria'
import { registrarLog } from '@/lib/system-log'
import { planilhaTemColuna } from '@/lib/pente-fino'

async function verificarAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    throw new Error('Acesso negado: apenas administradores')
  }
  return user
}

type ActionState = {
  error?: string
  sucesso?: { id: string; nome: string }[]
  falhas?: { nome: string; erro: string }[]
} | null

export async function adicionarRelatorios(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await verificarAdmin()
    const supabase = await createClient()

    const arquivosBrutos = formData.getAll('arquivos').filter((f): f is File => f instanceof File)
    if (arquivosBrutos.length === 0) return { error: 'Selecione ao menos um arquivo CSV.' }

    const sucesso: { id: string; nome: string }[] = []
    const falhas: { nome: string; erro: string }[] = []
    const arquivos: File[] = []

    for (const f of arquivosBrutos) {
      if (f.size === 0) {
        falhas.push({ nome: f.name, erro: 'Arquivo vazio.' })
      } else {
        arquivos.push(f)
      }
    }

    if (arquivos.length === 0) return { falhas }

    const { data: planilhas } = await supabase
      .from('planilha_geral')
      .select('id_coluna')
      .order('uploaded_at', { ascending: false })
      .limit(1)

    const idColuna = planilhas?.[0]?.id_coluna
    if (!idColuna) {
      return {
        error:
          'Configure a coluna de identificador na planilha geral (/configuracoes) antes de anexar relatórios.',
      }
    }

    const { data: relatoriosAtivos, error: errAtivos } = await supabase
      .from('relatorios')
      .select('nome')
      .is('deleted_at', null)

    if (errAtivos) {
      return { error: `Erro ao consultar relatórios existentes: ${errAtivos.message}` }
    }

    const maiorNumero = (relatoriosAtivos ?? []).reduce((max, r) => {
      const match = /^Relatório (\d+)$/.exec(r.nome)
      const numero = match ? parseInt(match[1], 10) : 0
      return Math.max(max, numero)
    }, 0)

    let proximoNumero = maiorNumero + 1

    for (const arquivo of arquivos) {
      const nome = `Relatório ${proximoNumero}`
      const semana = `Semana ${proximoNumero}`

      try {
        const texto = await arquivo.text()
        if (!planilhaTemColuna(texto, idColuna)) {
          falhas.push({
            nome: arquivo.name,
            erro: `Coluna de identificador "${idColuna}" ausente.`,
          })
          continue
        }

        const relatorioId = crypto.randomUUID()
        const storagePath = `${relatorioId}/arquivo.csv`

        const { error: uploadError } = await supabase.storage
          .from('relatorios')
          .upload(storagePath, arquivo, { upsert: true })

        if (uploadError) {
          falhas.push({ nome: arquivo.name, erro: `Erro no upload: ${uploadError.message}` })
          continue
        }

        const { error: insertError } = await supabase.from('relatorios').insert({
          id: relatorioId,
          nome,
          semana,
          storage_path: storagePath,
          user_id: user.id,
        })

        if (insertError) {
          falhas.push({ nome: arquivo.name, erro: `Erro ao registrar: ${insertError.message}` })
          continue
        }

        await registrarLog({
          userId: user.id,
          userEmail: user.email!,
          action: 'relatorio.adicionar',
          target: relatorioId,
          details: { nome, semana },
        })

        sucesso.push({ id: relatorioId, nome })
        proximoNumero++
      } catch (e) {
        falhas.push({
          nome: arquivo.name,
          erro: e instanceof Error ? e.message : 'Erro desconhecido',
        })
      }
    }

    if (sucesso.length > 0) revalidatePath('/relatorios')

    return { sucesso, falhas }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

export async function deletarRelatorio(relatorioId: string) {
  const admin = await verificarAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('relatorios')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', relatorioId)

  if (error) throw new Error(`Erro ao deletar: ${error.message}`)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'relatorio.deletar',
    target: relatorioId,
  })

  revalidatePath('/relatorios')
}

export async function gerarAuditoriaManual(
  triggerType: 'add' | 'delete' | 'manual',
  relatorioTriggerId: string | null
): Promise<{ error?: string; success?: boolean }> {
  try {
    const admin = await verificarAdmin()
    const supabase = await createClient()

    await gerarAuditoria(triggerType, relatorioTriggerId, supabase)

    await registrarLog({
      userId: admin.id,
      userEmail: admin.email!,
      action: 'auditoria.gerar',
      details: { triggerType, relatorioTriggerId },
    })

    revalidatePath('/relatorios')
    revalidatePath('/auditorias')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
```

**Correção pós-revisão final (3 mudanças em relação à primeira versão deste arquivo):**

1. **Numeração por maior número existente, não por contagem.** A primeira versão calculava `proximoNumero = (count de relatórios ativos) + 1`. Isso quebra quando um relatório do **meio** da lista é excluído (não o mais recente): se existem "Relatório 1/2/3" ativos e o #2 é excluído, a contagem ativa cai pra 2, e o próximo upload vira "Relatório 3" de novo — colidindo com o #3, que continua ativo. Como `gerarAuditoria` (`lib/gerar-auditoria.ts`) indexa os relatórios por `nome` num objeto simples (`relatoriosMap[rel.nome] = ids`), essa colisão faz um relatório sobrescrever o outro **silenciosamente**, corrompendo o resultado da auditoria sem nenhum erro visível ao admin. A correção lê o `nome` de todos os relatórios ativos, extrai o maior número já usado (regex `/^Relatório (\d+)$/`) e soma 1 — isso ainda reaproveita o número ao excluir o **mais recente** (o caso que motivou a numeração automática), mas nunca colide com um relatório que continua ativo no meio da lista.
2. **Arquivo de 0 bytes vira uma falha reportada, não é descartado em silêncio.** A primeira versão filtrava `size > 0` antes de decidir se a lista de arquivos estava vazia, então um arquivo vazio dentro de um lote maior simplesmente desaparecia sem toast nem entrada em `falhas` — diferente do comportamento antigo (`adicionarRelatorio` retornava erro explícito pra arquivo vazio). Agora arquivos de 0 bytes entram em `falhas` com o motivo `'Arquivo vazio.'`, e só retornam erro genérico se **todos** os arquivos enviados estiverem vazios.
3. **Erro da consulta de relatórios ativos não é mais ignorado.** A primeira versão desestruturava só `count`, sem checar `error` — se a query falhasse, `count` ficava `null`/`undefined` e a numeração silenciosamente recomeçava do 1 (mesma classe de colisão do item 1). Agora `errAtivos` é checado e retorna erro explícito antes de prosseguir.

`deletarRelatorio` e `gerarAuditoriaManual` são copiados sem alteração (só `adicionarRelatorio` vira `adicionarRelatorios`) — o arquivo é reescrito por completo para deixar claro o estado final, mas essas duas funções continuam idênticas ao que já existia.

- [ ] **Step 2: Substituir todo o conteúdo de `components/AdicionarRelatorioForm.tsx`**

```tsx
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Confirma que não sobrou nenhuma referência a `adicionarRelatorio` no singular em nenhum outro arquivo — o único consumidor era este componente.)

- [ ] **Step 4: Rodar a suíte de testes**

Run: `npm test`
Expected: PASS — nenhum teste referencia `adicionarRelatorio`/`adicionarRelatorios` (não há suíte para Server Actions neste projeto), então a suíte existente deve continuar passando sem mudança de contagem.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts" components/AdicionarRelatorioForm.tsx
git commit -m "feat: permitir anexar varios relatorios de uma vez"
```

---

### Task 3: Regressão completa e verificação manual

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build passa sem erros de tipo.

- [ ] **Step 2: Verificação manual na UI (obrigatória — não coberta por teste automatizado)**

Com um usuário admin, em `/relatorios`, com uma planilha geral já configurada com coluna de identificador (feature anterior, já em produção):

1. Selecione **vários** arquivos CSV de uma vez no seletor de arquivo (o input agora aceita múltipla seleção). Confirme que a caixa de upload mostra "N arquivos selecionados" e a lista de nomes.
2. Envie. Confirme que todos aparecem na lista de relatórios (`/relatorios`) com nomes sequenciais ("Relatório X", "Relatório X+1", ...) continuando a partir da contagem de relatórios já existentes.
3. Confirme que aparece **um único** diálogo perguntando se quer gerar a auditoria (não um por arquivo), e que o texto está no plural ("N relatórios foram anexados...").
4. Com pelo menos 3 relatórios ativos (ex: "Relatório 1", "Relatório 2", "Relatório 3"), delete o **mais recente** ("Relatório 3"). Anexe um novo arquivo (só 1) e confirme que ele reaproveita esse número ("Relatório 3" de novo).
5. Com pelo menos 3 relatórios ativos, delete um do **meio** (ex: "Relatório 2", mantendo "Relatório 1" e "Relatório 3" ativos). Anexe um novo arquivo (só 1) e confirme que ele **não** colide com "Relatório 3" — deve virar "Relatório 4", não "Relatório 3" de novo. Gere uma auditoria depois disso e confirme que ela cobre os 4 relatórios ativos sem nenhum sumir do resultado.
6. Selecione um lote onde **um** dos arquivos não tem a coluna de identificador configurada na planilha geral (ex: renomeie a coluna nesse CSV específico antes de testar) e os outros têm. Confirme que os válidos são anexados normalmente, aparece um toast de erro específico para o arquivo inválido (com o motivo), e o diálogo de gerar auditoria ainda aparece cobrindo os que tiveram sucesso.
7. Anexe só **1** arquivo (fluxo antigo) e confirme que o comportamento continua idêntico ao que já existia: diálogo no singular, `gerarAuditoriaManual` chamado com o ID daquele relatório específico (não `null`).

Reporte ao usuário humano o resultado dessa verificação manual antes de considerar o trabalho concluído — nenhuma sessão anterior neste projeto teve credenciais de admin disponíveis para testar isso de ponta a ponta automaticamente.
