package br.com.sentinela.tatico;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Widget "Plantão": status do plantão e próximo quarto. */
public class PlantaoWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) WidgetKit.updateOne(context, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) WidgetKit.forget(context, id);
    }

    static void refresh(Context context) {
        WidgetKit.refreshAll(context);
    }

    static RemoteViews build(Context c, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_plantao);
        WidgetKit.Th t = WidgetKit.th(WidgetKit.theme(c, id));
        WidgetKit.style(v, c, id);
        String status = "Abra o app";
        String sub = "Toque para atualizar a escala";
        String quarto = "";
        long now = System.currentTimeMillis();
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
                sub = "Termina às " + WidgetKit.hhmm(e) + " · faltam " + WidgetKit.dur(e - now);
            } else if (next != null) {
                long s = next.optLong("s");
                status = "Plantão " + new SimpleDateFormat("EEE dd/MM", new Locale("pt", "BR")).format(new Date(s));
                sub = "Entrada " + WidgetKit.hhmm(s) + " · em " + WidgetKit.dur(s - now);
            }
        } catch (Exception ignored) {
            // mantém os textos padrão
        }
        List<WidgetKit.Row> rows = WidgetKit.rows(c, now, 1);
        if (!rows.isEmpty()) {
            WidgetKit.Row r = rows.get(0);
            quarto = r.l + " · " + r.p + (r.s <= now ? " · agora" : " · alarme " + WidgetKit.hhmm(r.a));
        }
        v.setTextViewText(R.id.w_tag, "SENTINELA TÁTICO");
        v.setTextColor(R.id.w_tag, t.muted);
        v.setTextViewText(R.id.w_status, status);
        v.setTextColor(R.id.w_status, t.text);
        v.setTextViewText(R.id.w_sub, sub);
        v.setTextColor(R.id.w_sub, t.muted);
        v.setTextViewText(R.id.w_quarto, quarto);
        v.setTextColor(R.id.w_quarto, t.accent);
        v.setViewVisibility(R.id.w_quarto, quarto.isEmpty() ? View.GONE : View.VISIBLE);
        PendingIntent pi = PendingIntent.getActivity(c, 7, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }
}
