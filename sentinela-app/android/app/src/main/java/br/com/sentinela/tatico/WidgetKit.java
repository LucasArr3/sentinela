package br.com.sentinela.tatico;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Configuração, dados e desenho (com tamanho variável) dos widgets da tela inicial. */
final class WidgetKit {
    private WidgetKit() {}

    static final String[] THEMES = {"auto", "escuro", "preto", "claro", "azul"};
    static final String[] THEME_NAMES = {"Do celular", "Escuro", "Preto", "Claro", "Azul"};
    static final String[] ACCENTS = {"padrao", "ambar", "azul", "verde", "rosa", "vermelho"};
    static final String[] ACCENT_HEX = {"", "#F5A524", "#38BDF8", "#22C55E", "#F472B6", "#EF4444"};

    /** Opções de cada widget. */
    static final class Cfg {
        int alpha = 88;
        String theme = "escuro";
        String accent = "padrao";
        int text = 1;
        int corner = 1;
        boolean alarm = true;
    }

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
        boolean on = true;
    }

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences("sentinela_widgets", Context.MODE_PRIVATE);
    }

    static Cfg cfg(Context c, int id) {
        SharedPreferences p = sp(c);
        Cfg g = new Cfg();
        g.alpha = p.getInt("a_" + id, 88);
        g.theme = p.getString("t_" + id, "escuro");
        g.accent = p.getString("c_" + id, "padrao");
        g.text = p.getInt("x_" + id, 1);
        g.corner = p.getInt("r_" + id, 1);
        g.alarm = p.getBoolean("l_" + id, true);
        return g;
    }

    static void save(Context c, int id, Cfg g) {
        sp(c).edit().putInt("a_" + id, g.alpha).putString("t_" + id, g.theme).putString("c_" + id, g.accent)
                .putInt("x_" + id, g.text).putInt("r_" + id, g.corner).putBoolean("l_" + id, g.alarm).apply();
    }

    static void forget(Context c, int id) {
        sp(c).edit().remove("a_" + id).remove("t_" + id).remove("c_" + id).remove("x_" + id).remove("r_" + id).remove("l_" + id).apply();
    }

    static Th th(Context c, Cfg g) {
        String n = g.theme;
        if ("auto".equals(n)) {
            boolean night = (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
            n = night ? "escuro" : "claro";
        }
        Th t;
        if ("claro".equals(n)) t = new Th("#FFFFFF", "#111827", "#6B7280", "#D97706");
        else if ("azul".equals(n)) t = new Th("#0E1B40", "#EEF3FF", "#8FA4D6", "#38BDF8");
        else if ("preto".equals(n)) t = new Th("#000000", "#F5F5F7", "#9A9AA3", "#F5A524");
        else t = new Th("#111113", "#F0F0F4", "#9A9AA3", "#F5A524");
        for (int i = 1; i < ACCENTS.length; i++) {
            if (ACCENTS[i].equals(g.accent)) return new Th(hex(t.bg), hex(t.text), hex(t.muted), ACCENT_HEX[i]);
        }
        return t;
    }

    private static String hex(int c) {
        return String.format(Locale.US, "#%06X", c & 0xFFFFFF);
    }

    static float tx(Cfg g) {
        return g.text == 0 ? 0.88f : (g.text == 2 ? 1.18f : 1f);
    }

    private static float clamp(float v, float lo, float hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    /** Fundo arredondado com a cor do tema e a opacidade escolhida. */
    static void style(RemoteViews v, Cfg g, Th t) {
        int res = g.corner == 0 ? R.drawable.widget_shape_sq : (g.corner == 2 ? R.drawable.widget_shape_lg : R.drawable.widget_shape_md);
        v.setImageViewResource(R.id.w_bg, res);
        v.setInt(R.id.w_bg, "setColorFilter", t.bg);
        v.setInt(R.id.w_bg, "setImageAlpha", Math.round(g.alpha * 2.55f));
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

    /** Quartos que ainda não terminaram, em ordem (ou exemplos, na prévia). */
    static List<Row> rows(Context c, long now, int max, boolean sample) {
        List<Row> out = new ArrayList<>();
        try {
            JSONObject j = new JSONObject(AlarmStore.widgetJson(c));
            JSONArray qs = j.optJSONArray("quartos");
            if (qs != null) {
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
            }
        } catch (Exception ignored) {
            // sem dados ainda
        }
        if (out.isEmpty() && sample) {
            String[] l = {"18:00–20:00", "20:00–22:00", "00:00–02:00", "02:00–04:00", "04:00–06:00", "06:00–08:00"};
            String[] p = {"G2", "Bloco C", "G2", "Portaria", "G2", "Bloco A"};
            long base = now + 3 * 3600000L;
            for (int i = 0; i < l.length && i < max; i++) {
                Row r = new Row();
                r.l = l[i];
                r.p = p[i];
                r.s = base + i * 2 * 3600000L;
                r.e = r.s + 2 * 3600000L;
                r.a = r.s - 15 * 60000L;
                out.add(r);
            }
        }
        return out;
    }

    static String kindOf(Context c, int id) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(c).getAppWidgetInfo(id);
        if (info == null) return "plantao";
        String n = info.provider.getClassName();
        if (n.endsWith("QuartosWidget")) return "quartos";
        if (n.endsWith("ProximoWidget")) return "proximo";
        return "plantao";
    }

    /** Tamanho atual do widget em dp {largura, altura}. */
    static int[] size(Context c, int id, String kind) {
        int w = 0, h = 0;
        Bundle o = AppWidgetManager.getInstance(c).getAppWidgetOptions(id);
        if (o != null) {
            w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
            h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        }
        if (w <= 0) w = "proximo".equals(kind) ? 160 : 300;
        if (h <= 0) h = "plantao".equals(kind) ? 120 : ("quartos".equals(kind) ? 230 : 160);
        return new int[]{w, h};
    }

    static RemoteViews build(Context c, String kind, Cfg g, int w, int h, boolean sample) {
        if ("quartos".equals(kind)) return buildQuartos(c, g, w, h, sample);
        if ("proximo".equals(kind)) return buildProximo(c, g, w, h, sample);
        return buildPlantao(c, g, w, h, sample);
    }

    private static void size(RemoteViews v, int id, float sp, float f) {
        v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, sp * f);
    }

    private static void open(RemoteViews v, Context c, int code) {
        PendingIntent pi = PendingIntent.getActivity(c, code, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
    }


    // ---------- Quartos de hora
    private static final int[] QR = {R.id.qr1, R.id.qr2, R.id.qr3, R.id.qr4, R.id.qr5, R.id.qr6};
    private static final int[] QT = {R.id.qr1_t, R.id.qr2_t, R.id.qr3_t, R.id.qr4_t, R.id.qr5_t, R.id.qr6_t};
    private static final int[] QP = {R.id.qr1_p, R.id.qr2_p, R.id.qr3_p, R.id.qr4_p, R.id.qr5_p, R.id.qr6_p};
    private static final int[] QA = {R.id.qr1_a, R.id.qr2_a, R.id.qr3_a, R.id.qr4_a, R.id.qr5_a, R.id.qr6_a};

    private static RemoteViews buildQuartos(Context c, Cfg g, int w, int h, boolean sample) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quartos);
        Th t = th(c, g);
        style(v, g, t);
        float f = tx(g);
        boolean tag = h >= 70;
        float avail = h - 28 - (tag ? 18 : 0);
        int n = (int) clamp(avail / (38f * f), 1, 6);
        List<Row> rows = rows(c, System.currentTimeMillis(), n, sample);
        boolean showA = g.alarm && w >= 200;
        v.setViewVisibility(R.id.w_tag, tag ? View.VISIBLE : View.GONE);
        v.setTextColor(R.id.w_tag, t.muted);
        v.setTextViewText(R.id.w_vazio, "Nenhum quarto marcado");
        v.setTextColor(R.id.w_vazio, t.muted);
        v.setViewVisibility(R.id.w_vazio, rows.isEmpty() ? View.VISIBLE : View.GONE);
        for (int i = 0; i < 6; i++) {
            if (i >= rows.size()) {
                v.setViewVisibility(QR[i], View.GONE);
                continue;
            }
            Row r = rows.get(i);
            boolean first = i == 0;
            v.setViewVisibility(QR[i], View.VISIBLE);
            v.setTextViewText(QT[i], r.l);
            v.setTextViewText(QP[i], r.p);
            v.setTextViewText(QA[i], r.on ? "🔔 " + hhmm(r.a) : "sem alarme");
            v.setViewVisibility(QA[i], showA ? View.VISIBLE : View.GONE);
            v.setTextColor(QT[i], first ? t.accent : t.muted);
            v.setTextColor(QP[i], first ? t.accent : t.text);
            v.setTextColor(QA[i], first ? t.accent : t.muted);
            size(v, QT[i], 14, f);
            size(v, QP[i], 15, f);
            size(v, QA[i], 13, f);
        }
        open(v, c, 8);
        return v;
    }

    // ---------- Próximo quarto
    private static RemoteViews buildProximo(Context c, Cfg g, int w, int h, boolean sample) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_proximo);
        Th t = th(c, g);
        style(v, g, t);
        float f = tx(g) * clamp(Math.min(w, h) / 150f, 0.75f, 2f);
        long now = System.currentTimeMillis();
        List<Row> rows = rows(c, now, 1, sample);
        v.setTextColor(R.id.w_tag, t.accent);
        v.setTextColor(R.id.p_hora, t.text);
        v.setTextColor(R.id.p_posto, t.text);
        v.setTextColor(R.id.p_alarme, t.muted);
        v.setTextColor(R.id.p_count, t.accent);
        size(v, R.id.w_tag, 10, Math.min(f, 1.4f));
        size(v, R.id.p_hora, 22, f);
        size(v, R.id.p_posto, 17, f);
        size(v, R.id.p_alarme, 12, f);
        size(v, R.id.p_count, 18, f);
        v.setViewVisibility(R.id.w_tag, h >= 75 ? View.VISIBLE : View.GONE);
        if (rows.isEmpty()) {
            v.setTextViewText(R.id.w_tag, "PRÓXIMO QUARTO");
            v.setTextViewText(R.id.p_hora, "—");
            v.setTextViewText(R.id.p_posto, "Nenhum quarto marcado");
            v.setViewVisibility(R.id.p_alarme, View.GONE);
            v.setViewVisibility(R.id.p_count, View.GONE);
        } else {
            Row r = rows.get(0);
            boolean agora = r.s <= now;
            v.setTextViewText(R.id.w_tag, agora ? "QUARTO AGORA" : "PRÓXIMO QUARTO");
            v.setTextViewText(R.id.p_hora, r.l);
            v.setTextViewText(R.id.p_posto, r.p);
            v.setTextViewText(R.id.p_alarme, agora ? "termina às " + hhmm(r.e) : (r.on && g.alarm ? "Alarme às " + hhmm(r.a) : (g.alarm ? "Sem alarme" : "")));
            v.setViewVisibility(R.id.p_alarme, h >= 100 && (agora || g.alarm) ? View.VISIBLE : View.GONE);
            long target = agora ? r.e : r.s;
            if (Build.VERSION.SDK_INT >= 24 && h >= 125) {
                v.setViewVisibility(R.id.p_count, View.VISIBLE);
                v.setChronometerCountDown(R.id.p_count, true);
                v.setChronometer(R.id.p_count, SystemClock.elapsedRealtime() + (target - now), null, true);
            } else {
                v.setViewVisibility(R.id.p_count, View.GONE);
            }
        }
        open(v, c, 9);
        return v;
    }

    // ---------- Plantão
    private static RemoteViews buildPlantao(Context c, Cfg g, int w, int h, boolean sample) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_plantao);
        Th t = th(c, g);
        style(v, g, t);
        float f = tx(g) * clamp(Math.min(w / 250f, h / 110f), 0.8f, 1.7f);
        String status = "Abra o app";
        String sub = "Toque para atualizar a escala";
        String quarto = "";
        long now = System.currentTimeMillis();
        boolean found = false;
        try {
            JSONObject j = new JSONObject(AlarmStore.widgetJson(c));
            JSONArray shifts = j.optJSONArray("shifts");
            JSONObject cur = null, next = null;
            if (shifts != null) {
                for (int i = 0; i < shifts.length(); i++) {
                    JSONObject o = shifts.optJSONObject(i);
                    if (o == null) continue;
                    long s = o.optLong("s"), e = o.optLong("e");
                    if (s <= now && now < e) cur = o;
                    else if (s > now && next == null) next = o;
                }
            }
            if (cur != null) {
                long e = cur.optLong("e");
                status = "EM SERVIÇO";
                sub = "Termina às " + hhmm(e) + " · faltam " + dur(e - now);
                found = true;
            } else if (next != null) {
                long s = next.optLong("s");
                status = "Plantão " + new SimpleDateFormat("EEE dd/MM", new Locale("pt", "BR")).format(new Date(s));
                sub = "Entrada " + hhmm(s) + " · em " + dur(s - now);
                found = true;
            }
        } catch (Exception ignored) {
            // mantém os textos padrão
        }
        List<Row> rows = rows(c, now, 1, sample);
        if (!rows.isEmpty()) {
            Row r = rows.get(0);
            quarto = r.l + " · " + r.p + (r.s <= now ? " · agora" : (g.alarm ? " · alarme " + hhmm(r.a) : ""));
        }
        if (!found && sample) {
            status = "EM SERVIÇO";
            sub = "Termina às 07:00 · faltam 12h 34min";
        }
        v.setTextViewText(R.id.w_tag, "SENTINELA TÁTICO");
        v.setTextColor(R.id.w_tag, t.muted);
        v.setTextViewText(R.id.w_status, status);
        v.setTextColor(R.id.w_status, t.text);
        v.setTextViewText(R.id.w_sub, sub);
        v.setTextColor(R.id.w_sub, t.muted);
        v.setTextViewText(R.id.w_quarto, quarto);
        v.setTextColor(R.id.w_quarto, t.accent);
        size(v, R.id.w_tag, 10, Math.min(f, 1.3f));
        size(v, R.id.w_status, 20, f);
        size(v, R.id.w_sub, 13, f);
        size(v, R.id.w_quarto, 13, f);
        v.setViewVisibility(R.id.w_tag, h >= 80 ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_sub, h >= 60 ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_quarto, quarto.isEmpty() || h < 95 ? View.GONE : View.VISIBLE);
        open(v, c, 7);
        return v;
    }

    static void updateOne(Context c, int id) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (m.getAppWidgetInfo(id) == null) return;
        String kind = kindOf(c, id);
        int[] s = size(c, id, kind);
        m.updateAppWidget(id, build(c, kind, cfg(c, id), s[0], s[1], false));
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
