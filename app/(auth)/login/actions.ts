'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { registrarLog } from '@/lib/system-log'

export async function login(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const email = formData.get('email') as string
  const senha = formData.get('senha') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (error || !data.user) return { error: 'Email ou senha inválidos' }

  await registrarLog({
    userId: data.user.id,
    userEmail: data.user.email!,
    action: 'auth.login',
    target: data.user.id,
  })

  redirect('/dashboard')
}
