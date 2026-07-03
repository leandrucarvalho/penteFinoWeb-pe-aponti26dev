# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

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
