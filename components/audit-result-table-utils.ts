type ComEstado = { estado: string }

export function derivarUfsDisponiveis(
  naoFeitos: ComEstado[],
  feitos: ComEstado[]
): string[] {
  const set = new Set<string>()
  for (const row of naoFeitos) if (row.estado) set.add(row.estado)
  for (const row of feitos) if (row.estado) set.add(row.estado)
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function formatarResumoUfs(ufs: string[]): string {
  if (ufs.length === 0) return 'UF'
  if (ufs.length <= 2) return ufs.join(', ')
  return `${ufs.slice(0, 2).join(', ')} +${ufs.length - 2}`
}
