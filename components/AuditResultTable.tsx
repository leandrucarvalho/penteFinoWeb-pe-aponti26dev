'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Download,
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'

type NaoFeito = {
  nomeCompleto: string
  estado: string
  empresa: string
  relatoriosAusentes: string
  totalAusencias: number
}

type Feito = {
  nomeCompleto: string
  estado: string
  empresa: string
  relatoriosFeitos: string
  totalFeitos: number
}

type Props = {
  auditId: string
  naoFeitos: NaoFeito[]
  feitos: Feito[]
}

type SortCol = 'nome' | 'uf' | 'empresa' | 'lista' | 'total'
type SortDir = 'asc' | 'desc'

const PER_PAGE = 20

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-foreground/30 shrink-0" />
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 text-primary shrink-0" />
    : <ArrowDown className="w-3 h-3 text-primary shrink-0" />
}

export function AuditResultTable({ auditId, naoFeitos, feitos }: Props) {
  const [modo, setModo] = useState<'nao_feitos' | 'feitos'>('nao_feitos')
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState<SortCol>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filters, setFilters] = useState({ nome: '', uf: '', empresa: '' })
  const isNF = modo === 'nao_feitos'

  function handleModo(v: typeof modo) {
    setModo(v)
    setPage(1)
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'total' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function handleFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  function clearFilters() {
    setFilters({ nome: '', uf: '', empresa: '' })
    setPage(1)
  }

  const hasFilters = filters.nome || filters.uf || filters.empresa
  const base = isNF ? naoFeitos : feitos
  const feitosPorNome = new Map(feitos.map((f) => [f.nomeCompleto, f.totalFeitos]))

  // 1. Filter
  const filtered = base.filter((row) => {
    const n = filters.nome.toLowerCase()
    const u = filters.uf.toLowerCase()
    const e = filters.empresa.toLowerCase()
    return (
      (!n || row.nomeCompleto.toLowerCase().includes(n)) &&
      (!u || row.estado.toLowerCase().includes(u)) &&
      (!e || row.empresa.toLowerCase().includes(e))
    )
  })

  // 2. Sort
  const sorted = [...filtered].sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''

    if (sortCol === 'nome') {
      va = a.nomeCompleto; vb = b.nomeCompleto
    } else if (sortCol === 'uf') {
      va = a.estado; vb = b.estado
    } else if (sortCol === 'empresa') {
      va = a.empresa; vb = b.empresa
    } else if (sortCol === 'lista') {
      va = isNF ? (a as NaoFeito).relatoriosAusentes : (a as Feito).relatoriosFeitos
      vb = isNF ? (b as NaoFeito).relatoriosAusentes : (b as Feito).relatoriosFeitos
    } else {
      va = isNF ? (a as NaoFeito).totalAusencias : (a as Feito).totalFeitos
      vb = isNF ? (b as NaoFeito).totalAusencias : (b as Feito).totalFeitos
    }

    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va
    }
    const cmp = String(va).localeCompare(String(vb), 'pt-BR')
    return sortDir === 'asc' ? cmp : -cmp
  })

  // 3. Paginate
  const totalRows = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const dados = sorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  // Stats always from full unfiltered data
  const total = naoFeitos.length
  const comAusencias = naoFeitos.filter((r) => r.totalAusencias > 0).length
  const semAusencias = total - comAusencias
  const taxa = total > 0 ? Math.round((semAusencias / total) * 100) : 0

  const comFeitos = feitos.filter((r) => r.totalFeitos > 0).length
  const taxaFeitos = total > 0 ? Math.round((comFeitos / total) * 100) : 0

  const metricaAtiva = isNF ? taxa : taxaFeitos
  const isBom = metricaAtiva >= 80

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">alunos</div>
        </div>

        {isNF ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">Pendências</span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-destructive">{comAusencias}</div>
            <div className="text-xs text-muted-foreground mt-0.5">com ausências</div>
          </div>
        ) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-700">Participaram</span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-green-700">{comFeitos}</div>
            <div className="text-xs text-muted-foreground mt-0.5">com entregas</div>
          </div>
        )}

        <div
          className={`rounded-xl border p-4 text-center ${
            isBom ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <CheckCircle2
              className={`w-3.5 h-3.5 ${isBom ? 'text-green-600' : 'text-amber-600'}`}
            />
            <span className={`text-xs font-medium ${isBom ? 'text-green-700' : 'text-amber-700'}`}>
              {isNF ? 'Cumprimento' : 'Engajamento'}
            </span>
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${isBom ? 'text-green-700' : 'text-amber-700'}`}
          >
            {metricaAtiva}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">dos alunos</div>
        </div>
      </div>

      {/* Tabs + download */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={modo} onValueChange={(v) => handleModo(v as typeof modo)}>
          <TabsList>
            <TabsTrigger value="nao_feitos" className="gap-2">
              Não feitos
              {comAusencias > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0 h-4 min-w-[1.25rem]">
                  {comAusencias}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="feitos">Feitos</TabsTrigger>
          </TabsList>
        </Tabs>

        <a href={`/api/auditorias/${auditId}/download?modo=${modo}`} download>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Baixar CSV
          </Button>
        </a>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrar por nome..."
          value={filters.nome}
          onChange={(e) => handleFilter('nome', e.target.value)}
          className="h-8 w-52 text-sm"
        />
        <Input
          placeholder="UF"
          value={filters.uf}
          onChange={(e) => handleFilter('uf', e.target.value)}
          className="h-8 w-20 text-sm"
        />
        <Input
          placeholder="Empresa..."
          value={filters.empresa}
          onChange={(e) => handleFilter('empresa', e.target.value)}
          className="h-8 w-48 text-sm"
        />
        {hasFilters && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </Button>
            {totalRows !== base.length && (
              <span className="text-xs text-muted-foreground">
                {totalRows} de {base.length} alunos
              </span>
            )}
          </>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
              <TableHead className="py-3 w-[30%]">
                <button
                  onClick={() => handleSort('nome')}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Nome
                  <SortIcon col="nome" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="py-3 w-16">
                <button
                  onClick={() => handleSort('uf')}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  UF
                  <SortIcon col="uf" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="hidden sm:table-cell py-3">
                <button
                  onClick={() => handleSort('empresa')}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Empresa
                  <SortIcon col="empresa" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="py-3">
                <button
                  onClick={() => handleSort('lista')}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  {isNF ? 'Ausências em' : 'Presenças em'}
                  <SortIcon col="lista" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="py-3 w-20">
                <button
                  onClick={() => handleSort('total')}
                  className="flex items-center gap-1 ml-auto text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Total
                  <SortIcon col="total" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum resultado para os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              dados.map((row, i) => {
                const count = isNF
                  ? (row as NaoFeito).totalAusencias
                  : (row as Feito).totalFeitos
                const lista = isNF
                  ? (row as NaoFeito).relatoriosAusentes
                  : (row as Feito).relatoriosFeitos
                const zerado = count === 0
                const altaSeveridade = !zerado && isNF && count >= 3
                const semEnvio = (feitosPorNome.get(row.nomeCompleto) ?? 0) === 0

                return (
                  <TableRow
                    key={i}
                    className={`border-b border-border/40 last:border-0 transition-colors ${
                      zerado
                        ? 'bg-transparent text-muted-foreground/60'
                        : altaSeveridade
                        ? 'bg-destructive/[0.03] hover:bg-destructive/[0.06]'
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    <TableCell className="py-3 whitespace-normal break-words">
                      <span
                        className={`text-sm font-medium ${
                          zerado ? 'text-muted-foreground/60' : 'text-foreground'
                        }`}
                      >
                        {row.nomeCompleto}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm font-mono text-muted-foreground">
                        {row.estado || (semEnvio ? 'sem envio' : '—')}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-3">
                      <span className="text-sm text-muted-foreground">
                        {row.empresa || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 max-w-xs whitespace-normal break-words">
                      <span className="text-sm text-muted-foreground leading-snug">
                        {zerado ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          lista
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      {!zerado && (
                        <Badge
                          className={
                            isNF
                              ? altaSeveridade
                                ? 'bg-destructive text-destructive-foreground font-semibold'
                                : 'bg-destructive/80 text-destructive-foreground'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }
                          variant={isNF ? 'destructive' : 'outline'}
                        >
                          {count}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {totalRows === 0 ? (
            'Nenhum resultado'
          ) : (
            <>
              Mostrando{' '}
              <span className="font-medium text-foreground">
                {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, totalRows)}
              </span>{' '}
              de{' '}
              <span className="font-medium text-foreground">{totalRows}</span> alunos
            </>
          )}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-1 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
