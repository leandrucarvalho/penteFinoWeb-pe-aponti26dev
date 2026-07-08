import { describe, it, expect } from 'vitest'
import { derivarUfsDisponiveis, formatarResumoUfs } from './audit-result-table-utils'

describe('derivarUfsDisponiveis', () => {
  it('retorna vazio quando as duas listas estão vazias', () => {
    expect(derivarUfsDisponiveis([], [])).toEqual([])
  })

  it('exclui estados vazios', () => {
    const naoFeitos = [{ estado: '' }, { estado: 'PE' }]
    const feitos = [{ estado: '' }]
    expect(derivarUfsDisponiveis(naoFeitos, feitos)).toEqual(['PE'])
  })

  it('deduplica UFs repetidos entre as duas listas', () => {
    const naoFeitos = [{ estado: 'PE' }, { estado: 'SP' }]
    const feitos = [{ estado: 'SP' }, { estado: 'PE' }]
    expect(derivarUfsDisponiveis(naoFeitos, feitos)).toEqual(['PE', 'SP'])
  })

  it('ordena alfabeticamente (pt-BR)', () => {
    const naoFeitos = [{ estado: 'SP' }, { estado: 'AC' }, { estado: 'PE' }]
    expect(derivarUfsDisponiveis(naoFeitos, [])).toEqual(['AC', 'PE', 'SP'])
  })
})

describe('formatarResumoUfs', () => {
  it('retorna "UF" quando nenhuma UF está selecionada', () => {
    expect(formatarResumoUfs([])).toBe('UF')
  })

  it('retorna a sigla quando 1 UF está selecionada', () => {
    expect(formatarResumoUfs(['PE'])).toBe('PE')
  })

  it('junta as duas siglas quando 2 UFs estão selecionadas', () => {
    expect(formatarResumoUfs(['PE', 'SP'])).toBe('PE, SP')
  })

  it('mostra as duas primeiras + contagem do restante quando 3+ UFs estão selecionadas', () => {
    expect(formatarResumoUfs(['AC', 'AL', 'AM', 'AP'])).toBe('AC, AL +2')
  })
})
