package br.com.sentinela.tatico;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;

/** Guarda a lista de alarmes (enviada pela interface web) para reagendar após reiniciar o aparelho. */
final class AlarmStore {
    private static final String PREF = "sentinela_alarm";

    private AlarmStore() {}

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    static void save(Context c, JSONArray alarms, int snoozeMin, boolean ramp, int autostopMin) {
        sp(c).edit()
                .putString("alarms", alarms.toString())
                .putInt("snooze", snoozeMin)
                .putBoolean("ramp", ramp)
                .putInt("autostop", autostopMin)
                .apply();
    }

    static JSONArray alarms(Context c) {
        try {
            return new JSONArray(sp(c).getString("alarms", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static int snoozeMin(Context c) { return Math.max(1, sp(c).getInt("snooze", 5)); }
    static boolean ramp(Context c) { return sp(c).getBoolean("ramp", true); }
    static int autostopMin(Context c) { return Math.max(1, sp(c).getInt("autostop", 5)); }

    /** Ids já agendados no AlarmManager (para poder cancelar antes de reagendar). */
    static JSONArray scheduledIds(Context c) {
        try {
            return new JSONArray(sp(c).getString("sched", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static void saveScheduledIds(Context c, JSONArray ids) {
        sp(c).edit().putString("sched", ids.toString()).apply();
    }

    // ---- widget do plantão: resumo calculado pela interface (próximos plantões e quartos) ----
    static void saveWidget(Context c, String json) { sp(c).edit().putString("widget", json).apply(); }
    static String widgetJson(Context c) { return sp(c).getString("widget", "{}"); }

    // ---- sons importados pelo usuário: id "custom:123" -> nome do arquivo em filesDir/sounds ----
    static void putSound(Context c, String id, String file) { sp(c).edit().putString("snd_" + id, file).apply(); }
    static String soundFile(Context c, String id) { return sp(c).getString("snd_" + id, null); }
    static void removeSound(Context c, String id) { sp(c).edit().remove("snd_" + id).apply(); }
}
