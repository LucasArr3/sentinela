package br.com.sentinela.tatico;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import java.util.List;

/** Widget "Quartos de hora": lista dos próximos quartos com o horário do alarme. */
public class QuartosWidget extends AppWidgetProvider {
    private static final int[] ROW = {R.id.qr1, R.id.qr2, R.id.qr3, R.id.qr4};
    private static final int[] T = {R.id.qr1_t, R.id.qr2_t, R.id.qr3_t, R.id.qr4_t};
    private static final int[] P = {R.id.qr1_p, R.id.qr2_p, R.id.qr3_p, R.id.qr4_p};
    private static final int[] A = {R.id.qr1_a, R.id.qr2_a, R.id.qr3_a, R.id.qr4_a};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) WidgetKit.updateOne(context, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) WidgetKit.forget(context, id);
    }

    static RemoteViews build(Context c, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quartos);
        WidgetKit.Th t = WidgetKit.th(WidgetKit.theme(c, id));
        WidgetKit.style(v, c, id);
        long now = System.currentTimeMillis();
        List<WidgetKit.Row> rows = WidgetKit.rows(c, now, 4);
        v.setTextViewText(R.id.w_tag, "QUARTOS DE HORA");
        v.setTextColor(R.id.w_tag, t.muted);
        v.setTextViewText(R.id.w_vazio, "Nenhum quarto marcado");
        v.setTextColor(R.id.w_vazio, t.muted);
        v.setViewVisibility(R.id.w_vazio, rows.isEmpty() ? View.VISIBLE : View.GONE);
        for (int i = 0; i < 4; i++) {
            if (i >= rows.size()) {
                v.setViewVisibility(ROW[i], View.GONE);
                continue;
            }
            WidgetKit.Row r = rows.get(i);
            boolean first = i == 0;
            int main = first ? t.accent : t.text;
            v.setViewVisibility(ROW[i], View.VISIBLE);
            v.setTextViewText(T[i], r.l);
            v.setTextViewText(P[i], r.p);
            v.setTextViewText(A[i], r.on ? "🔔 " + WidgetKit.hhmm(r.a) : "sem alarme");
            v.setTextColor(T[i], first ? t.accent : t.muted);
            v.setTextColor(P[i], main);
            v.setTextColor(A[i], first ? t.accent : t.muted);
        }
        PendingIntent pi = PendingIntent.getActivity(c, 8, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }
}
