# Formulário de Enfermagem Domiciliar

Web app PWA responsivo para gerar documentos A4 e salvar PDF no navegador, com avaliação, histórico local por paciente e gráficos básicos.

## Atenção — versão demonstração

Não utilize dados identificáveis ou clínicos reais. O armazenamento é local no navegador, **não é um prontuário eletrônico certificado**, e não oferece autenticação, auditoria, assinaturas digitais ou armazenamento clínico seguro. O D1 provisionado não é utilizado para dados clínicos até haver autorização/autenticação e revisão de segurança e conformidade.

## Deploy

Projeto Cloudflare Pages conectado ao repositório, branch main. Arquivos estáticos na raiz (`/`), sem comando de build. Atualizações no main acionam novos deployments quando a integração estiver ativa.

## Funcionalidades

Formulário, lesões condicionais, sugestões textuais para revisão clínica, PDF por registro, histórico local separado por paciente, filtros de data, indicadores, gráficos e backup JSON.

## Pendências para produção real

Autenticação individual, autorização no backend, persistência transacional, auditoria imutável, retenção de dados, políticas de backup, LGPD, validação clínica e assinatura apropriada.
