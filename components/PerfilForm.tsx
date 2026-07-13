'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { atualizarPerfil } from '@/app/(protected)/perfil/actions'

type PerfilFormProps = {
  nome: string
  telefone: string
  cargo: string
  funcao: string
}

export function PerfilForm({
  nome: nomeInicial,
  telefone: telefoneInicial,
  cargo: cargoInicial,
  funcao: funcaoInicial,
}: PerfilFormProps) {
  const [nome, setNome] = useState(nomeInicial)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [cargo, setCargo] = useState(cargoInicial)
  const [funcao, setFuncao] = useState(funcaoInicial)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await atualizarPerfil({ nome, telefone, cargo, funcao })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Dados atualizados com sucesso!')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="João da Silva"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(81) 99999-9999"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cargo">Cargo</Label>
          <Input
            id="cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="ex: Coordenador"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="funcao">Função</Label>
          <Input
            id="funcao"
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            placeholder="ex: Operações"
            className="h-10"
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar dados'
        )}
      </Button>
    </form>
  )
}
