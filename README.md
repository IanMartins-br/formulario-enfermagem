# Formulário de Enfermagem — modo sem login

Aplicativo web para preencher registros de atendimento domiciliar, visualizar o modelo A4 e imprimir como PDF. Adaptado para iPhone/PWA.

## Como usar
1. Abra https://formulario-enfermagem.pages.dev — **sem tela de login**.
2. Em **Pacientes**, crie o cadastro do paciente (nome, data de nascimento e número do prontuário).
3. Em **Atendimento**, escolha o paciente: dados básicos são preenchidos automaticamente.
4. Preencha avaliação e evolução. A avaliação de lesões abre apenas quando marcada.
5. **Visualizar prévia** não salva. **Gerar modelo e salvar no histórico** grava a visita e mostra a prévia.
6. No **Histórico**, selecione o paciente, abra a data e imprima/guarde o PDF.
7. Em **Histórico**, exporte um backup JSON periodicamente; em Ajustes, há importação de backup.

## Armazenamento e privacidade
- **Sem login = somente neste navegador e dispositivo.** Dados ficam em localStorage; não são sincronizados entre PC e iPhone, não são criptografados e podem desaparecer se limpar o navegador. O backup JSON também não é criptografado.
- O banco D1 permanece provisionado na conta Cloudflare, mas **a API remota foi desabilitada (HTTP 410)** para não permitir acesso público indevido.
- **Não utilizar dados de pacientes reais** sem implantação de controles de acesso, conformidade LGPD, política de backups e retenção, auditoria e validação clínica/regulatória adequada.
- O gerador não diagnostica de maneira autônoma; sugestões e prescrições dependem de avaliação e aprovação da enfermeira.
- Publicar o site não torna os dados locais acessíveis aos administradores do Cloudflare ou GitHub.

## Infraestrutura
- Repositório: `IanMartins-br/formulario-enfermagem`
- Cloudflare Pages: `formulario-enfermagem`, conta **Ian pessoal**
- Site: https://formulario-enfermagem.pages.dev
- D1: `formulario-enfermagem-db` (não utilizado no modo sem login)

O projeto é um gerador local de documentos; não é um prontuário eletrônico certificado.
