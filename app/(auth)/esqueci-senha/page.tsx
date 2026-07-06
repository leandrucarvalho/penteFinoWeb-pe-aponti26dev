import { EsqueciSenhaForm } from '@/components/EsqueciSenhaForm'

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <EsqueciSenhaForm linkInvalido={erro === 'link-invalido'} />
    </div>
  )
}
