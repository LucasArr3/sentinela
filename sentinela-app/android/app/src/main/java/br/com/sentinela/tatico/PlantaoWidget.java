package br.com.sentinela.tatico;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Widget da tela inicial: status do plantão e próximo quarto. Lê o resumo guardado pela interface. */
public class PlantaoWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context));
    }

    static void refresh(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, PlantaoWidget.class));
        for (int id : ids) m.updateAppWidget(id, build(context));
    }

    private static String hhmm(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(ms));
    }

    private static String dur(long ms) {
        long min = Math.max(0, ms / 60000);
        long d = min / 1440, h = (min % 1440) / 60, m = min % 60;
        if (d > 0) return d + (d == 1 ? " dia" : " dias");
        if (h > 0) return h + "h " + String.format(Locale.getDefault(), "%02d", m) + "min";
        return m + " min";
    }

    static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_plantao);
        String status = "Abra o app";
        String sub = "Toque para atualizar a escala";
        String quarto = "";
        try {
            JSONObject j = new JSONObject(AlarmStore.widgetJson(c));
            long now = System.currentTimeMillis();
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
            } else if (next != null) {
                long s = next.optLong("s");
                status = "Plantão " + new SimpleDateFormat("EEE dd/MM", new Locale("pt", "BR")).format(new Date(s));
                sub = "Entrada " + hhmm(s) + " · em " + dur(s - now);
            }
            JSONArray qs = j.optJSONArray("quartos");
            if (qs != null) {
                for (int i = 0; i < qs.length(); i++) {
                    JSONObject o = qs.optJSONObject(i);
                    if (o == null || o.optLong("e") <= now) continue;
                    long s = o.optLong("s");
                    String p = o.optString("p", "");
                    quarto = "Quarto " + o.optString("l", "") + (p.isEmpty() ? "" : " · " + p) + (s <= now ? " · agora" : " · em " + dur(s - now));
                    break;
                }
            }
        } catch (Exception ignored) {
            // mantém os textos padrão
        }
        v.setTextViewText(R.id.w_status, status);
        v.setTextViewText(R.id.w_sub, sub);
        v.setTextViewText(R.id.w_quarto, quarto);
        v.setViewVisibility(R.id.w_quarto, quarto.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        PendingIntent pi = PendingIntent.getActivity(c, 7, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }
}
