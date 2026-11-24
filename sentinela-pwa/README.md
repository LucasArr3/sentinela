# 🛡️ Sentinela Tático (PWA)

Calendário de plantão para Policiais Penais — escala **24x72** (e outras) pronta, extras com valores, permutas com saldo por colega, folgas, atestados médicos, observações, assistente de **voz/IA** e resumos formatados para **WhatsApp**.

Sem build, sem servidor, sem chaves de API: HTML + CSS + JS puro (ES modules). Funciona offline e pode ser instalado no celular.

## Rodar
```bash
cd sentinela-pwa
npm start        # http://localhost:8080  (python3 -m http.server)
npm test         # testes da escala, do interpretador de voz e dos resumos
```
Para usar no celular, publique a pasta em qualquer hospedagem estática com HTTPS (GitHub Pages, Netlify, Vercel…). HTTPS é necessário para microfone e instalação como app.

## Recursos
- **Login / cadastro** local (senha com PBKDF2-SHA256) ou "entrar sem cadastro" já configurado em 24x72 com **hoje como plantão**.
- **Onboarding** em 4 passos: perfil, escala (24x72, 24x48, 12x36, 48x96 ou personalizada), valores das extras.
- **Painel**: "Em serviço agora" com contagem regressiva, ciclo da escala, números do mês, próximos plantões, pendências, gráfico de extras.
- **Calendário** mensal com cores por situação; toque no dia para lançar **extra, permuta, folga, atestado, férias ou observação**. Permuta "passei" tira o plantão do dia; "assumi" cria plantão; atestado/folga cobrem o plantão.
- **Finanças**: total de extras, recebido × a receber, saldo de permutas por colega.
- **Assistente IA** (botão central): fale ou digite — *"extra noturna dia 30 valor 250"*, *"permuta com o João dia 27, passei meu plantão"*, *"atestado de 3 dias a partir de amanhã"*, *"quando é meu próximo plantão?"*. Confirma antes de salvar. Voz via Web Speech API (Chrome/Edge/Safari).
- **Resumos WhatsApp**: Completo, Escala, Finanças ou Próximos; mini-calendário em texto, edição livre, abrir direto no WhatsApp, copiar ou compartilhar.
- **Ajustes**: perfil, escala, valores, tema claro/escuro/automático, cor de destaque, backup (exportar/importar JSON), alterar senha.

## Novidades
- **Modo Plantão:** relógio grande, progresso do serviço, próximo quarto e atalhos (ocorrência, quartos, extra, foto).
- **Segurança:** trava por **PIN** (4 a 6 números, guardado só como hash), bloqueio automático e **modo discreto** (esconde valores em R$).
- **Temas e leitura:** Escuro, **Noturno vermelho** (visão de madrugada), Claro e Automático; texto Normal/Grande/Muito grande.
- **Espaço:** medidor de armazenamento em Ajustes → Dados, com aviso quando enche.
- **Alarmes:** 13 sons táticos/clássicos, antecedência e som por quarto, soneca, volume crescente, parada automática.

## Alarme de verdade (Android)
No navegador o alarme só toca com o app aberto. Para tocar **com a tela bloqueada**, como o relógio do celular, use o app Android em `../sentinela-app` (APK gerado pelo GitHub Actions). Veja `../sentinela-app/README.md`.

Sons: `sounds/*.wav` são gerados por `python3 tools/gen_sounds.py` (sintetizados por código, sem direitos autorais).

## Privacidade e limites
- Todos os dados ficam **no próprio aparelho** (localStorage). Use *Ajustes → Exportar backup* para guardar/transferir.
- A "IA" interpreta comandos **localmente** (regras de português), sem enviar nada a terceiros. O reconhecimento de voz usa o serviço do navegador.
- Contas são locais ao aparelho; não há sincronização na nuvem nem recuperação de senha.

## Estrutura
`js/core.js` regras (escala, status do dia, finanças) · `js/nlp.js` interpretador pt-BR · `js/summary.js` textos WhatsApp · `js/store.js` contas e persistência · `js/ai.js` assistente/voz · `js/app.js` interface · `sw.js` offline.
