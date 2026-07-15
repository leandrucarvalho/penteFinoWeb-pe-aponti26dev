# Selecionar vários e excluir relatórios em lote — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir marcar vários relatórios ativos com checkboxes e excluí-los numa única confirmação, reaproveitando a mesma action para a exclusão individual já existente.

**Architecture:** `deletarRelatorio(id)` vira `deletarRelatorios(ids: string[])` em `app/(protected)/relatorios/actions.ts` (soft-delete sequencial, tolerante a falha parcial, mesmo padrão `{ sucesso, falhas }` de `adicionarRelatorios`). `components/RelatoriosList.tsx` ganha uma barra de seleção (checkbox "selecionar todos" + botão "Excluir selecionados") e um `Checkbox` por linha; a lixeira individual passa a chamar a mesma função interna `excluir(ids)` usada pelo botão em lote. O diálogo final "gerar auditoria?" cobre tanto exclusão individual quanto em lote.

**Tech Stack:** Next.js 16 Server Actions, Supabase, shadcn/ui (`@base-ui/react`), Sonner (toast).

**Spec:** `docs/superpowers/specs/2026-07-14-selecionar-varios-excluir-relatorios-design.md`

---

## Task 1: Instalar o componente Checkbox

**Files:**
- Create: `components/ui/checkbox.tsx` (gerado pelo CLI, não escrito à mão)

- [ ] **Step 1: Rodar o CLI do shadcn**

Run: `npx shadcn add checkbox`

Expected: cria `components/ui/checkbox.tsx`, sem sobrescrever nenhum arquivo existente (`components.json` já configurado com `style: base-nova`, `iconLibrary: lucide`, aliases `@/components/ui`).

- [ ] **Step 2: Conferir o arquivo gerado**

Abrir `components/ui/checkbox.tsx` e confirmar que exporta um componente `Checkbox` que aceita (via `@base-ui/react/checkbox` `CheckboxPrimitive.Root.Props`): `checked?: boolean`, `onCheckedChange?: (checked: boolean, eventDetails) => void`, `indeterminate?: boolean`, `disabled?: boolean`, `className?: string`. Se o CLI pedir confirmação de alguma dependência extra, aceitar (o projeto já usa `@base-ui/react` e `lucide-react`).

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add components/ui/checkbox.tsx components.json package.json package-lock.json
git commit -m "feat: adicionar componente Checkbox via shadcn"
```

(Se `npx shadcn add` não alterar `components.json`/`package.json`, faça `git add` só do que de fato mudou — confira com `git status` antes.)

---

## Task 2: Substituir `deletarRelatorio` por `deletarRelatorios` na Server Action

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts:147-166`

O arquivo atual (linhas 147-166) tem:

```ts
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
```

- [ ] **Step 1: Substituir pela versão em lote**

Trocar o bloco acima (linhas 147-166) por:

```ts
export async function deletarRelatorios(
  relatorioIds: string[]
): Promise<{ sucesso: string[]; falhas: { id: string; erro: string }[] }> {
  const admin = await verificarAdmin()
  const supabase = await createClient()

  const sucesso: string[] = []
  const falhas: { id: string; erro: string }[] = []

  for (const relatorioId of relatorioIds) {
    const { error } = await supabase
      .from('relatorios')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', relatorioId)

    if (error) {
      falhas.push({ id: relatorioId, erro: error.message })
      continue
    }

    await registrarLog({
      userId: admin.id,
      userEmail: admin.email!,
      action: 'relatorio.deletar',
      target: relatorioId,
    })

    sucesso.push(relatorioId)
  }

  if (sucesso.length > 0) revalidatePath('/relatorios')

  return { sucesso, falhas }
}
```

Note que `relatorioIds` pode ter 1 elemento (caso da lixeira individual) ou N (caso do botão em lote) — a mesma função cobre os dois.

- [ ] **Step 2: Verificar que não sobrou nenhuma referência a `deletarRelatorio` (singular)**

