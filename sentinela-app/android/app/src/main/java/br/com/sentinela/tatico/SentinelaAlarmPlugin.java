package br.com.sentinela.tatico;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.OpenableColumns;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.Executor;

/** Ponte entre a interface web e o alarme nativo do Android. */
@CapacitorPlugin(name = "SentinelaAlarm")
public class SentinelaAlarmPlugin extends Plugin {
    private static final int TEST_ID = 900001;
    private MediaPlayer preview;
    private final Handler handler = new Handler(Looper.getMainLooper());

    /** Substitui TODOS os alarmes agendados pela lista recebida. */
    @PluginMethod
    public void schedule(PluginCall call) {
        Context c = getContext();
        JSArray alarms = call.getArray("alarms", new JSArray());
        AlarmStore.save(c, alarms,
                call.getInt("snoozeMin", 5), call.getBoolean("ramp", true), call.getInt("autostopMin", 5));
        int n = AlarmScheduler.scheduleAll(c);
        JSObject r = new JSObject();
        r.put("count", n);
        call.resolve(r);
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        Context c = getContext();
        AlarmStore.save(c, new JSArray(), AlarmStore.snoozeMin(c), AlarmStore.ramp(c), AlarmStore.autostopMin(c));
        AlarmScheduler.scheduleAll(c);
        call.resolve();
    }

    /** Dispara um alarme de teste daqui a N segundos (dá tempo de bloquear a tela). */
    @PluginMethod
    public void test(PluginCall call) {
        int sec = Math.max(3, call.getInt("seconds", 10));
        String sound = call.getString("sound", "sirene_lamento");
        AlarmScheduler.scheduleOne(getContext(), TEST_ID, System.currentTimeMillis() + sec * 1000L,
                "Teste de alarme", "É assim que o alarme do quarto vai tocar.", sound);
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("notifications", NotificationManagerCompat.from(c).areNotificationsEnabled());
        boolean fullScreen = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            fullScreen = nm != null && nm.canUseFullScreenIntent();
        }
        r.put("fullScreen", fullScreen);
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        r.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            exact = am != null && am.canScheduleExactAlarms();
        }
        r.put("exact", exact);
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String kind = call.getString("kind", "app");
        Context c = getContext();
        String pkg = c.getPackageName();
        Intent i;
        try {
            switch (kind) {
                case "notif":
                    i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
                    break;
                case "fullscreen":
                    if (Build.VERSION.SDK_INT >= 34) {
                        i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + pkg));
                    } else {
                        i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
                    }
                    break;
                case "battery":
                    i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg));
                    break;
                default:
                    i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(fallback);
            } catch (Exception e2) {
                call.reject("Não consegui abrir os ajustes");
                return;
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        Activity a = getActivity();
        if (Build.VERSION.SDK_INT >= 33 && a != null
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(a, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7781);
        }
        call.resolve();
    }

    // ---------------- versão instalada e atualização ----------------
    @PluginMethod
    public void appVersion(PluginCall call) {
        try {
            android.content.pm.PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("name", pi.versionName);
            r.put("code", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("sem versão");
        }
    }

    // Abre o link no navegador do celular (o download do APK é feito por ele).
    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith("https://")) { call.reject("link inválido"); return; }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("não foi possível abrir");
        }
    }

    // ---------------- biometria (digital/rosto) ----------------
    @PluginMethod
    public void bioStatus(PluginCall call) {
        int can = BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
        JSObject r = new JSObject();
        r.put("available", can == BiometricManager.BIOMETRIC_SUCCESS);
        r.put("code", can);
        call.resolve(r);
    }

    @PluginMethod
    public void bioAuth(PluginCall call) {
        Activity a = getActivity();
        if (!(a instanceof FragmentActivity)) {
            call.reject("biometria indisponível");
            return;
        }
        final FragmentActivity fa = (FragmentActivity) a;
        final String title = call.getString("title", "Sentinela Tático");
        fa.runOnUiThread(() -> {
            Executor ex = ContextCompat.getMainExecutor(fa);
            BiometricPrompt bp = new BiometricPrompt(fa, ex, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    JSObject r = new JSObject();
                    r.put("ok", true);
                    call.resolve(r);
                }

                @Override
                public void onAuthenticationError(int code, CharSequence msg) {
                    call.reject(String.valueOf(msg), String.valueOf(code));
                }
            });
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle("Confirme sua identidade")
                    .setNegativeButtonText("Usar PIN")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    .build();
            bp.authenticate(info);
        });
    }

    // ---------------- widget do plantão ----------------
    @PluginMethod
    public void widget(PluginCall call) {
        JSObject data = call.getObject("data");
        if (data != null) AlarmStore.saveWidget(getContext(), data.toString());
        PlantaoWidget.refresh(getContext());
        call.resolve();
    }

    // ---------------- sons importados ----------------
    @PluginMethod
    public void pickSound(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("audio/*");
        startActivityForResult(call, i, "pickSoundResult");
    }

    @ActivityCallback
    private void pickSoundResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelado");
            return;
        }
        Uri uri = result.getData().getData();
        Context c = getContext();
        String name = "Meu som";
        try (Cursor cur = c.getContentResolver().query(uri, null, null, null, null)) {
            if (cur != null && cur.moveToFirst()) {
                int idx = cur.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) name = cur.getString(idx);
            }
        } catch (Exception ignored) {
            // nome opcional
        }
        try {
            File dir = new File(c.getFilesDir(), "sounds");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("sem espaço para salvar");
            long ts = System.currentTimeMillis();
            String file = "custom_" + ts + ".snd";
            long total = 0;
            try (InputStream in = c.getContentResolver().openInputStream(uri);
                 OutputStream out = new FileOutputStream(new File(dir, file))) {
                if (in == null) throw new IllegalStateException("arquivo ilegível");
                byte[] buf = new byte[16 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) {
                    total += n;
                    if (total > 20L * 1024 * 1024) throw new IllegalStateException("arquivo maior que 20 MB");
                    out.write(buf, 0, n);
                }
            }
            String id = "custom:" + ts;
            AlarmStore.putSound(c, id, file);
            JSObject r = new JSObject();
            r.put("id", id);
            r.put("name", name);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Não consegui importar: " + e.getMessage());
        }
    }

    @PluginMethod
    public void removeSound(PluginCall call) {
        String id = call.getString("id", "");
        Context c = getContext();
        String f = AlarmStore.soundFile(c, id);
        if (f != null) new File(new File(c.getFilesDir(), "sounds"), f).delete();
        AlarmStore.removeSound(c, id);
        call.resolve();
    }

    // ---------------- prévia de som ----------------
    @PluginMethod
    public void preview(PluginCall call) {
        stopPreviewInternal();
        preview = SoundResolver.create(getContext(), call.getString("sound", "sirene_lamento"));
        if (preview != null) {
            preview.setLooping(true);
            preview.start();
            handler.postDelayed(this::stopPreviewInternal, 4000);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopPreview(PluginCall call) {
        stopPreviewInternal();
        call.resolve();
    }

    private void stopPreviewInternal() {
        if (preview != null) {
            try { preview.stop(); } catch (Exception ignored) { /* ok */ }
            preview.release();
            preview = null;
        }
    }
}
