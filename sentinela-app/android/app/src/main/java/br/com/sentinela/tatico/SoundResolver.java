package br.com.sentinela.tatico;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;

import java.io.File;

/** Prepara um MediaPlayer no canal de ALARME (toca mesmo no silencioso e respeita o volume de alarme). */
final class SoundResolver {
    private SoundResolver() {}

    static AudioAttributes alarmAttrs() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }

    static String safe(String s) {
        return (s != null && s.matches("[a-z0-9_]+")) ? s : "sirene_lamento";
    }

    /** Devolve um player pronto (preparado) ou null se nem o som padrão do aparelho abrir. */
    static MediaPlayer create(Context c, String sound) {
        MediaPlayer m = new MediaPlayer();
        try {
            m.setAudioAttributes(alarmAttrs());
            if (sound != null && sound.startsWith("custom:")) {
                String f = AlarmStore.soundFile(c, sound);
                File file = f == null ? null : new File(new File(c.getFilesDir(), "sounds"), f);
                if (file == null || !file.exists()) throw new IllegalStateException("som importado não encontrado");
                m.setDataSource(file.getAbsolutePath());
            } else {
                AssetFileDescriptor afd = c.getAssets().openFd("public/sounds/" + safe(sound) + ".wav");
                try {
                    m.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                } finally {
                    afd.close();
                }
            }
            m.prepare();
            return m;
        } catch (Exception first) {
            try {
                m.reset();
                m.setAudioAttributes(alarmAttrs());
                m.setDataSource(c, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
                m.prepare();
                return m;
            } catch (Exception second) {
                m.release();
                return null;
            }
        }
    }
}
