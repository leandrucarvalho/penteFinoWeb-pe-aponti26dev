import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { registrarLog } from '@/lib/system-log'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await registrarLog({
      userId: user.id,
      userEmail: user.email!,
      action: 'auth.logout',
      target: user.id,
    })
  }

  await supabase.auth.signOut()
  redirect('/login')
}
