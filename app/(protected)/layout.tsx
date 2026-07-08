import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NavLinks } from '@/components/NavLinks'
import { UserMenu } from '@/components/UserMenu'
import { Logomark } from '@/components/Logomark'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const isAdmin = user.app_metadata?.role === 'admin'
  const name = (user.user_metadata?.nome as string | undefined) || user.email?.split('@')[0] || 'Usuário'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 h-14 max-w-5xl">
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <Logomark className="w-6 h-6 text-primary shrink-0" />
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-[oklch(0.710_0.191_294)] bg-clip-text text-transparent">
                Aponti
              </span>
              <span className="text-border text-sm select-none">/</span>
              <span className="text-muted-foreground text-sm font-normal hidden sm:inline">
                pente fino
              </span>
            </Link>

            <nav className="flex items-center gap-0.5">
              <NavLinks isAdmin={isAdmin} />
            </nav>
          </div>

          <UserMenu name={name} email={user.email ?? ''} isAdmin={isAdmin} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">{children}</main>
    </div>
  )
}
