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
        boolean head = true;
        String ctl = "bell";
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
        String l = "", p = "", d = "";
        int qi = -1;
        boolean on = true;
        boolean past;
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
        g.head = p.getBoolean("h_" + id, true);
        g.ctl = p.getString("k_" + id, "bell");
        return g;
    }

    static void save(Context c, int id, Cfg g) {
        sp(c).edit().putInt("a_" + id, g.alpha).putString("t_" + id, g.theme).putString("c_" + id, g.accent)
                .putInt("x_" + id, g.text).putInt("r_" + id, g.corner).putBoolean("l_" + id, g.alarm).putBoolean("h_" + id, g.head).putString("k_" + id, g.ctl).apply();
    }

    static void forget(Context c, int id) {
        sp(c).edit().remove("a_" + id).remove("t_" + id).remove("c_" + id).remove("x_" + id).remove("r_" + id).remove("l_" + id).remove("h_" + id).remove("k_" + id).apply();
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

    /** Todos os quartos que o app mandou (inclusive os que já passaram), em ordem. */
    private static List<Row> all(Context c, long now) {
        List<Row> out = new ArrayList<>();
        try {
            JSONObject j = new JSONObject(AlarmStore.widgetJson(c));
            JSONArray qs = j.optJSONArray("quartos");
            if (qs == null) return out;
            for (int i = 0; i < qs.length(); i++) {
                JSONObject o = qs.optJSONObject(i);
                if (o == null) continue;
                Row r = new Row();
                r.s = o.optLong("s");
                r.e = o.optLong("e");
                r.a = o.optLong("a", r.s - 15 * 60000L);
                r.on = o.optBoolean("on", true);
                r.l = o.optString("l", "");
                r.d = o.optString("d", "");
                r.qi = o.optInt("i", -1);
                String p = o.optString("p", "");
                r.p = p.isEmpty() ? "Sem posto" : p;
                r.past = r.e <= now;
                out.add(r);
            }
        } catch (Exception ignored) {
            // sem dados ainda
        }
        return out;
    }

    private static List<Row> sampleRows(long now, int max) {
        List<Row> out = new ArrayList<>();
        String[] l = {"18:00–20:00", "20:00–22:00", "22:00–00:00", "00:00–02:00", "02:00–04:00", "04:00–06:00", "06:00–08:00", "08:00–10:00"};
        String[] p = {"G2", "Bloco C", "G2", "Portaria", "G2", "Bloco A", "G2", "Bloco B"};
        long base = now - 2 * 3600000L;
        for (int i = 0; i < l.length && i < max; i++) {
            Row r = new Row();
            r.l = l[i];
            r.p = p[i];
            r.s = base + i * 2 * 3600000L;
            r.e = r.s + 2 * 3600000L;
            r.a = r.s - 15 * 60000L;
            r.past = r.e <= now;
            out.add(r);
        }
        return out;
    }

    /** Quartos que ainda não terminaram (ou exemplos, na prévia). */
    static List<Row> rows(Context c, long now, int max, boolean sample) {
        List<Row> out = new ArrayList<>();
        for (Row r : all(c, now)) {
            if (!r.past && out.size() < max) out.add(r);
        }
        if (out.isEmpty() && sample) {
            for (Row r : sampleRows(now, 8)) if (!r.past && out.size() < max) out.add(r);
        }
        return out;
    }

    /** Todos os quartos da noite marcada, até os que já passaram. anchor = primeiro que ainda não acabou. */
    static List<Row> night(Context c, long now, boolean sample, int[] anchor) {
        List<Row> list = all(c, now);
        if (list.isEmpty() && sample) list = sampleRows(now, 8);
        anchor[0] = -1;
        if (list.isEmpty()) return list;
        int an = list.size() - 1;
        for (int i = 0; i < list.size(); i++) {
            if (!list.get(i).past) {
                an = i;
                break;
            }
        }
        if (list.get(an).past && now - list.get(an).e > 12 * 3600000L) return new ArrayList<>();
        int lo = an, hi = an;
        while (lo > 0 && list.get(lo).s - list.get(lo - 1).e < 9 * 3600000L) lo--;
        while (hi < list.size() - 1 && list.get(hi + 1).s - list.get(hi).e < 9 * 3600000L) hi++;
        List<Row> g = new ArrayList<>(list.subList(lo, hi + 1));
        anchor[0] = an - lo;
        return g;
    }

    /** Toque: abre o app no ambiente dos quartos ("quartos") ou no alarme de um quarto ("alarme"). */
    static PendingIntent act(Context c, int widgetId, int slot, String open, Row r) {
        Intent in = new Intent(c, MainActivity.class);
        in.setData(android.net.Uri.parse("sentinela://widget/" + widgetId + "/" + slot));
        in.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        in.putExtra("open", open);
        if (r != null) {
            in.putExtra("date", r.d);
            in.putExtra("qi", r.qi);
        }
        return PendingIntent.getActivity(c, 0, in, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
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

    static RemoteViews build(Context c, int id, String kind, Cfg g, int w, int h, boolean sample) {
        if ("quartos".equals(kind)) return buildQuartos(c, id, g, w, h, sample);
        if ("proximo".equals(kind)) return buildProximo(c, id, g, w, h, sample);
        return buildPlantao(c, id, g, w, h, sample);
    }

    /** Texto riscado: o quarto já passou. */
    private static CharSequence strike(String t) {
        android.text.SpannableString sp = new android.text.SpannableString(t);
        sp.setSpan(new android.text.style.StrikethroughSpan(), 0, t.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return sp;
    }

    private static void size(RemoteViews v, int id, float sp, float f) {
        v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, sp * f);
    }

    /** [0]=fim do plantão em andamento (0 = nenhum), [1]=início do próximo (0 = nenhum). */
    static long[] shiftState(Context c, long now) {
        long[] r = new long[2];
        try {
            JSONArray sh = new JSONObject(AlarmStore.widgetJson(c)).optJSONArray("shifts");
            if (sh == null) return r;
            for (int i = 0; i < sh.length(); i++) {
                JSONObject o = sh.optJSONObject(i);
                if (o == null) continue;
                long s = o.optLong("s"), e = o.optLong("e");
                if (s <= now && now < e) r[0] = e;
                else if (s > now && r[1] == 0) r[1] = s;
            }
        } catch (Exception ignored) {
            // sem dados
        }
        return r;
    }

    /** Agenda a próxima atualização do widget para o próximo quarto/plantão que começa ou termina. */
    static void scheduleTick(Context c) {
        long now = System.currentTimeMillis();
        long next = now + 30 * 60000L;
        for (Row r : all(c, now)) {
            if (r.s > now && r.s < next) next = r.s;
            if (r.e > now && r.e < next) next = r.e;
        }
        long[] st = shiftState(c, now);
        if (st[0] > now && st[0] < next) next = st[0];
        if (st[1] > now && st[1] < next) next = st[1];
        try {
            android.app.AlarmManager am = (android.app.AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            Intent in = new Intent(c, PlantaoWidget.class).setAction("br.com.sentinela.tatico.WIDGET_TICK");
            PendingIntent pi = PendingIntent.getBroadcast(c, 7100, in, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            am.set(android.app.AlarmManager.RTC, next + 1500, pi);
        } catch (Exception ignored) {
            // o sistema ainda atualiza a cada 30 min
        }
    }

    // ---------- Quartos de hora
    private static final int[] QR = {R.id.qr1, R.id.qr2, R.id.qr3, R.id.qr4, R.id.qr5, R.id.qr6, R.id.qr7, R.id.qr8};
    private static final int[] QT = {R.id.qr1_t, R.id.qr2_t, R.id.qr3_t, R.id.qr4_t, R.id.qr5_t, R.id.qr6_t, R.id.qr7_t, R.id.qr8_t};
    private static final int[] QP = {R.id.qr1_p, R.id.qr2_p, R.id.qr3_p, R.id.qr4_p, R.id.qr5_p, R.id.qr6_p, R.id.qr7_p, R.id.qr8_p};
    private static final int[] QS = {R.id.qr1_sw, R.id.qr2_sw, R.id.qr3_sw, R.id.qr4_sw, R.id.qr5_sw, R.id.qr6_sw, R.id.qr7_sw, R.id.qr8_sw};
    private static final int[] QSK = {R.id.qr1_sk, R.id.qr2_sk, R.id.qr3_sk, R.id.qr4_sk, R.id.qr5_sk, R.id.qr6_sk, R.id.qr7_sk, R.id.qr8_sk};
    private static final int[] QKL = {R.id.qr1_kl, R.id.qr2_kl, R.id.qr3_kl, R.id.qr4_kl, R.id.qr5_kl, R.id.qr6_kl, R.id.qr7_kl, R.id.qr8_kl};
    private static final int[] QKR = {R.id.qr1_kr, R.id.qr2_kr, R.id.qr3_kr, R.id.qr4_kr, R.id.qr5_kr, R.id.qr6_kr, R.id.qr7_kr, R.id.qr8_kr};
    private static final int[] QA = {R.id.qr1_a, R.id.qr2_a, R.id.qr3_a, R.id.qr4_a, R.id.qr5_a, R.id.qr6_a, R.id.qr7_a, R.id.qr8_a};

    private static RemoteViews buildQuartos(Context c, int id, Cfg g, int w, int h, boolean sample) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quartos);
        Th t = th(c, g);
        style(v, g, t);
        float f = tx(g);
        long now = System.currentTimeMillis();
        boolean tag = h >= 70;
        boolean head = g.head && h >= 150;
        boolean sw = "switch".equals(g.ctl);
        float avail = h - 28 - (head ? 56 : (tag ? 22 : 0));
        int n = (int) clamp(avail / (36f * Math.max(1f, f)), 1, 8);
        int[] an = new int[1];
        List<Row> all = night(c, now, sample, an);
        int start = 0;
        if (all.size() > n) {
            start = Math.max(0, an[0] - (n >= 4 ? 1 : 0));
            start = Math.min(start, all.size() - n);
        }
        boolean showA = g.alarm && w >= 200;
        int dim = (t.muted & 0x00FFFFFF) | 0x88000000;
        int dimText = (t.text & 0x00FFFFFF) | 0x88000000;
        v.setViewVisibility(R.id.w_tag, tag && !head ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_head, head ? View.VISIBLE : View.GONE);
        if (head) {
            Row nx = null;
            for (Row r : all) if (!r.past && r.on && r.a > now) { nx = r; break; }
            v.setTextViewText(R.id.w_ht, nx != null ? hhmm(nx.a) : "--:--");
            v.setTextViewText(R.id.w_hv, nx != null ? dur(nx.a - now) : (all.isEmpty() ? "sem quartos" : "nenhum ligado"));
            v.setTextViewText(R.id.w_hr, nx != null ? "TOCA EM" : "");
            v.setTextColor(R.id.w_hl, t.muted);
            v.setTextColor(R.id.w_hr, t.muted);
            v.setTextColor(R.id.w_ht, t.accent);
            v.setTextColor(R.id.w_hv, t.text);
            size(v, R.id.w_ht, 34, Math.min(f, 1.2f));
            size(v, R.id.w_hv, 17, Math.min(f, 1.2f));
        }
        v.setTextColor(R.id.w_tag, t.muted);
        boolean allPast = !all.isEmpty() && an[0] >= 0 && all.get(an[0]).past;
        long[] ss = shiftState(c, now);
        boolean ended = !sample && (all.isEmpty() || allPast) && ss[0] == 0;
        String empty = "Nenhum quarto marcado";
        if (ended && ss[1] > 0) {
            empty = (allPast ? "Quartos concluídos ✓\n" : "") + "Próximo plantão: " + new SimpleDateFormat("EEE dd/MM", new Locale("pt", "BR")).format(new Date(ss[1])) + " " + hhmm(ss[1]) + "\nem " + dur(ss[1] - now);
        } else if (ended && allPast) {
            empty = "Quartos concluídos ✓";
        }
        if (ended) all = new ArrayList<>();
        v.setTextViewText(R.id.w_vazio, empty);
        v.setTextColor(R.id.w_vazio, t.muted);
        v.setViewVisibility(R.id.w_vazio, all.isEmpty() ? View.VISIBLE : View.GONE);
        for (int i = 0; i < 8; i++) {
            int k = start + i;
            if (i >= n || k >= all.size()) {
                v.setViewVisibility(QR[i], View.GONE);
                continue;
            }
            Row r = all.get(k);
            boolean cur = k == an[0];
            v.setViewVisibility(QR[i], View.VISIBLE);
            String alarmTxt = sw ? (r.on ? hhmm(r.a) : "--:--") : (r.on ? "🔔 " + hhmm(r.a) : "sem alarme");
            String lab = r.l.replace(":00", "");
            v.setTextViewText(QT[i], r.past ? strike(lab) : lab);
            v.setTextViewText(QP[i], r.past ? strike(r.p) : r.p);
            v.setTextViewText(QA[i], r.past ? strike(alarmTxt) : alarmTxt);
            v.setViewVisibility(QA[i], showA ? View.VISIBLE : View.GONE);
            v.setViewVisibility(QS[i], sw && w >= 200 ? View.VISIBLE : View.GONE);
            if (sw) {
                v.setInt(QSK[i], "setColorFilter", r.on ? (r.past ? dim : t.accent) : (t.muted & 0x00FFFFFF) | 0x44000000);
                v.setViewVisibility(QKL[i], r.on ? View.GONE : View.VISIBLE);
                v.setViewVisibility(QKR[i], r.on ? View.VISIBLE : View.GONE);
            }
            v.setTextColor(QT[i], r.past ? dim : (cur ? t.accent : t.muted));
            v.setTextColor(QP[i], r.past ? dimText : (cur ? t.accent : t.text));
            v.setTextColor(QA[i], r.past ? dim : (cur ? t.accent : t.muted));
            size(v, QT[i], 14, f);
            size(v, QP[i], 15, f);
            size(v, QA[i], 13, f);
            v.setOnClickPendingIntent(QR[i], act(c, id, 10 + i, r.qi >= 0 ? "alarme" : "quartos", r));
        }
        Row ar = !all.isEmpty() && an[0] >= 0 ? all.get(an[0]) : null;
        PendingIntent main = act(c, id, 1, "quartos", ar);
        v.setOnClickPendingIntent(R.id.widget_root, main);
        v.setOnClickPendingIntent(R.id.w_tag, main);
        v.setOnClickPendingIntent(R.id.w_vazio, main);
        return v;
    }

    // ---------- Próximo quarto
    private static RemoteViews buildProximo(Context c, int id, Cfg g, int w, int h, boolean sample) {
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
        v.setOnClickPendingIntent(R.id.widget_root, act(c, id, 2, rows.isEmpty() || rows.get(0).qi < 0 ? "quartos" : "alarme", rows.isEmpty() ? null : rows.get(0)));
        return v;
    }

    // ---------- Plantão
    private static RemoteViews buildPlantao(Context c, int id, Cfg g, int w, int h, boolean sample) {
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
        v.setOnClickPendingIntent(R.id.widget_root, act(c, id, 3, "quartos", rows.isEmpty() ? null : rows.get(0)));
        return v;
    }

    static void updateOne(Context c, int id) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (m.getAppWidgetInfo(id) == null) return;
        String kind = kindOf(c, id);
        int[] s = size(c, id, kind);
        m.updateAppWidget(id, build(c, id, kind, cfg(c, id), s[0], s[1], false));
        scheduleTick(c);
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
