package br.com.sentinela.tatico;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Configuração (transparência e tema) e dados comuns dos widgets da tela inicial. */
final class WidgetKit {
    private WidgetKit() {}

    static final class Th {
        final int bg, text, muted, accent;
        Th(String bg, String text, String muted, String accent) {
            this.bg = Color.parseColor(bg);
            this.text = Color.parseColor(text);
            this.muted = Color.parseColor(muted);
            this.accent = Color.parseColor(accent);
        }
    }

    static final class Row {
        long s, e, a;
        String l = "", p = "";
        boolean on;
    }

    static Th th(String name) {
        if ("claro".equals(name)) return new Th("#FFFFFF", "#111827", "#6B7280", "#D97706");
        if ("azul".equals(name)) return new Th("#0E1B40", "#EEF3FF", "#8FA4D6", "#38BDF8");
        return new Th("#111113", "#F0F0F4", "#9A9AA3", "#F5A524");
    }

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences("sentinela_widgets", Context.MODE_PRIVATE);
    }

    static int alpha(Context c, int id) { return sp(c).getInt("a_" + id, 88); }

    static String theme(Context c, int id) { return sp(c).getString("t_" + id, "escuro"); }

    static void save(Context c, int id, int alphaPct, String theme) {
        sp(c).edit().putInt("a_" + id, alphaPct).putString("t_" + id, theme).apply();
    }

    static void forget(Context c, int id) {
        sp(c).edit().remove("a_" + id).remove("t_" + id).apply();
    }

    /** Fundo arredondado com a cor do tema e a opacidade escolhida. */
    static void style(RemoteViews v, Context c, int id) {
        Th t = th(theme(c, id));
        v.setInt(R.id.w_bg, "setColorFilter", t.bg);
        v.setInt(R.id.w_bg, "setImageAlpha", Math.round(alpha(c, id) * 2.55f));
    }

    static String hhmm(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(ms));
    }

    static String dur(long ms) {
        long min = Math.max(0, ms / 60000);
        long d = min / 1440, h = (min % 1440) / 60, m = min % 60;
        if (d > 0) return d + (d == 1 ? " dia" : " dias");
        if (h > 0) return h + "h " + String.format(Locale.getDefault(), "%02d", m) + "min";
        return m + " min";
    }

    /** Quartos que ainda não terminaram, em ordem. */
    static List<Row> rows(Context c, long now, int max) {
        List<Row> out = new ArrayList<>();
        try {
            JSONObject j = new JSONObject(AlarmStore.widgetJson(c));
            JSONArray qs = j.optJSONArray("quartos");
            if (qs == null) return out;
            for (int i = 0; i < qs.length() && out.size() < max; i++) {
                JSONObject o = qs.optJSONObject(i);
                if (o == null || o.optLong("e") <= now) continue;
                Row r = new Row();
                r.s = o.optLong("s");
                r.e = o.optLong("e");
                r.a = o.optLong("a", r.s - 15 * 60000L);
                r.on = o.optBoolean("on", true);
                r.l = o.optString("l", "");
                String p = o.optString("p", "");
                r.p = p.isEmpty() ? "Sem posto" : p;
                out.add(r);
            }
        } catch (Exception ignored) {
            // sem dados ainda
        }
        return out;
    }

    static void updateOne(Context c, int id) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        AppWidgetProviderInfo info = m.getAppWidgetInfo(id);
        if (info == null) return;
        String n = info.provider.getClassName();
        RemoteViews v;
        if (n.endsWith("QuartosWidget")) v = QuartosWidget.build(c, id);
        else if (n.endsWith("ProximoWidget")) v = ProximoWidget.build(c, id);
        else v = PlantaoWidget.build(c, id);
        m.updateAppWidget(id, v);
    }

    static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        Class<?>[] kinds = {PlantaoWidget.class, QuartosWidget.class, ProximoWidget.class};
        for (Class<?> k : kinds) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            for (int id : ids) updateOne(c, id);
        }
    }
}
