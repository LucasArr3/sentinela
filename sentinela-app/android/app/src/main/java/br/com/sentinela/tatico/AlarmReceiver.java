package br.com.sentinela.tatico;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

/** Recebe o disparo do AlarmManager e liga o serviço que toca o alarme. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent svc = new Intent(context, AlarmService.class).setAction(AlarmService.ACTION_START);
        if (intent.getExtras() != null) svc.putExtras(intent.getExtras());
        try {
            ContextCompat.startForegroundService(context, svc);
        } catch (Exception e) {
            AlarmService.postFallback(context, intent.getExtras());
        }
    }
}
