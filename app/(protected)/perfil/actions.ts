'use server'

import { createClient } from '@/lib/supabase/server'
import { registrarLog } from '@/lib/system-log'

export async function atualizarPerfil(data: {
  nome: string
  telefone: string
  cargo: string
  funcao: string
}): Promise<{ error?: string }> {
  const nome = data.nome.trim()
  const telefone = data.telefone.trim()
  const cargo = data.cargo.trim()
  const funcao = data.funcao.trim()

  if (nome.length > 100) return { error: 'Nome deve ter no máximo 100 caracteres' }
  if (telefone.length > 20) return { error: 'Telefone deve ter no máximo 20 caracteres' }
  if (cargo.length > 100) return { error: 'Cargo deve ter no máximo 100 caracteres' }
  if (funcao.length > 100) return { error: 'Função deve ter no máximo 100 caracteres' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Sessão inválida' }

  const { error } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, nome, telefone, cargo, funcao },
  })

  if (error) return { error: 'Não foi possível atualizar os dados. Tente novamente.' }

  return {}
}

export async function alterarSenha(
  senhaAtual: string,
  novaSenha: string
): Promise<{ error?: string }> {
  if (novaSenha.length < 6) return { error: 'A nova senha deve ter pelo menos 6 caracteres' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return { error: 'Sessão inválida' }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senhaAtual,
  })

  if (reauthError) return { error: 'Senha atual incorreta' }

  const { error } = await supabase.auth.updateUser({ password: novaSenha })

  if (error) return { error: 'Não foi possível atualizar a senha. Tente novamente.' }

  await registrarLog({
    userId: user.id,
    userEmail: user.email,
    action: 'senha.alterar',
    target: user.id,
  })

  return {}
}
