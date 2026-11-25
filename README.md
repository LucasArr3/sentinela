# 🛡️ Sentinela Tático

Calendário tático de plantão para **servidores em regime de plantão**: escala 24x72 (e outras), extras com valores, permutas, folgas, atestados, **quartos de hora e postos**, livro de ocorrências, resumos para WhatsApp, assistente de voz/IA e **alarme de verdade no Android**.

| Pasta | O que é |
|---|---|
| [`sentinela-pwa/`](sentinela-pwa) | O aplicativo (HTML + CSS + JS puro, sem build). Roda no navegador e é a interface usada pelo app Android. |
| [`sentinela-app/`](sentinela-app) | App **Android** (Capacitor + plugin nativo de alarme). Gera o APK. |
| `app/`, `components/`, `lib/`… | Primeira versão (Next.js/Firebase, feita no Google AI Studio). Mantida só como referência. |

## 📱 Instalar no Android (alarme completo)
1. No celular, abra **https://github.com/LucasArr3/sentinela/releases/tag/apk-latest** e baixe `sentinela-tatico.apk`.
2. Permita a instalação "desta fonte" quando o Android pedir e instale.
3. Siga o checklist em **Ajustes → Alarmes** (e o guia da Samsung em [`sentinela-app/README.md`](sentinela-app/README.md)).

## 🧪 Testes
- Lógica (escala, quartos, alarmes, feriados, voz): `cd sentinela-pwa && npm test`
- Alarme no emulador Android: workflow **Testar alarme no emulador Android** (GitHub Actions).
