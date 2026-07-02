import Papa from 'papaparse'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  carregarAlunos,
  carregarRelatorio,
  extrairGruposRelatorio,
  aplicarFallbackGrupos,
  calcularAusencias,
  calcularPresencas,
  type ResultadoAusencia,
  type ResultadoPresenca,
} from './pente-fino'

export async function gerarAuditoria(
  triggerType: 'add' | 'delete' | 'manual',
  relatorioTriggerId: string | null,
  supabase: SupabaseClient
): Promise<void> {

  // 1. Planilha geral mais recente
  const { data: planilhas, error: errPlanilha } = await supabase
    .from('planilha_geral')
    .select('storage_path')
    .order('uploaded_at', { ascending: false })
    .limit(1)

  if (errPlanilha || !planilhas?.length) {
    throw new Error('Nenhuma planilha geral encontrada. Faça upload em /configuracoes primeiro.')
  }

  const { data: planilhaFile } = await supabase.storage
    .from('planilha-geral')
    .download(planilhas[0].storage_path)

  if (!planilhaFile) throw new Error('Falha ao baixar planilha geral do Storage')
  const planilhaText = await planilhaFile.text()

  // 2. Buscar todos os relatórios ativos (sem soft delete)
  const { data: relatorios } = await supabase
    .from('relatorios')
    .select('id, nome, storage_path')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (!relatorios?.length) {
    // Sem relatórios ativos — registrar auditoria vazia
    await supabase.from('auditorias').insert({
      trigger_type: triggerType,
      relatorio_trigger_id: relatorioTriggerId,
      relatorios_incluidos: [],
      resultado_json: { nao_feitos: [], feitos: [] },
    })
    return
  }

  // 3. Baixar e parsear cada CSV de relatório
  const relatoriosMap: Record<string, Set<string>> = {}
  const relatoriosIds: string[] = []
  const gruposPorRelatorio: Map<string, [string, string]>[] = []

  for (const rel of relatorios) {
    const { data: relFile } = await supabase.storage
      .from('relatorios')
      .download(rel.storage_path)

    if (!relFile) {
      console.warn(`Relatório ${rel.nome}: falha ao baixar do Storage`)
      continue
    }

    const text = await relFile.text()
    const nomes = carregarRelatorio(text)

    if (nomes === null) {
      console.warn(`Relatório ${rel.nome}: coluna "Nome completo" ausente — ignorado`)
      continue
    }

    relatoriosMap[rel.nome] = nomes
    relatoriosIds.push(rel.id)
    gruposPorRelatorio.push(extrairGruposRelatorio(text))
  }

  // 4. Processar
  const alunos = carregarAlunos(planilhaText)
  let alunosEnriquecidos = alunos
  for (const grupos of gruposPorRelatorio) {
    alunosEnriquecidos = aplicarFallbackGrupos(alunosEnriquecidos, grupos)
  }
  const naoFeitos = calcularAusencias(alunosEnriquecidos, relatoriosMap)
  const feitos = calcularPresencas(alunosEnriquecidos, relatoriosMap)

  // 5. Serializar para CSV
  const csvNaoFeitos = Papa.unparse(
    naoFeitos.map((r) => ({
      'Nome Completo': r.nomeCompleto,
      Estado: r.estado,
      Empresa: r.empresa,
      'Relatórios Ausentes': r.relatoriosAusentes,
      'Total Ausências': r.totalAusencias,
    }))
  )

  const csvFeitos = Papa.unparse(
    feitos.map((r) => ({
      'Nome Completo': r.nomeCompleto,
      Estado: r.estado,
      Empresa: r.empresa,
      'Relatórios Feitos': r.relatoriosFeitos,
      'Total Feitos': r.totalFeitos,
    }))
  )

  // 6. Upload CSVs de resultado para Storage
  const auditId = crypto.randomUUID()
  const pathNaoFeitos = `${auditId}/resultado-nao-feitos.csv`
  const pathFeitos = `${auditId}/resultado-feitos.csv`

  await supabase.storage.from('auditorias').upload(
    pathNaoFeitos,
    new Blob(['﻿' + csvNaoFeitos], { type: 'text/csv' }), // BOM para Excel
    { upsert: true }
  )
  await supabase.storage.from('auditorias').upload(
    pathFeitos,
    new Blob(['﻿' + csvFeitos], { type: 'text/csv' }),
    { upsert: true }
  )

  // 7. Inserir registro de auditoria no banco
  const { error } = await supabase.from('auditorias').insert({
    id: auditId,
    trigger_type: triggerType,
    relatorio_trigger_id: relatorioTriggerId,
    relatorios_incluidos: relatoriosIds,
    resultado_json: { nao_feitos: naoFeitos, feitos: feitos },
    resultado_nao_feitos_path: pathNaoFeitos,
    resultado_feitos_path: pathFeitos,
  })

  if (error) throw new Error(`Falha ao registrar auditoria: ${error.message}`)
}
