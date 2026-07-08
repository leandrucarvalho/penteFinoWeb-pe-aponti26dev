import { createServiceClient } from '@/lib/supabase/server'

export type SystemLogAction =
  | 'usuario.criar'
  | 'usuario.atualizar'
  | 'usuario.deletar'
  | 'relatorio.adicionar'
  | 'relatorio.deletar'
  | 'auditoria.gerar'
  | 'senha.alterar'
  | 'auth.login'
  | 'auth.logout'

export const ACTION_LABELS: Record<SystemLogAction, string> = {
  'usuario.criar': 'Criou usuário',
  'usuario.atualizar': 'Atualizou usuário',
  'usuario.deletar': 'Removeu usuário',
  'relatorio.adicionar': 'Adicionou relatório',
  'relatorio.deletar': 'Removeu relatório',
  'auditoria.gerar': 'Gerou auditoria',
  'senha.alterar': 'Alterou senha',
  'auth.login': 'Login',
  'auth.logout': 'Logout',
}

export async function registrarLog(params: {
  userId: string
  userEmail: string
  action: SystemLogAction
  target?: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('system_logs').insert({
      user_id: params.userId,
      user_email: params.userEmail,
      action: params.action,
      target: params.target ?? null,
      details: params.details ?? null,
    })
    if (error) console.error('registrarLog: falha ao inserir log', error)
  } catch (e) {
    // Log é best-effort: uma falha aqui nunca deve derrubar a ação principal.
    console.error('registrarLog: falha ao inserir log', e)
  }
}
