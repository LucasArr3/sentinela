package br.com.sentinela.tatico;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import java.util.List;

/** Widget "Próximo quarto": horário, posto, alarme e contagem regressiva. */
public class ProximoWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) WidgetKit.updateOne(context, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) WidgetKit.forget(context, id);
    }

    static RemoteViews build(Context c, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_proximo);
        WidgetKit.Th t = WidgetKit.th(WidgetKit.theme(c, id));
        WidgetKit.style(v, c, id);
        long now = System.currentTimeMillis();
        List<WidgetKit.Row> rows = WidgetKit.rows(c, now, 1);
        v.setTextColor(R.id.w_tag, t.accent);
        v.setTextColor(R.id.p_hora, t.text);
        v.setTextColor(R.id.p_posto, t.text);
        v.setTextColor(R.id.p_alarme, t.muted);
        v.setTextColor(R.id.p_count, t.accent);
        if (rows.isEmpty()) {
            v.setTextViewText(R.id.w_tag, "PRÓXIMO QUARTO");
            v.setTextViewText(R.id.p_hora, "—");
            v.setTextViewText(R.id.p_posto, "Nenhum quarto marcado");
            v.setViewVisibility(R.id.p_alarme, View.GONE);
            v.setViewVisibility(R.id.p_count, View.GONE);
        } else {
            WidgetKit.Row r = rows.get(0);
            boolean agora = r.s <= now;
            v.setTextViewText(R.id.w_tag, agora ? "QUARTO AGORA" : "PRÓXIMO QUARTO");
            v.setTextViewText(R.id.p_hora, r.l);
            v.setTextViewText(R.id.p_posto, r.p);
            v.setViewVisibility(R.id.p_alarme, View.VISIBLE);
            v.setTextViewText(R.id.p_alarme, agora ? "termina às " + WidgetKit.hhmm(r.e) : (r.on ? "Alarme às " + WidgetKit.hhmm(r.a) : "Sem alarme"));
            long target = agora ? r.e : r.s;
            if (Build.VERSION.SDK_INT >= 24) {
                v.setViewVisibility(R.id.p_count, View.VISIBLE);
                v.setChronometerCountDown(R.id.p_count, true);
                v.setChronometer(R.id.p_count, SystemClock.elapsedRealtime() + (target - now), null, true);
            } else {
                v.setViewVisibility(R.id.p_count, View.GONE);
            }
        }
        PendingIntent pi = PendingIntent.getActivity(c, 9, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }
}
