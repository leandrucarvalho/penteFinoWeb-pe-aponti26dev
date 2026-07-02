import { describe, it, expect } from 'vitest'
import {
  normalizarNome,
  normalizarUF,
  parsearGrupos,
  carregarAlunos,
  carregarRelatorio,
  extrairGruposRelatorio,
  aplicarFallbackGrupos,
  calcularAusencias,
  calcularPresencas,
} from './pente-fino'

// Formato A: coluna "residente" (estado fica vazio, empresa da coluna "empresa")
const CSV_ALUNOS_A = `residente,empresa
João  Silva,Empresa X
maria souza,Empresa Y`

// Formato B: colunas "Nome", "Sobrenome", "Grupos" — parsear_grupos extrai estado:empresa
const CSV_ALUNOS_B = `Nome,Sobrenome,Grupos
João,Silva,PE:Empresa X - 12345678/0001-99
Maria,Souza,CE:Empresa Y - 98765432/0001-11`

// Relatório com coluna "Nome completo" (exato)
const CSV_REL_COM_COLUNA = `Nome completo,Email
João Silva,joao@x.com
Pedro Lima,pedro@y.com`

// Relatório sem a coluna obrigatória
const CSV_REL_SEM_COLUNA = `Outro,Header
A,B`

// Relatório com coluna "Grupos" preenchida para um aluno, vazia para outro
const CSV_REL_COM_GRUPOS = `Nome completo,Grupos,Email
João Silva,Maranhão: Hermes - 42.441.933/0001-64,joao@x.com
Pedro Lima,,pedro@x.com`

describe('normalizarNome', () => {
  it('coloca em minúsculo e colapsa espaços múltiplos', () => {
    expect(normalizarNome('  João  Silva  ')).toBe('joão silva')
  })

  it('mantém nome simples sem alteração além de minúsculo', () => {
    expect(normalizarNome('Maria Souza')).toBe('maria souza')
  })
})

describe('normalizarUF', () => {
  it('converte nome completo do estado (com acento) para sigla', () => {
    expect(normalizarUF('Maranhão')).toBe('MA')
  })

  it('mantém sigla já válida inalterada', () => {
    expect(normalizarUF('PE')).toBe('PE')
  })

  it('converte sigla em minúsculo para maiúsculo', () => {
    expect(normalizarUF('pe')).toBe('PE')
  })

  it('mantém valor desconhecido sem alteração', () => {
    expect(normalizarUF('Nao Existe')).toBe('Nao Existe')
  })

  it('retorna string vazia para entrada vazia', () => {
    expect(normalizarUF('')).toBe('')
  })

  it('normaliza nome completo do estado todo em maiúsculo', () => {
    expect(normalizarUF('MARANHÃO')).toBe('MA')
  })
})

describe('parsearGrupos', () => {
  it('extrai estado e empresa do formato "UF:Empresa - CNPJ"', () => {
    const [estado, empresa] = parsearGrupos('PE:Empresa X - 12345678/0001-99')
    expect(estado).toBe('PE')
    expect(empresa).toBe('Empresa X')
  })

  it('funciona com espaço após os dois-pontos', () => {
    const [estado, empresa] = parsearGrupos('CE: Empresa Y - 98765432/0001-11')
    expect(estado).toBe('CE')
    expect(empresa).toBe('Empresa Y')
  })

  it('retorna strings vazias para entrada inválida', () => {
    const [estado, empresa] = parsearGrupos('semformato')
    expect(estado).toBe('')
  })

  it('normaliza nome completo do estado para sigla', () => {
    const [estado, empresa] = parsearGrupos('Maranhão: Hermes - 42.441.933/0001-64')
    expect(estado).toBe('MA')
    expect(empresa).toBe('Hermes')
  })
})

describe('carregarAlunos', () => {
  it('carrega formato A (coluna residente) — nome normalizado correto', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    expect(alunos).toHaveLength(2)
    expect(alunos[0].nomeNormalizado).toBe('joão silva')
    expect(alunos[0].empresa).toBe('Empresa X')
  })

  it('carrega formato B (Nome + Sobrenome + Grupos) — estado e empresa extraídos', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_B)
    expect(alunos).toHaveLength(2)
    expect(alunos[0].nomeNormalizado).toBe('joão silva')
    expect(alunos[0].estado).toBe('PE')
    expect(alunos[0].empresa).toBe('Empresa X')
  })
})

