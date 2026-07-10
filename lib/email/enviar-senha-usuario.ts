import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { createSesClient } from '@/lib/ses'

export async function enviarSenhaPorEmail(params: {
  email: string
  nome: string
  senha: string
}): Promise<{ error?: string }> {
  const ses = createSesClient()
  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/login`

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Bem-vindo(a) ao Pente Fino</h2>
      <p>Olá${params.nome ? `, ${params.nome}` : ''}! Uma conta foi criada para você no
      sistema de auditoria de relatórios da Aponti Academy.</p>
      <p>
        <strong>Email:</strong> ${params.email}<br />
        <strong>Senha temporária:</strong>
        <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px;">${params.senha}</code>
      </p>
      <p>
        <a href="${loginUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          Acessar o sistema
        </a>
      </p>
      <p style="color:#71717a;font-size:12px;">
        Não compartilhe esta senha com ninguém. Se você não esperava este email, ignore-o.
      </p>
    </div>
  `

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [params.email] },
        Content: {
          Simple: {
            Subject: { Data: 'Seu acesso ao Pente Fino', Charset: 'UTF-8' },
            Body: { Html: { Data: html, Charset: 'UTF-8' } },
          },
        },
      })
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao enviar email' }
  }
}
