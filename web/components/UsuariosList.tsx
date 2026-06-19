'use client'

import { useState, useTransition, useEffect } from 'react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2,
  Shield,
  Trash2,
  User,
  Pencil,
  Phone,
  Briefcase,
  Tag,
  AlertCircle,
} from 'lucide-react'
import {
  deletarUsuario,
  atualizarUsuario,
} from '@/app/(protected)/configuracoes/usuarios/actions'

type UsuarioItem = {
  id: string
  email?: string
  created_at: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

type EditForm = {
  nome: string
  telefone: string
  cargo: string
  funcao: string
  role: 'admin' | 'user'
}

export function UsuariosList({
  users,
  currentUserId,
}: {
  users: UsuarioItem[]
  currentUserId: string
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()
  const [editingUser, setEditingUser] = useState<UsuarioItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    nome: '',
    telefone: '',
    cargo: '',
    funcao: '',
    role: 'user',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  useEffect(() => {
    if (editingUser) {
      setEditForm({
        nome: (editingUser.user_metadata?.nome as string) ?? '',
        telefone: (editingUser.user_metadata?.telefone as string) ?? '',
        cargo: (editingUser.user_metadata?.cargo as string) ?? '',
        funcao: (editingUser.user_metadata?.funcao as string) ?? '',
        role: ((editingUser.app_metadata?.role as string) ?? 'user') as 'admin' | 'user',
      })
      setEditError(null)
    }
  }, [editingUser])

  function handleDelete(userId: string) {
    setPendingId(userId)
    startDelete(async () => {
      try {
        await deletarUsuario(userId)
      } finally {
        setPendingId(null)
      }
    })
  }

  function handleSave() {
    if (!editingUser) return
    setEditError(null)
    startSave(async () => {
      try {
        await atualizarUsuario(editingUser.id, editForm)
        setEditingUser(null)
      } catch (e) {
        setEditError(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  if (!users.length) {
    return <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
  }

  return (
    <>
      <ul className="space-y-2">
        {users.map((u) => {
          const role = (u.app_metadata?.role as string) ?? 'user'
          const nome = (u.user_metadata?.nome as string) ?? ''
          const telefone = (u.user_metadata?.telefone as string) ?? ''
          const cargo = (u.user_metadata?.cargo as string) ?? ''
          const funcao = (u.user_metadata?.funcao as string) ?? ''
          const isCurrentUser = u.id === currentUserId
          const isLoadingThis = pendingId === u.id && isDeleting

          return (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-xl border border-border/60 p-3 gap-3 bg-card"
            >
              {/* Avatar + info */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    role === 'admin'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {role === 'admin' ? (
                    <Shield className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0">
                  {/* Nome + badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium truncate">
                      {nome || u.email?.split('@')[0] || '—'}
                    </p>
                    {role === 'admin' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide shrink-0">
                        admin
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        você
                      </span>
                    )}
                  </div>

                  {/* Email */}
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>

                  {/* Metadata chips */}
                  {(cargo || funcao || telefone) && (
                    <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                      {cargo && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Briefcase className="w-3 h-3 shrink-0" />
                          {cargo}
                        </span>
                      )}
                      {funcao && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Tag className="w-3 h-3 shrink-0" />
                          {funcao}
                        </span>
                      )}
                      {telefone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 shrink-0" />
                          {telefone}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {isLoadingThis ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-2" />
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => setEditingUser(u)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    {!isCurrentUser && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            />
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deletar usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O usuário <strong>{nome || u.email}</strong> será removido
                              permanentemente. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(u.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Deletar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Edit dialog — shared, controlled */}
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <p className="text-xs text-muted-foreground">{editingUser?.email}</p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Perfil de acesso */}
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
                Acesso
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Perfil</Label>
                <select
                  id="edit-role"
                  value={editForm.role}
                  disabled={editingUser?.id === currentUserId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))
                  }
                  className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Admin</option>
                </select>
                {editingUser?.id === currentUserId && (
                  <p className="text-xs text-muted-foreground">
                    Não é possível alterar o próprio perfil.
                  </p>
                )}
              </div>
            </div>

            {/* Dados pessoais */}
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
                Perfil
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-nome">Nome completo</Label>
                  <Input
                    id="edit-nome"
                    value={editForm.nome}
                    onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="João da Silva"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-telefone">Telefone</Label>
                  <Input
                    id="edit-telefone"
                    value={editForm.telefone}
                    onChange={(e) => setEditForm((f) => ({ ...f, telefone: e.target.value }))}
                    placeholder="(81) 99999-9999"
                    type="tel"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-cargo">Cargo</Label>
                  <Input
                    id="edit-cargo"
                    value={editForm.cargo}
                    onChange={(e) => setEditForm((f) => ({ ...f, cargo: e.target.value }))}
                    placeholder="ex: Coordenador"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-funcao">Função</Label>
                  <Input
                    id="edit-funcao"
                    value={editForm.funcao}
                    onChange={(e) => setEditForm((f) => ({ ...f, funcao: e.target.value }))}
                    placeholder="ex: Operações"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          {editError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {editError}
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isSaving} />}>
              Cancelar
            </DialogClose>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
