package br.com.sentinela.tatico;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class PlantaoWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) WidgetKit.updateOne(context, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        WidgetKit.updateOne(context, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) WidgetKit.forget(context, id);
    }

    static void refresh(Context context) {
        WidgetKit.refreshAll(context);
    }
}