describe('carregarRelatorio', () => {
  it('retorna Set de nomes normalizados da coluna "Nome completo"', () => {
    const nomes = carregarRelatorio(CSV_REL_COM_COLUNA)
    expect(nomes).not.toBeNull()
    expect(nomes!.has('joão silva')).toBe(true)
    expect(nomes!.has('pedro lima')).toBe(true)
    expect(nomes!.size).toBe(2)
  })

  it('retorna null se coluna "Nome completo" ausente', () => {
    expect(carregarRelatorio(CSV_REL_SEM_COLUNA)).toBeNull()
  })
})

describe('extrairGruposRelatorio', () => {
  it('extrai estado (normalizado) e empresa por nome normalizado', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS)
    expect(grupos.get('joão silva')).toEqual(['MA', 'Hermes'])
  })

  it('ignora aluno com célula de Grupos vazia', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS)
    expect(grupos.has('pedro lima')).toBe(false)
  })

  it('retorna Map vazio se não houver coluna Grupos', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_COLUNA)
    expect(grupos.size).toBe(0)
  })
})

describe('aplicarFallbackGrupos', () => {
  it('preenche estado vazio a partir do fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A) // Formato A: estado sempre vazio
    const grupos = new Map<string, [string, string]>([['joão silva', ['MA', 'Hermes']]])
    const resultado = aplicarFallbackGrupos(alunos, grupos)

    const joao = resultado.find((a) => a.nomeNormalizado === 'joão silva')!
    expect(joao.estado).toBe('MA')
  })

  it('não sobrescreve estado já preenchido pela planilha geral', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_B) // já tem estado 'PE' para João
    const grupos = new Map<string, [string, string]>([['joão silva', ['MA', 'Outra Empresa']]])
    const resultado = aplicarFallbackGrupos(alunos, grupos)

    const joao = resultado.find((a) => a.nomeNormalizado === 'joão silva')!
    expect(joao.estado).toBe('PE')
  })

  it('ignora alunos sem correspondência no fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    const resultado = aplicarFallbackGrupos(alunos, new Map())
    expect(resultado).toEqual(alunos)
  })

  it('preenche empresa vazia a partir do fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A) // Formato A: estado e o teste aqui força empresa vazia
    const alunoSemEmpresa = alunos.map((a) => ({ ...a, empresa: '' }))
    const grupos = new Map<string, [string, string]>([['joão silva', ['MA', 'Hermes']]])
    const resultado = aplicarFallbackGrupos(alunoSemEmpresa, grupos)

    const joao = resultado.find((a) => a.nomeNormalizado === 'joão silva')!
    expect(joao.empresa).toBe('Hermes')
  })
})

describe('calcularAusencias', () => {
  it('detecta quem NÃO fez o relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA)! // só João e Pedro estão — Maria ausente
    const resultado = calcularAusencias(alunos, { 'Relatório 1': rel })

    const maria = resultado.find((r) =>
      r.nomeCompleto.toLowerCase().includes('maria')
    )!
    expect(maria.totalAusencias).toBe(1)
    expect(maria.relatoriosAusentes).toContain('Relatório 1')

    const joao = resultado.find((r) =>
      r.nomeCompleto.toLowerCase().includes('joão')
    )!
    expect(joao.totalAusencias).toBe(0)
    expect(joao.relatoriosAusentes).toBe('')
  })
})

describe('calcularPresencas', () => {
  it('detecta quem FEZ o relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA)!
    const resultado = calcularPresencas(alunos, { 'Relatório 1': rel })

    const joao = resultado.find((r) =>
      r.nomeCompleto.toLowerCase().includes('joão')
    )!
    expect(joao.totalFeitos).toBe(1)
    expect(joao.relatoriosFeitos).toContain('Relatório 1')

    const maria = resultado.find((r) =>
      r.nomeCompleto.toLowerCase().includes('maria')
    )!
    expect(maria.totalFeitos).toBe(0)
  })
})

describe('integração: fallback de UF do relatório semanal', () => {
  it('aluno sem UF na planilha geral (Formato A) recebe UF/empresa extraídas do relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS)
    const enriquecidos = aplicarFallbackGrupos(alunos, grupos)

    const joao = enriquecidos.find((a) => a.nomeNormalizado === 'joão silva')!
    expect(joao.estado).toBe('MA')
    // empresa já vinha preenchida pela planilha geral (Empresa X) — não é sobrescrita
    expect(joao.empresa).toBe('Empresa X')

    const maria = enriquecidos.find((a) => a.nomeNormalizado === 'maria souza')!
    // Maria não aparece em nenhum relatório com Grupos preenchido — segue vazia
    expect(maria.estado).toBe('')
  })
})
