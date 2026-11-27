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
        String after = "proximo";
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
        g.after = p.getString("o_" + id, "proximo");
        g.ctl = p.getString("k_" + id, "alarmes".equals(kindOf(c, id)) ? "switch" : "bell");
        return g;
    }

    static void save(Context c, int id, Cfg g) {
        sp(c).edit().putInt("a_" + id, g.alpha).putString("t_" + id, g.theme).putString("c_" + id, g.accent)
                .putInt("x_" + id, g.text).putInt("r_" + id, g.corner).putBoolean("l_" + id, g.alarm).putBoolean("h_" + id, g.head).putString("k_" + id, g.ctl).putString("o_" + id, g.after).apply();
    }

    static void forget(Context c, int id) {
        sp(c).edit().remove("a_" + id).remove("t_" + id).remove("c_" + id).remove("x_" + id).remove("r_" + id).remove("l_" + id).remove("h_" + id).remove("k_" + id).remove("o_" + id).apply();
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
        if (n.endsWith("AlarmesWidget")) return "alarmes";
        if (n.endsWith("CentralWidget")) return "central";
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
        if (h <= 0) h = "plantao".equals(kind) || "central".equals(kind) ? 120 : ("quartos".equals(kind) || "alarmes".equals(kind) ? 230 : 160);
        return new int[]{w, h};
    }

    static RemoteViews build(Context c, int id, String kind, Cfg g, int w, int h, boolean sample) {
        if ("quartos".equals(kind)) return buildQuartos(c, id, g, w, h, sample, false);
        if ("alarmes".equals(kind)) return buildQuartos(c, id, g, w, h, sample, false);
        if ("central".equals(kind)) return buildCentral(c, id, g, w, h, sample);
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

    /** [0]=início, [1]=fim do último plantão que já acabou; [2]=extras do mês. */
    static long[] lastInfo(Context c) {
        long[] r = new long[3];
        try {
            JSONObject j = new JSONObject(AlarmStore.widgetJson(c));
            JSONObject l = j.optJSONObject("last");
            if (l != null) { r[0] = l.optLong("s"); r[1] = l.optLong("e"); }
            r[2] = j.optLong("extrasMonth", 0);
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

    private static RemoteViews buildQuartos(Context c, int id, Cfg g, int w, int h, boolean sample, boolean apq) {
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
        boolean showA = (g.alarm || apq) && w >= 200;
        int dim = (t.muted & 0x00FFFFFF) | 0x88000000;
        int dimText = (t.text & 0x00FFFFFF) | 0x88000000;
        v.setViewVisibility(R.id.w_tag, tag && !head ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_head, head ? View.VISIBLE : View.GONE);
        v.setTextColor(R.id.w_tag, t.muted);
        boolean allPast = !all.isEmpty() && an[0] >= 0 && all.get(an[0]).past;
        long[] ss = shiftState(c, now);
        long lastEnd = 0;
        for (Row r : all) if (r.e > lastEnd) lastEnd = r.e;
        boolean idle = !sample && (all.isEmpty() || allPast) && ss[0] == 0;
        boolean keep = idle && allPast && ("ultimo".equals(g.after) || ("resumo".equals(g.after) && now - lastEnd < 6 * 3600000L));
        boolean ended = idle && !keep;
        if (ended && ss[1] > 0 && h < 100) return buildPlantao(c, id, g, w, h, sample);
        if (idle && ss[1] > 0 && h >= 100) head = true;
        String dia = ss[1] > 0 ? new SimpleDateFormat("EEE dd/MM", new Locale("pt", "BR")).format(new Date(ss[1])) : "";
        String empty = "Nenhum quarto marcado";
        if (ended && ss[1] > 0) empty = "Plantão " + dia + " " + hhmm(ss[1]);
        if (head) {
            Row nx = null;
            for (Row r : all) if (!r.past && r.on && r.a > now) { nx = r; break; }
            if (idle && ss[1] > 0) {
                v.setTextViewText(R.id.w_hl, "PRÓXIMO PLANTÃO");
                v.setTextViewText(R.id.w_ht, hhmm(ss[1]));
                v.setTextViewText(R.id.w_hr, "ENTRA EM");
                v.setTextViewText(R.id.w_hv, dur(ss[1] - now));
                long[] li = lastInfo(c);
                java.util.Calendar cs = java.util.Calendar.getInstance();
                cs.setTimeInMillis(now);
                java.util.Calendar cl = java.util.Calendar.getInstance();
                cl.setTimeInMillis(li[0]);
                boolean today = li[0] > 0 && cs.get(java.util.Calendar.DAY_OF_YEAR) == cl.get(java.util.Calendar.DAY_OF_YEAR) && cs.get(java.util.Calendar.YEAR) == cl.get(java.util.Calendar.YEAR);
                empty = (today ? "Plantão encerrado" : "Folga hoje") + (li[2] > 0 ? " · " + li[2] + (li[2] == 1 ? " extra" : " extras") + " no mês" : "");
            } else {
                v.setTextViewText(R.id.w_hl, "PRÓXIMO ALARME");
                v.setTextViewText(R.id.w_ht, nx != null ? hhmm(nx.a) : "--:--");
                v.setTextViewText(R.id.w_hv, nx != null ? dur(nx.a - now) : (all.isEmpty() ? "sem quartos" : "nenhum ligado"));
                v.setTextViewText(R.id.w_hr, nx != null ? "TOCA EM" : "");
            }
            v.setTextColor(R.id.w_hl, t.muted);
            v.setTextColor(R.id.w_hr, t.muted);
            v.setTextColor(R.id.w_ht, t.accent);
            v.setTextColor(R.id.w_hv, t.text);
            size(v, R.id.w_ht, 34, Math.min(f, 1.2f));
            size(v, R.id.w_hv, 17, Math.min(f, 1.2f));
        }
        if (ended) all = new ArrayList<>();
        if (keep) empty = "";
        v.setTextViewText(R.id.w_vazio, empty);
        v.setTextColor(R.id.w_vazio, t.muted);
        v.setViewVisibility(R.id.w_vazio, all.isEmpty() && !empty.isEmpty() ? View.VISIBLE : View.GONE);
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
            if (apq) {
                String at = r.on ? hhmm(r.a) : "--:--";
                v.setTextViewText(QT[i], r.past ? strike(at) : at);
                v.setTextViewText(QA[i], r.past ? strike(lab) : lab);
            } else {
            v.setTextViewText(QT[i], r.past ? strike(lab) : lab);
            }
            v.setTextViewText(QP[i], r.past ? strike(r.p) : r.p);
            if (!apq) v.setTextViewText(QA[i], r.past ? strike(alarmTxt) : alarmTxt);
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

    // ---------- Central do plantão
    private static RemoteViews buildCentral(Context c, int id, Cfg g, int w, int h, boolean sample) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_central);
        Th t = th(c, g);
        style(v, g, t);
        float f = tx(g) * clamp(Math.min(w / 270f, h / 130f), 0.8f, 1.5f);
        long now = System.currentTimeMillis();
        long[] ss = shiftState(c, now);
        long shiftStart = 0;
        try {
            JSONArray sh = new JSONObject(AlarmStore.widgetJson(c)).optJSONArray("shifts");
            if (sh != null) for (int i = 0; i < sh.length(); i++) {
                JSONObject o = sh.optJSONObject(i);
                if (o != null && o.optLong("s") <= now && now < o.optLong("e")) shiftStart = o.optLong("s");
            }
        } catch (Exception ignored) {
            // sem dados
        }
        boolean serving = ss[0] > 0;
        if (sample && !serving && ss[1] == 0) { serving = true; ss[0] = now + 7 * 3600000L; shiftStart = now - 17 * 3600000L; }
        long[] li = lastInfo(c);
        boolean folga = !serving && ss[1] > 0;
        String tag, big, el, ev;
        if (folga) {
            tag = "FOLGA";
            big = "Descanso até " + new SimpleDateFormat("EEE", new Locale("pt", "BR")).format(new Date(ss[1]));
            el = "";
            ev = "";
        } else if (serving) {
            tag = "EM SERVIÇO";
            big = "faltam " + dur(ss[0] - now);
            el = "TERMINA";
            ev = hhmm(ss[0]);
        } else if (ss[1] > 0) {
            tag = "PRÓXIMO PLANTÃO";
            big = new SimpleDateFormat("EEE dd/MM", new Locale("pt", "BR")).format(new Date(ss[1]));
            el = "ENTRADA";
            ev = hhmm(ss[1]);
        } else {
            tag = "SENTINELA TÁTICO";
            big = "Abra o app";
            el = "";
            ev = "";
        }
        v.setTextViewText(R.id.w_tag, tag);
        v.setTextColor(R.id.w_tag, t.muted);
        v.setTextViewText(R.id.c_big, big);
        v.setTextColor(R.id.c_big, t.text);
        v.setTextViewText(R.id.c_el, el);
        v.setTextColor(R.id.c_el, t.muted);
        v.setTextViewText(R.id.c_ev, ev);
        v.setTextColor(R.id.c_ev, t.text);
        size(v, R.id.w_tag, 10, Math.min(f, 1.3f));
        size(v, R.id.c_el, 10, Math.min(f, 1.3f));
        size(v, R.id.c_big, 26, f);
        size(v, R.id.c_ev, 20, f);
        if (folga && li[1] > 0 && ss[1] > li[1]) {
            int total = 24, fill = (int) Math.max(0, Math.min(total, Math.round(total * (double) (now - li[1]) / (ss[1] - li[1]))));
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < total; i++) b.append('━');
            android.text.SpannableString bar = new android.text.SpannableString(b.toString());
            bar.setSpan(new android.text.style.ForegroundColorSpan(t.accent), 0, fill, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            bar.setSpan(new android.text.style.ForegroundColorSpan((t.muted & 0x00FFFFFF) | 0x55000000), fill, total, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.c_bar, bar);
            v.setViewVisibility(R.id.c_bar, View.VISIBLE);
        } else if (serving && shiftStart > 0 || (serving && sample)) {
            int total = 24, fill = (int) Math.max(0, Math.min(total, Math.round(total * (double) (now - shiftStart) / (ss[0] - shiftStart))));
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < total; i++) b.append('━');
            android.text.SpannableString bar = new android.text.SpannableString(b.toString());
            bar.setSpan(new android.text.style.ForegroundColorSpan(t.accent), 0, fill, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            bar.setSpan(new android.text.style.ForegroundColorSpan((t.muted & 0x00FFFFFF) | 0x55000000), fill, total, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.c_bar, bar);
            v.setViewVisibility(R.id.c_bar, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.c_bar, View.GONE);
        }
        Row cur = null, nx = null, nxa = null;
        for (Row r : all(c, now)) {
            if (r.past) continue;
            if (r.s <= now) cur = r;
            else if (nx == null) nx = r;
            if (nxa == null && r.on && r.a > now) nxa = r;
        }
        if (cur == null && nx == null && sample) {
            for (Row r : sampleRows(now, 8)) { if (r.past) continue; if (r.s <= now) cur = r; else if (nx == null) nx = r; if (nxa == null) nxa = r; }
        }
        String dfmt = "EEE dd/MM";
        String nowTxt = folga ? "Próximo: " + new SimpleDateFormat(dfmt, new Locale("pt", "BR")).format(new Date(ss[1])) + " · " + hhmm(ss[1]) : cur != null ? "Agora: " + cur.p + " · " + cur.l.replace(":00", "") : (nx != null ? "Próximo: " + nx.p + " · " + nx.l.replace(":00", "") : "");
        String nextTxt = folga ? "em " + dur(ss[1] - now) : cur != null && nx != null ? "próx. " + nx.p + " " + hhmm(nx.s) : "";
        v.setTextViewText(R.id.c_now, nowTxt);
        v.setTextColor(R.id.c_now, t.accent);
        v.setTextViewText(R.id.c_next, nextTxt);
        v.setTextColor(R.id.c_next, t.muted);
        size(v, R.id.c_now, 14, f);
        size(v, R.id.c_next, 12, f);
        v.setViewVisibility(R.id.c_row, nowTxt.isEmpty() || h < 95 ? View.GONE : View.VISIBLE);
        String foot = folga ? (li[1] > 0 ? "Último plantão: " + new SimpleDateFormat(dfmt, new Locale("pt", "BR")).format(new Date(li[0])) + " · " + hhmm(li[0]) : "") : nxa != null ? "🔔 próximo alarme " + hhmm(nxa.a) + " · em " + dur(nxa.a - now) : "";
        v.setTextViewText(R.id.c_foot, foot);
        v.setTextColor(R.id.c_foot, t.muted);
        size(v, R.id.c_foot, 12, f);
        v.setViewVisibility(R.id.c_foot, foot.isEmpty() || (!folga && !g.alarm) || h < 120 ? View.GONE : View.VISIBLE);
        v.setOnClickPendingIntent(R.id.widget_root, act(c, id, 4, "quartos", cur != null ? cur : nx));
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
        Class<?>[] kinds = {PlantaoWidget.class, QuartosWidget.class, ProximoWidget.class, AlarmesWidget.class, CentralWidget.class};
        for (Class<?> k : kinds) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            for (int id : ids) updateOne(c, id);
        }
    }
}
