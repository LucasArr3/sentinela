# 📱 Sentinela Tático — app Android (alarme de verdade)

Mesma interface do app web (`../sentinela-pwa`), empacotada com **Capacitor** e com um **plugin nativo de alarme**:

- `AlarmManager.setAlarmClock` — o mesmo mecanismo do relógio do celular (ignora economia de bateria/Doze).
- Serviço em primeiro plano tocando no **canal de ALARME** (toca no silencioso, respeita o volume de alarme, repete até desligar).
- Tela de alarme **sobre o bloqueio**, com botões grandes **Desligar** e **Soneca**.
- Reagenda sozinho depois de **reiniciar** o celular, atualizar o app ou mudar a hora/fuso.
- 13 sons táticos/clássicos embutidos + **importar o seu próprio som**.
- Voz (assistente e ditado) pelo reconhecimento de voz do Android.

## Instalar no celular (Samsung S24 Ultra e outros Android)

1. No celular, abra no Chrome: **https://github.com/LucasArr3/sentinela/releases/tag/apk-latest** e toque em **sentinela-tatico.apk**.
2. Quando o Android avisar *"Por segurança, o telefone não pode instalar apps desta fonte"*, toque em **Configurações** e ative **Permitir desta fonte** para o Chrome. Volte e toque em **Instalar**.
3. Se o *Play Protect* avisar "app não verificado", toque em **Instalar mesmo assim** (o app é seu e não está na Play Store).
4. Abra o app, toque em **Entrar sem cadastro** (ou crie uma conta) e vá em **Ajustes → Alarmes**.

> Atualizar: instale o APK novo por cima. Os dados ficam (a assinatura é fixa). Antes da 1ª instalação, se você já usava o app no navegador, faça **Ajustes → Dados → Exportar** e depois **Importar** no app Android: os dados do navegador não passam sozinhos.

## Deixar o alarme 100% confiável (Samsung One UI)

Em **Ajustes → Alarmes → Alarme do aparelho** o app mostra um checklist. Corrija tudo que estiver em vermelho:

| Item | Onde |
|---|---|
| Notificações | Permitir quando o app pedir |
| Alarme sobre a tela bloqueada | Android 14+: *Ajustes do app → Notificações em tela inteira* |
| **Bateria sem restrição** | *Bateria → Limites de uso em segundo plano* |

E, **só na Samsung**, faça também:
1. **Configurações → Bateria → Limites de uso em segundo plano** → desligue *Colocar apps não usados em suspensão* (ou adicione o Sentinela em **Apps que nunca entram em suspensão**).
2. **Configurações → Aplicativos → Sentinela Tático → Bateria → Irrestrito**.
3. **Volume de alarme**: o alarme toca no volume de *Alarmes* (Configurações → Sons → Volume). Deixe alto.
4. **Teste sempre**: *Ajustes → Alarmes → Testar em 10 s*, **bloqueie a tela** e espere. Se tocar, está pronto.

## Como o alarme funciona

A interface calcula os alarmes dos próximos **14 dias** (quartos marcados + Alvorada) e entrega ao Android toda vez que algo muda e ao abrir o app. Abra o app ao menos a cada 2 semanas (na prática você abre todo plantão).

## Desenvolvimento

```bash
npm ci
npm run sync            # copia ../sentinela-pwa para www/ e roda "cap sync android"
cd android && ./gradlew assembleRelease
```
O APK é gerado automaticamente pelo GitHub Actions (`.github/workflows/android.yml`) a cada push, e publicado no release `apk-latest`.

**Assinatura:** o APK é assinado com uma chave de depuração versionada (`android/app/sentinela.keystore`), suficiente para uso pessoal e atualizações. Para publicar na Play Store, gere uma chave privada própria e guarde-a como segredo do GitHub.
