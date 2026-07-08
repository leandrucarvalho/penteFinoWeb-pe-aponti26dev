# Design: log de ações do sistema + tela de administração

Issue: [#33](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/33)

## Contexto

Não existe infraestrutura de logging estruturado no projeto — só 2 `console.warn` em
`lib/gerar-auditoria.ts`. O banco (`chuppzvaanyasljuknen.supabase.co`, projeto
`aponti-pente-fino`) já tem 3 migrations aplicadas remotamente (`initial_schema`,
`auto_create_profile_on_signup`, `allow_manual_trigger_type_auditorias`), mas nenhuma
delas está versionada no repositório — não existe pasta `supabase/migrations`. Esta
feature cria esse precedente.

Schema real confirmado via MCP do Supabase (não pela suposição do texto da issue):
role de usuário vive em `public.profiles` (`user_id` FK para `auth.users.id`, `role`
`'admin' | 'user'`), não só em `app_metadata`.

## Objetivo

Registrar ações administrativas e de negócio do sistema (quem fez o quê e quando) e
oferecer uma tela, restrita a administradores, para consultar esse histórico.

## 1. Tabela `system_logs` e migration

Primeira migration versionada do projeto:
`supabase/migrations/<timestamp>_create_system_logs.sql`.

```sql
create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  action text not null,
  target text,
  details jsonb
);

alter table public.system_logs enable row level security;

create policy "Admins podem ler logs"
  on public.system_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid() and profiles.role = 'admin'
    )
  );
```

Decisões:

- `user_email` é um **snapshot** (texto), não depende de join — sobrevive mesmo que o
  usuário seja removido depois (`user_id` vira `null` via `on delete set null`, mas o
  e-mail permanece no log).
- `action` é texto livre, **sem `CHECK`** restringindo valores válidos — ao contrário
  de `trigger_type` em `auditorias` (3 valores fixos), o conjunto de ações tende a
  crescer com o tempo; um `CHECK` exigiria migration a cada ação nova. Os valores
  válidos ficam documentados como union type no TypeScript (`SystemLogAction`, seção
  2) em vez de no banco.
- **Sem policy de INSERT** — a tabela fica bloqueada por padrão (RLS ligado, só a
  policy de SELECT admin existe). Escritas acontecem exclusivamente via
  `createServiceClient()` dentro do helper `registrarLog` (seção 2), que ignora RLS.
  Evita desenhar uma policy "cada usuário só insere linha com seu próprio user_id".

A migration é aplicada via MCP do Supabase (projeto correto confirmado:
`chuppzvaanyasljuknen` / `aponti-pente-fino`) durante a implementação.

## 2. Helper `registrarLog` e pontos de chamada

`lib/system-log.ts` (novo):

```ts
import { createServiceClient } from '@/lib/supabase/server'

export type SystemLogAction =
  | 'usuario.criar'
  | 'usuario.atualizar'
  | 'usuario.deletar'
  | 'relatorio.adicionar'
  | 'relatorio.deletar'
  | 'auditoria.gerar'
  | 'senha.alterar'
  | 'auth.login'
  | 'auth.logout'

export const ACTION_LABELS: Record<SystemLogAction, string> = {
  'usuario.criar': 'Criou usuário',
  'usuario.atualizar': 'Atualizou usuário',
  'usuario.deletar': 'Removeu usuário',
  'relatorio.adicionar': 'Adicionou relatório',
  'relatorio.deletar': 'Removeu relatório',
  'auditoria.gerar': 'Gerou auditoria',
  'senha.alterar': 'Alterou senha',
  'auth.login': 'Login',
  'auth.logout': 'Logout',
}

export async function registrarLog(params: {
  userId: string
  userEmail: string
  action: SystemLogAction
  target?: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('system_logs').insert({
      user_id: params.userId,
      user_email: params.userEmail,
      action: params.action,
      target: params.target ?? null,
      details: params.details ?? null,
    })
  } catch {
    // Log é best-effort: uma falha aqui nunca deve derrubar a ação principal.
  }
}
```

Chamado sempre **depois** que a ação principal já teve sucesso, nunca antes:

| Arquivo | Ação | `action` | `target` |
|---|---|---|---|
| `app/(protected)/configuracoes/usuarios/actions.ts` | `criarUsuario` | `usuario.criar` | e-mail do novo usuário |
| | `atualizarUsuario` | `usuario.atualizar` | `userId` (+ `details` com os campos alterados) |
| | `deletarUsuario` | `usuario.deletar` | `userId` |
| `app/(protected)/relatorios/actions.ts` | `adicionarRelatorio` | `relatorio.adicionar` | `relatorioId` |
| | `deletarRelatorio` | `relatorio.deletar` | `relatorioId` |
| | `gerarAuditoriaManual` | `auditoria.gerar` | `auditId` gerado |
| `app/(protected)/perfil/actions.ts` | `alterarSenha` | `senha.alterar` | próprio `user.id` |
| `app/(auth)/login/actions.ts` (novo) | `login` | `auth.login` | próprio `user.id` |
| `app/api/auth/signout/route.ts` | logout | `auth.logout` | próprio `user.id` |

## 3. Login como Server Action

Hoje o login é 100% client-side (`app/(auth)/login/page.tsx` chama
`supabase.auth.signInWithPassword` direto no navegador), sem passar por servidor —
não dá para registrar o log ali. Convertido para Server Action, seguindo o padrão
`useActionState` já usado em `criarUsuario`/`adicionarRelatorio`/`uploadPlanilhaGeral`.

`app/(auth)/login/actions.ts` (novo):

```ts
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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error || !data.user) return { error: 'Email ou senha inválidos' }

  await registrarLog({ userId: data.user.id, userEmail: data.user.email!, action: 'auth.login' })

  redirect('/dashboard')
}
```

`app/(auth)/login/page.tsx` troca `handleLogin`/`useState` locais por
`useActionState(login, null)`, mantendo o mesmo HTML/visual (inputs, `PasswordInput`,
link "Esqueci minha senha"). `router.push`/`router.refresh` saem — `redirect()` no
Server Action cuida disso.

`app/api/auth/signout/route.ts` ganha uma busca de `user` **antes** do `signOut()`
(senão perde a referência ao usuário):

```ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { registrarLog } from '@/lib/system-log'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    await registrarLog({ userId: user.id, userEmail: user.email!, action: 'auth.logout' })
  }
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Risco conhecido: rate limit de login compartilhado

Mover o login para o servidor significa que toda tentativa de login passa a chegar
ao Supabase Auth vindo do IP de egress do servidor Next.js, não do IP real de cada
usuário. O rate limit "sign-ups e sign-ins" do Supabase (Authentication → Rate
Limits) é por IP — antes, cada usuário tinha sua própria cota; agora essa cota é
**compartilhada entre todos os usuários do app**. Verificado no dashboard do projeto
(`aponti-pente-fino`): o valor padrão era 30 requisições/5min. Um pico normal de uso
(ex: vários usuários logando de manhã, cada um com 1-2 tentativas por erro de
digitação) já se aproxima desse teto compartilhado, bloqueando gente legítima sem
que exista nenhum ataque.

Mitigação aplicada: o valor foi aumentado para **100 requisições/5min** diretamente
no dashboard do Supabase (mudança de configuração, fora do código/desta PR) —
suficiente para o tamanho atual do time (poucos usuários) sem enfraquecer demais a
proteção contra força bruta. Um rate limit próprio da aplicação (por IP real do
request, com store durável tipo Redis/KV) resolveria isso de forma mais robusta,
mas é escopo maior que esta issue de logging — fica como possível follow-up.

## 4. Tela de administração `/configuracoes/logs`

Rota **aninhada em `/configuracoes`**, já coberta pelo prefixo `/configuracoes` em
`ADMIN_ROUTES` (`proxy.ts:5`) — **não precisa alterar `proxy.ts`**.

- `app/(protected)/configuracoes/logs/page.tsx` (Server Component): guard admin
  inline (mesmo padrão de `configuracoes/usuarios/page.tsx`:
  `if (user?.app_metadata?.role !== 'admin') redirect('/auditorias')`), lê
  `searchParams.page` (`Promise`, convenção já usada em `/esqueci-senha`), consulta
  `system_logs` com `.order('created_at', { ascending: false }).range(...)` —
  **paginação no servidor**, diferente de `AuditResultTable` (que carrega tudo e
  pagina no cliente), já que logs crescem rápido e não têm um teto natural por
  auditoria.
- Tabela (`components/ui/table.tsx`, mesmo padrão de `AuditResultTable`) com colunas:
  Data/Hora, Usuário (`user_email`), Ação (`ACTION_LABELS[action]`), Alvo (`target`),
  Detalhes (`details`, formatado como texto/JSON compacto).
- Paginação simples Anterior/Próxima via `?page=N` na URL (sem JS de cliente,
  server-rendered).
- Link de entrada: novo `Card` "Logs do sistema" em
  `app/(protected)/configuracoes/page.tsx`, mesmo padrão do `Card` "Gerenciar
  usuários" já existente (linha ~89-100).

## Fora de escopo

- **`requireAdmin()` compartilhado** — a issue já marca isso como sugestão não
  bloqueante ("Nota não bloqueante"). Mantém o padrão inline já usado nas páginas
  admin existentes, para não espalhar um refactor não pedido por mais arquivos.
- **Backfill das 3 migrations antigas** já aplicadas remotamente
  (`initial_schema`, `auto_create_profile_on_signup`,
  `allow_manual_trigger_type_auditorias`) — esta PR não as versiona retroativamente,
  só cria o precedente daqui pra frente com a migration de `system_logs`.
- **Enum/CHECK para `action`** — ver decisão na seção 1.
