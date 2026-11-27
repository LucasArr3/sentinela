package br.com.sentinela.tatico;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Serviço em primeiro plano que toca o alarme em loop no canal de ALARME, vibra, mantém o aparelho acordado
 * e mostra a tela de alarme sobre o bloqueio. Para sozinho depois do tempo configurado.
 */
public class AlarmService extends Service {
    static final String ACTION_START = "br.com.sentinela.tatico.ALARM_START";
    static final String ACTION_STOP = "br.com.sentinela.tatico.ALARM_STOP";
    static final String ACTION_SNOOZE = "br.com.sentinela.tatico.ALARM_SNOOZE";
    private static final int WATCH_ID2 = 7003;
    private Runnable watchTask;
    private boolean watchFlip;
    static final String ACTION_STOPPED = "br.com.sentinela.tatico.ALARM_STOPPED";
    private static final String CHANNEL = "sentinela_alarme";
    private static final int NOTIF_ID = 7001;
    private static final int WATCH_ID = 7002;
    private static final String WATCH_CHANNEL = "sentinela_relogio";
    /** Verdadeiro enquanto o alarme está vibrando/tocando (a tela principal usa para mostrar a tela de alarme). */
    static volatile boolean ringing = false;
    static volatile Bundle ringingExtras = null;
    private Runnable soundTask;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;
    private Vibrator vibrator;
    private AudioFocusRequest focusRequest;
    private Runnable rampTask;
    private Runnable autoStopTask;
    private Bundle current;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopAlarm();
        } else if (ACTION_SNOOZE.equals(action)) {
            snooze();
        } else {
            start(intent != null ? intent.getExtras() : null);
        }
        return START_NOT_STICKY;
    }

    private static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Alarmes de quarto", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Alarmes dos quartos de hora e da Alvorada");
        ch.setSound(null, null);          // o som é tocado pelo serviço, no canal de alarme
        ch.enableVibration(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /** Canal que faz o relógio (Galaxy Watch) vibrar: o aviso espelhado do celular é "alertante" e curto. */
    private static void ensureWatchChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(WATCH_CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(WATCH_CHANNEL, "Aviso no relógio", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Aviso do alarme que aparece e vibra no smartwatch");
        ch.setSound(null, null);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 1500, 250, 1500});
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /** Aviso para o smartwatch (espelhado pelo celular). Estático para o teste também poder usar. */
    static void postWatch(Context c, Bundle b) {
        postWatch(c, b, WATCH_ID);
    }

    static void postWatch(Context c, Bundle b, int notifId) {
        try {
            ensureWatchChannel(c);
            String title = b != null ? b.getString(AlarmScheduler.EXTRA_TITLE, "Alarme") : "Alarme";
            String body = b != null ? b.getString(AlarmScheduler.EXTRA_BODY, "") : "";
            int imm = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
            PendingIntent stop = PendingIntent.getService(c, 12, new Intent(c, AlarmService.class).setAction(ACTION_STOP), imm);
            PendingIntent snooze = PendingIntent.getService(c, 13, new Intent(c, AlarmService.class).setAction(ACTION_SNOOZE), imm);
            Notification n = new NotificationCompat.Builder(c, WATCH_CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setVibrate(new long[]{0, 1500, 250, 1500})
                    .setOngoing(false)
                    .setAutoCancel(true)
                    .setLocalOnly(false)
                    .extend(new NotificationCompat.WearableExtender().setHintContentIntentLaunchesActivity(false))
                    .setTimeoutAfter(AlarmStore.autostopMin(c) * 60_000L)
                    .addAction(0, "Desligar", stop)
                    .addAction(0, "Soneca", snooze)
                    .build();
            NotificationManagerCompat.from(c).notify(notifId, n);
        } catch (SecurityException ignored) {
            // sem permissão de notificação
        }
    }

    static Notification buildNotification(Context c, Bundle b) {
        String title = b != null ? b.getString(AlarmScheduler.EXTRA_TITLE, "Alarme") : "Alarme";
        String body = b != null ? b.getString(AlarmScheduler.EXTRA_BODY, "") : "";
        Intent act = new Intent(c, AlarmActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (b != null) act.putExtras(b);
        int imm = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent full = PendingIntent.getActivity(c, 1, act, imm);
        PendingIntent stop = PendingIntent.getService(c, 2, new Intent(c, AlarmService.class).setAction(ACTION_STOP), imm);
        PendingIntent snooze = PendingIntent.getService(c, 3, new Intent(c, AlarmService.class).setAction(ACTION_SNOOZE), imm);
        return new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title)
                .setContentText(body)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setFullScreenIntent(full, true)
                .setContentIntent(full)
                .addAction(0, "Soneca", snooze)
                .addAction(0, "Desligar", stop)
                .build();
    }

    /** Plano B se o sistema recusar iniciar o serviço: pelo menos mostra a notificação em tela cheia. */
    static void postFallback(Context c, Bundle b) {
        try {
            ensureChannel(c);
            NotificationManagerCompat.from(c).notify(NOTIF_ID, buildNotification(c, b));
        } catch (SecurityException ignored) {
            // sem permissão de notificação
        }
    }

    private void start(Bundle b) {
        stopPlayback();
        current = b;
        // o aviso do relógio sai ANTES de acender a tela: o celular só espelha para o relógio com a tela apagada
        if (AlarmStore.watch(this)) {
            postWatch(this, b, WATCH_ID);
            watchFlip = false;
            // repete o aviso a cada poucos segundos: cada aviso novo faz o relógio vibrar de novo
            watchTask = new Runnable() {
                @Override
                public void run() {
                    if (!ringing) return;
                    int next = watchFlip ? WATCH_ID : WATCH_ID2;
                    int old = watchFlip ? WATCH_ID2 : WATCH_ID;
                    watchFlip = !watchFlip;
                    postWatch(AlarmService.this, current, next);
                    NotificationManagerCompat.from(AlarmService.this).cancel(old);
                    handler.postDelayed(this, AlarmStore.watchRateMs(AlarmService.this));
                }
            };
            handler.postDelayed(watchTask, AlarmStore.watchRateMs(this));
        }
        ensureChannel(this);
        Notification n = buildNotification(this, b);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            postFallback(this, b);
        }

        int autostopMin = AlarmStore.autostopMin(this);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sentinela:alarme");
            wakeLock.acquire((autostopMin + 1) * 60_000L);
        }
        requestFocus();
        ringing = true;
        ringingExtras = b;
        final String sound = b != null ? b.getString(AlarmScheduler.EXTRA_SOUND, "sirene_lamento") : "sirene_lamento";
        String mode = AlarmStore.vibMode(this);
        if ("vib".equals(mode)) {
            startVibration();
        } else if ("som".equals(mode)) {
            startSound(sound);
            startVibration();
        } else {
            startVibration();
            soundTask = () -> startSound(sound);
            handler.postDelayed(soundTask, AlarmStore.vibLead(this) * 1000L);
        }
        showScreen(b);
        autoStopTask = this::stopAlarm;
        handler.postDelayed(autoStopTask, autostopMin * 60_000L);
    }

    /** Abre a tela de alarme direto (além do aviso em tela cheia), se o sistema permitir. */
    private void showScreen(Bundle b) {
        try {
            Intent act = new Intent(this, AlarmActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (b != null) act.putExtras(b);
            startActivity(act);
        } catch (Exception ignored) {
            // bloqueado pelo sistema: o aviso em tela cheia cobre
        }
    }

    private void startSound(String sound) {
        player = SoundResolver.create(this, sound);
        if (player == null) return;
        player.setLooping(true);
        final boolean ramp = AlarmStore.ramp(this);
        final float[] vol = {ramp ? 0.15f : 1f};
        player.setVolume(vol[0], vol[0]);
        player.start();
        if (ramp) {
            rampTask = new Runnable() {
                @Override
                public void run() {
                    vol[0] = Math.min(1f, vol[0] + 0.085f);
                    if (player != null) player.setVolume(vol[0], vol[0]);
                    if (vol[0] < 1f) handler.postDelayed(this, 800);
                }
            };
            handler.postDelayed(rampTask, 800);
        }
    }

    @SuppressWarnings("deprecation")
    private void startVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = vm != null ? vm.getDefaultVibrator() : null;
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                VibrationEffect fx = VibrationEffect.createWaveform(new long[]{0, 700, 500}, 0);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    vibrator.vibrate(fx, new android.os.VibrationAttributes.Builder().setUsage(android.os.VibrationAttributes.USAGE_ALARM).build());
                } else {
                    vibrator.vibrate(fx, SoundResolver.alarmAttrs());
                }
            }
        } catch (Exception ignored) {
            // vibração é opcional
        }
    }

    private void requestFocus() {
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                        .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                        .setOnAudioFocusChangeListener(change -> { })
                        .build();
                am.requestAudioFocus(focusRequest);
            }
        } catch (Exception ignored) {
            // foco de áudio é opcional
        }
    }

    private void stopPlayback() {
        if (watchTask != null) handler.removeCallbacks(watchTask);
        watchTask = null;
        if (soundTask != null) handler.removeCallbacks(soundTask);
        soundTask = null;
        if (rampTask != null) handler.removeCallbacks(rampTask);
        if (autoStopTask != null) handler.removeCallbacks(autoStopTask);
        rampTask = null;
        autoStopTask = null;
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) { /* já parado */ }
            player.release();
            player = null;
        }
        if (vibrator != null) {
            try { vibrator.cancel(); } catch (Exception ignored) { /* ok */ }
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        try {
            if (focusRequest != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (am != null) am.abandonAudioFocusRequest(focusRequest);
            }
        } catch (Exception ignored) { /* ok */ }
        focusRequest = null;
    }

    private void stopAlarm() {
        stopPlayback();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        NotificationManagerCompat.from(this).cancel(NOTIF_ID);
        NotificationManagerCompat.from(this).cancel(WATCH_ID);
        NotificationManagerCompat.from(this).cancel(WATCH_ID2);
        ringing = false;
        ringingExtras = null;
        sendBroadcast(new Intent(ACTION_STOPPED).setPackage(getPackageName()));
        current = null;
        stopSelf();
    }

    private void snooze() {
        if (current != null) {
            int id = current.getInt(AlarmScheduler.EXTRA_ID, 0);
            long at = System.currentTimeMillis() + AlarmStore.snoozeMin(this) * 60_000L;
            int snoozeId = (id ^ 0x5A5A5A5A) & 0x7FFFFFFF;
            if (snoozeId == 0) snoozeId = 1;
            String title = current.getString(AlarmScheduler.EXTRA_TITLE, "Alarme");
            if (!title.endsWith("(soneca)")) title = title + " (soneca)";
            AlarmScheduler.scheduleOne(this, snoozeId, at, title, current.getString(AlarmScheduler.EXTRA_BODY, ""),
                    current.getString(AlarmScheduler.EXTRA_SOUND, "sirene_lamento"));
        }
        stopAlarm();
    }

    @Override
    public void onDestroy() {
        stopPlayback();
        super.onDestroy();
    }
}
