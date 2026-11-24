package br.com.sentinela.tatico;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

/** Agenda os alarmes com AlarmManager.setAlarmClock: o mesmo mecanismo do relógio do celular (ignora o modo de economia). */
final class AlarmScheduler {
    static final String ACTION_FIRE = "br.com.sentinela.tatico.ALARM_FIRE";
    static final String EXTRA_ID = "id";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    static final String EXTRA_SOUND = "sound";

    private AlarmScheduler() {}

    private static Intent fireIntent(Context c, int id) {
        return new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE).setData(Uri.parse("sentinela://alarm/" + id));
    }

    static void scheduleOne(Context c, int id, long at, String title, String body, String sound) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent fire = fireIntent(c, id)
                .putExtra(EXTRA_ID, id).putExtra(EXTRA_TITLE, title).putExtra(EXTRA_BODY, body).putExtra(EXTRA_SOUND, sound);
        PendingIntent firePi = PendingIntent.getBroadcast(c, id, fire, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent showPi = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), firePi);
        } catch (SecurityException ignored) {
            // sem permissão de alarme exato: nada a fazer
        }
    }

    static void cancel(Context c, int id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(c, id, fireIntent(c, id), PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    /** Cancela os alarmes antigos e agenda de novo todos os futuros guardados. Devolve quantos foram agendados. */
    static int scheduleAll(Context c) {
        JSONArray old = AlarmStore.scheduledIds(c);
        for (int i = 0; i < old.length(); i++) cancel(c, old.optInt(i));

        JSONArray list = AlarmStore.alarms(c);
        JSONArray ids = new JSONArray();
        long now = System.currentTimeMillis();
        int n = 0;
        for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a == null) continue;
            long at = a.optLong("at", 0);
            int id = a.optInt("id", 0);
            if (id == 0 || at <= now) continue;
            scheduleOne(c, id, at, a.optString("title", "Alarme"), a.optString("body", ""), a.optString("sound", "sirene_lamento"));
            ids.put(id);
            n++;
        }
        AlarmStore.saveScheduledIds(c, ids);
        return n;
    }
}
