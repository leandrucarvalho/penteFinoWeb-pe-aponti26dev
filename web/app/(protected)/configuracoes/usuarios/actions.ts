'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function verificarAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') throw new Error('Acesso negado')
  return user
}

export async function criarUsuario(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  try {
    await verificarAdmin()

    const email = formData.get('email') as string
    const senha = formData.get('senha') as string
    const role = formData.get('role') as string
    const nome = (formData.get('nome') as string) ?? ''
    const telefone = (formData.get('telefone') as string) ?? ''
    const cargo = (formData.get('cargo') as string) ?? ''
    const funcao = (formData.get('funcao') as string) ?? ''

    if (!email || !senha || !role) return { error: 'Email, senha e perfil são obrigatórios' }
    if (senha.length < 6) return { error: 'Senha deve ter pelo menos 6 caracteres' }

    const supabase = createServiceClient()
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      app_metadata: { role },
      user_metadata: { nome, telefone, cargo, funcao },
      email_confirm: true,
    })

    if (error) return { error: error.message }

    revalidatePath('/configuracoes/usuarios')
    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

export async function atualizarUsuario(
  userId: string,
  data: { nome: string; telefone: string; cargo: string; funcao: string; role: 'admin' | 'user' }
) {
  await verificarAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { nome: data.nome, telefone: data.telefone, cargo: data.cargo, funcao: data.funcao },
    app_metadata: { role: data.role },
  })
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/usuarios')
}

export async function deletarUsuario(userId: string) {
  const admin = await verificarAdmin()
  if (admin.id === userId) throw new Error('Não é possível deletar seu próprio usuário')
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/usuarios')
}
