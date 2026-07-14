# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [1.1.0] - 2026-07-14
### Added
- Recuperação de senha ("esqueci minha senha") via link de redefinição por email.
- Tela de perfil com alteração de senha e edição de dados do usuário logado.
- Log de ações administrativas e de negócio, com tela de consulta em Configurações (admin).
- Paginação na lista de execuções de auditoria e nos resultados de auditoria (ausências/presenças).
- Contadores absolutos de alunos parcial e completamente feitos, ao lado dos percentuais já existentes.
- Coluna de identificador único, escolhida pelo administrador, para cruzar a planilha geral de alunos com os relatórios semanais no lugar de nome/sobrenome.
### Changed
- Logo e favicon atualizados para o símbolo da Aponti.
- Filtro de UF nas telas de auditoria trocado de campo de texto livre para dropdown com múltipla seleção.
- Alertas de ação (sucesso/erro) padronizados com toast (shadcn/sonner) em todo o sistema, no lugar de caixas de mensagem fixas.

## [1.0.0] - 2026-07-03
### Added
- Login com autenticação via Supabase e toggle de mostrar/ocultar senha.
- Upload de relatórios semanais (CSV do Moodle) com histórico e exclusão.
- Geração de auditoria sob demanda, comparando planilha geral com relatórios ativos.
- Dashboard com indicadores gerais, evolução do cumprimento e distribuição por UF.
- Extração de UF/empresa a partir da coluna "Grupos" dos relatórios, como fallback quando a planilha geral não tem essa informação.
- Gerenciamento de usuários (admin).
### Fixed
- Quebra de layout em colunas com listas longas (ausências, nome) no grid de auditoria.
- Fuso horário das datas exibidas (America/Sao_Paulo), antes exibindo com +3h em produção.
