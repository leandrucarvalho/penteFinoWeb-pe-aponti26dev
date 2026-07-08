import { describe, it, expect } from 'vitest'
import { derivarUfsDisponiveis } from './audit-result-table-utils'

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
