# Enfermagem — formulário domiciliar

Aplicação responsiva em Cloudflare Pages com formulário clínico, cadastro único de pacientes, prontuários separados por paciente e data, histórico, prévia A4 e exportação em PDF.

## Produção

- Site: https://formulario-enfermagem.pages.dev
- Repositório: IanMartins-br/formulario-enfermagem
- Cloudflare: **Ian pessoal**
- Banco: D1 `formulario-enfermagem-db` (binding `DB`)
- API: Cloudflare Pages Functions em `functions/api/[[path]].js`
- Sessões: cookie HttpOnly + Secure + SameSite=Strict, validade de 12 horas
- Senha: derivação PBKDF2-SHA256, login com limitação de tentativas
- Auditoria: tabela `audit_events` para autenticações e gravações

## Primeiro acesso

1. Abra o site e selecione **Primeiro acesso? Ativar conta**.
2. Informe a chave privada provisionada como `APP_SETUP_KEY` nas variáveis/segredos do projeto Cloudflare.
3. Escolha o e-mail da responsável e uma senha longa (mínimo 14 caracteres).
4. Entre e cadastre os pacientes.
5. Ao criar uma visita, selecione o paciente: nome, nascimento, idade e número do prontuário serão preenchidos.
6. **Gerar modelo e salvar no histórico** grava no D1 e abre a prévia; **Visualizar prévia** não grava.
7. Abra **Histórico**, escolha o paciente, depois a data e o registro para imprimir em PDF.

O primeiro acesso só é permitido enquanto a conta inicial não estiver ativada. **Nunca coloque a chave de configuração ou senhas no repositório.**

## Atenção clínica e privacidade

A aplicação é uma implementação inicial protegida por senha, **não um prontuário certificado** e não substitui revisão clínica, assinatura, conformidade legal e avaliação de risco. Antes de uso com dados reais, implementar políticas formais de acesso e retenção, procedimentos de backup/restauração e exclusão, revisão das condições LGPD, e avaliação profissional das hipóteses, planos e registros de enfermagem. O banco D1 armazena dados clínicos sensíveis, por isso o repositório contém somente código e migrações, nunca dados ou credenciais.

Arquivos de backup exportados contêm dados sensíveis e devem ser guardados em armazenamento autorizado e protegido.

## Deploy

Alterações na branch `main` publicam automaticamente pela integração do Cloudflare Pages.