Run: `grep -rn "deletarRelatorio[^s]" app components --include="*.ts" --include="*.tsx"` (ou usar a ferramenta de busca do editor)
Expected: nenhuma ocorrência fora de `deletarRelatorios` (a próxima task vai atualizar `RelatoriosList.tsx`, que hoje importa a versão singular — está OK ainda estar "quebrado" nesse ponto intermediário, a Task 3 conserta).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: erro esperado em `components/RelatoriosList.tsx` (import de `deletarRelatorio` que não existe mais) — será resolvido na Task 3. Nenhum outro erro deve aparecer.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts"
git commit -m "feat: substituir deletarRelatorio por deletarRelatorios (suporte a lote)"
```

---

## Task 3: Reescrever `RelatoriosList.tsx` com seleção múltipla e exclusão em lote

**Files:**
- Modify: `components/RelatoriosList.tsx` (reescrita completa do arquivo)

O arquivo atual está totalmente reproduzido abaixo como referência do "antes" (para contexto de quem for implementar, não precisa copiar isto — é só a base de comparação):

```tsx
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
```

- [ ] **Step 1: Substituir o arquivo inteiro**

Escrever `components/RelatoriosList.tsx` com o conteúdo abaixo:

```tsx
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
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [excluindo, setExcluindo] = useState(false)
  const [idsExcluidos, setIdsExcluidos] = useState<string[] | null>(null)
  const [gerando, setGerando] = useState(false)

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
    } finally {
      setExcluindo(false)
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
          <AlertDialog>
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
```

Pontos importantes desta implementação, para quem for revisar:
- `excluir(ids)` é a única função que chama `deletarRelatorios` — tanto a lixeira individual (`excluir([r.id])`) quanto o botão em lote (`excluir([...selecionados])`) passam por ela, conforme o spec.
- O checkbox "selecionar todos" usa `checked` (boolean) e `indeterminate` (boolean) como props separadas — o Base UI Checkbox não aceita `'indeterminate'` como valor de `checked`, é um prop à parte que só controla a aparência visual (o valor lógico de `checked` continua sendo `todosSelecionados`).
- `onCheckedChange` do Base UI Checkbox entrega `(checked: boolean, eventDetails)` — só o primeiro argumento é usado aqui.
- IDs com falha na exclusão continuam em `selecionados` (não são removidos), então o admin pode tentar de novo — só os IDs de `sucesso` saem do Set.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar lint**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 4: Rodar a suíte de testes**

Run: `npm test`
Expected: todos os testes continuam passando (este componente não tem teste automatizado, mesma situação de antes — não é regressão).

- [ ] **Step 5: Commit**

```bash
git add components/RelatoriosList.tsx
git commit -m "feat: selecionar varios relatorios e excluir em lote"
```

---

## Task 4: Verificação manual end-to-end

**Files:** nenhum arquivo novo — apenas verificação.

- [ ] **Step 1: Rodar o build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: Subir o servidor de desenvolvimento**

Run: `npm run dev`

- [ ] **Step 3: Testar manualmente em `/relatorios` (logado como admin)**

Roteiro:
1. Com pelo menos 3 relatórios ativos: marcar o checkbox de 2 deles individualmente → confirmar que o contador "2 selecionado(s)" aparece e o botão "Excluir selecionados (2)" surge.
2. Clicar "Excluir selecionados (2)" → confirmar no `AlertDialog` → confirmar que os 2 somem da lista e o diálogo "Relatórios excluídos... gerar auditoria agora?" (plural) apareça.
3. Clicar "Gerar auditoria" e confirmar que não dá erro (ou cancelar o diálogo e confirmar que fecha sem gerar).
4. Marcar o checkbox "selecionar todos" → confirmar que todos os itens restantes ficam marcados; desmarcar um item individualmente → confirmar que o checkbox "selecionar todos" fica no estado indeterminado (traço, não check cheio).
5. Excluir um único relatório pela lixeira individual (sem usar checkboxes) → confirmar que o diálogo final aparece no singular ("Relatório excluído... gerar a auditoria agora?").
6. Com a lista vazia (excluir tudo, ou testar em ambiente com zero relatórios): confirmar que a tela volta ao estado vazio ("Nenhum relatório adicionado") sem erros no console.

- [ ] **Step 4: Reportar resultado**

Se algum passo falhar, anotar o comportamento observado antes de prosseguir para o code review final.

---

## Notas gerais

- Este plano assume execução na branch `feat/anexar-multiplos-relatorios` (já existente, com PR #68 aberto contra `develop`) — **não criar uma nova branch**. Ao final, `git push` deve atualizar o PR #68 existente, não criar um novo.
- `deletarRelatorios` depende de `SupabaseClient` real, sem suíte automatizada — mesma situação já aceita para `adicionarRelatorios`/`gerarAuditoria` neste projeto (ver spec, seção Testes).
