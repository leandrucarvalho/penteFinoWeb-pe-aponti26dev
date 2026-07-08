'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarAuditoria } from '@/lib/gerar-auditoria'
import { registrarLog } from '@/lib/system-log'

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

type ActionState = { error?: string; success?: boolean; relatorioId?: string } | null

export async function adicionarRelatorio(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await verificarAdmin()
    const supabase = await createClient()

    const nome = formData.get('nome') as string
    const semana = formData.get('semana') as string
    const arquivo = formData.get('arquivo') as File

    if (!nome || !semana) return { error: 'Preencha nome e semana.' }
    if (!arquivo || arquivo.size === 0) return { error: 'Selecione um arquivo CSV.' }

    const relatorioId = crypto.randomUUID()
    const storagePath = `${relatorioId}/arquivo.csv`

    const { error: uploadError } = await supabase.storage
      .from('relatorios')
      .upload(storagePath, arquivo, { upsert: true })

    if (uploadError) return { error: `Erro no upload: ${uploadError.message}` }

    const { error: insertError } = await supabase.from('relatorios').insert({
      id: relatorioId,
      nome,
      semana,
      storage_path: storagePath,
      user_id: user.id,
    })

    if (insertError) return { error: `Erro ao registrar: ${insertError.message}` }

    await registrarLog({
      userId: user.id,
      userEmail: user.email!,
      action: 'relatorio.adicionar',
      target: relatorioId,
      details: { nome, semana },
    })

    revalidatePath('/relatorios')
    return { success: true, relatorioId }
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
