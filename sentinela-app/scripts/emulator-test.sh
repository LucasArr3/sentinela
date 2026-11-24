#!/usr/bin/env bash
# Roda DENTRO do emulador Android (via reactivecircus/android-emulator-runner).
# Instala o APK de depuração, dispara um alarme de teste e confere que ele realmente toca.
set -uo pipefail
PKG=br.com.sentinela.tatico
OUT=${OUT:-emulator-out}
mkdir -p "$OUT"
FAIL=0
check() { if eval "$2"; then echo "✅ $1"; else echo "❌ $1"; FAIL=1; fi; }

adb install -r sentinela-app/android/app/build/outputs/apk/debug/app-debug.apk
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell settings put global window_animation_scale 0 || true
adb logcat -c
adb shell am start -n $PKG/.MainActivity
sleep 15
adb exec-out screencap -p > "$OUT/01-app-aberto.png" || true
adb logcat -d > "$OUT/logcat-abertura.txt" || true
check "app abriu (MainActivity em foco)" "adb shell dumpsys window | grep -q 'mCurrentFocus.*$PKG'"
check "WebView carregou a interface (sem 'Uncaught' no console)" "! grep -E 'Uncaught|SyntaxError|ReferenceError' '$OUT/logcat-abertura.txt'"
check "Capacitor carregou o app local" "grep -q 'Loading app at' '$OUT/logcat-abertura.txt'"

check "widget do plantão registrado no app" "adb shell dumpsys package $PKG | grep -q 'PlantaoWidget'"
check "biometria declarada" "adb shell dumpsys package $PKG | grep -q 'USE_BIOMETRIC'"

# Dispara um alarme de teste em 8 s e manda o app para segundo plano (HOME)
adb logcat -c
adb shell am broadcast -a br.com.sentinela.tatico.DEBUG_ALARM -n $PKG/.DebugTriggerReceiver --ei sec 8 --es sound sirene_lamento
adb shell input keyevent KEYCODE_HOME
sleep 16
adb exec-out screencap -p > "$OUT/02-alarme-tocando.png" || true
adb shell dumpsys activity services $PKG > "$OUT/services.txt" || true
adb shell dumpsys audio > "$OUT/audio.txt" || true
adb shell dumpsys alarm | grep -i "$PKG" > "$OUT/alarm.txt" || true
adb logcat -d > "$OUT/logcat-alarme.txt" || true
check "AlarmService está rodando em primeiro plano" "grep -q 'AlarmService' '$OUT/services.txt' && grep -qi 'isForeground=true' '$OUT/services.txt'"
check "som do alarme tocando no canal de ALARME (USAGE_ALARM)" "grep -i -B2 -A6 '$PKG' '$OUT/audio.txt' | grep -qi 'USAGE_ALARM'"
check "sem falhas fatais do app durante o alarme" "! grep -E 'FATAL EXCEPTION' '$OUT/logcat-alarme.txt'"
check "tela de alarme (AlarmActivity) aberta ou notificação de alarme ativa" "adb shell dumpsys window | grep -q 'AlarmActivity' || adb shell dumpsys notification --noredact | grep -q 'sentinela_alarme'"

# Desliga pela notificação/serviço e confere que parou
adb shell am force-stop $PKG || true
sleep 2
check "alarme parou depois de encerrar" "! adb shell dumpsys audio | grep -i -A6 '$PKG' | grep -qi 'state:started'"
echo "---- resumo ----"; [ $FAIL -eq 0 ] && echo "TUDO OK" || echo "HÁ FALHAS"
exit $FAIL
