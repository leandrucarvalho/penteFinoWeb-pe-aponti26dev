# Design: Padronizar avisos/alertas com toast (shadcn/sonner)

Data: 2026-07-13

> **Nota pós-implementação:** esta spec foi escrita lendo `CriarUsuarioForm.tsx` na branch `feat/senha-aleatoria-email` (ainda não mesclada em `develop` quando esta branch foi criada). Por isso a linha de `CriarUsuarioForm.tsx` na tabela de escopo e a exceção 1 descrevem um fallback `emailFalhou`/senha gerada que **não existe** na base real desta branch (`develop`). A implementação foi corrigida para refletir o `CriarUsuarioForm.tsx` real (campo "Senha" manual, `<select>` nativo, sem exceção de caixa fixa — os dois casos viraram toast). Quando `feat/senha-aleatoria-email` for mesclada, o fallback `emailFalhou` deve ser revisitado separadamente para também usar caixa fixa, como esta spec originalmente previa.

## Contexto

O app já tem o `Toaster` do shadcn (sonner) instalado, temático (light/dark) e montado globalmente em `app/layout.tsx`. Ele já é usado em um único lugar — `GerarAuditoriaButton.tsx` (`toast.success`/`toast.error`).

O resto do sistema usa um padrão diferente e mais antigo: uma `<div>` colorida fixa (verde para sucesso, vermelha para erro) renderizada condicionalmente abaixo do formulário, com um ícone `lucide-react`. Esse padrão está espalhado em ~10 componentes, com o mesmo bloco de classes Tailwind repetido em cada um.

Pedido do usuário: unificar os avisos de ação (ex: "Selecione um arquivo", "Planilha atualizada com sucesso") usando o componente moderno do shadcn, em todo o sistema — não só nos dois exemplos citados.

## Decisão

Padronizar em `toast.error()` / `toast.success()` (sonner) para todo **feedback transitório de ação** (algo que acontece uma vez, em resposta a um clique/submit), substituindo as caixas fixas. Duas exceções ficam de fora por serem **estado persistente da tela**, não notificação pontual — ver seção "Exceções".

### Por que toast em vez de um `Alert` fixo mais bonito

O app já usa toast em um lugar (`GerarAuditoriaButton`), então reaproveitar mantém o sistema consistente sem introduzir um segundo padrão visual para o mesmo tipo de feedback. O pedido do usuário ("alerta moderno" que aparece "ao clicar") também descreve o comportamento de um toast (flutuante, temporário) mais do que o de um Alert fixo.

## Escopo

### Grupo A — formulários com `useActionState` (Server Actions)

Adiciona um `useEffect` que observa `state` e dispara o toast quando o resultado muda. Remove o JSX da caixa correspondente.

| Arquivo | Hoje | Depois |
|---|---|---|
| `components/PlanilhaGeralForm.tsx` | caixa de erro "Selecione um arquivo CSV." / caixa de sucesso "Planilha atualizada com sucesso!" | `toast.error(state.error)` / `toast.success('Planilha atualizada com sucesso!')` |
| `components/CriarUsuarioForm.tsx` | caixa de erro / caixa de sucesso "Usuário criado com sucesso!" | `toast.error(state.error)` / `toast.success('Usuário criado com sucesso!')`. A caixa de `emailFalhou` (senha de fallback) **não muda** — ver Exceções |
| `components/AdicionarRelatorioForm.tsx` | caixa de erro no upload; caixa de erro dentro do `AlertDialog` ao gerar auditoria | `toast.error(state.error)` no upload; `toast.error(res.error)` no `handleGerarAuditoria`, removendo `gerarError` |
| `app/(auth)/login/page.tsx` | caixa de erro de credenciais | `toast.error(state.error)` |

### Grupo B — componentes com `useState` local / handlers imperativos

Troca a chamada `setErro(...)`/`setSucesso(...)` que só existe para acionar a caixa por uma chamada direta a `toast.error(...)`/`toast.success(...)`, e remove a state var e o JSX que ficam órfãos.

| Arquivo | Hoje | Depois |
|---|---|---|
| `components/AlterarSenhaForm.tsx` | `erro`/`sucesso` state → caixas | `toast.error(...)` nas 3 validações + no retorno da action; `toast.success('Senha alterada com sucesso!')` |
| `components/PerfilForm.tsx` | `erro`/`sucesso` state → caixas | `toast.error(result.error)`; `toast.success('Dados atualizados com sucesso!')` |
| `app/(auth)/redefinir-senha/page.tsx` | `erro` state → caixa | `toast.error(...)` nas 3 validações/erros |
| `components/EsqueciSenhaForm.tsx` | `erro` state → caixa (dentro do formulário) | `toast.error('Não foi possível enviar o email agora. Tente novamente em instantes.')`. A caixa de `linkInvalido` e a de `enviado` **não mudam** — ver Exceções |
| `components/RelatoriosList.tsx` | `deleteError`/`gerarError` state → caixas dentro de `AlertDialog`s | `toast.error(...)` em `handleDelete` e `handleGerarAuditoria`, removendo os dois states |
| `components/UsuariosList.tsx` | `editError` state → caixa dentro do dialog de edição | `toast.error(...)` no catch de `handleSave`, removendo o state |

### Fora do escopo

- `components/AuditResultTable.tsx` — os cards de estatística ("Completamente feitos" / "Parcialmente feitos") não são avisos de ação, é um falso positivo da varredura inicial. Não muda.

## Exceções (ficam como caixa fixa)

Casos onde o conteúdo precisa continuar visível na tela, não é uma notificação de "aconteceu uma vez":

1. **`CriarUsuarioForm.tsx` — bloco `emailFalhou`**: mostra a senha gerada em texto plano para o admin copiar manualmente quando o envio de email falha. Um toast que some sozinho arriscaria a senha ser perdida.
2. **`EsqueciSenhaForm.tsx` — blocos `linkInvalido` e `enviado`**: não são resultado de um clique nesta tela — `linkInvalido` reflete um parâmetro de URL ao carregar a página, e `enviado` é uma troca de view (o formulário de email é substituído pela mensagem de confirmação). Ambos precisam ficar visíveis enquanto o usuário estiver na tela.

## Comportamento adicional

Em `CriarUsuarioForm.tsx`, o `useEffect` de sucesso hoje espera 1500ms antes de resetar o formulário e chamar `onSuccess()` (que fecha o diálogo) — esse delay existia para dar tempo de ler a caixa verde antes dela sumir junto com o diálogo. Como o toast é independente do diálogo e continua visível depois que ele fecha, o delay deixa de ser necessário: o formulário reseta e `onSuccess()` é chamado imediatamente.

## Testes

Não há lógica de negócio nova — é relocação de mensagens já existentes para um mecanismo de exibição diferente. Não há testes unitários a escrever; a verificação é manual (rodar `npm run dev` e disparar cada caminho de sucesso/erro listado acima, conferindo que o toast aparece com o texto certo e que as duas exceções continuam fixas). `npm test`, `npx eslint` e `npm run build` continuam servindo de verificação de regressão.
