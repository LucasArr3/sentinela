package br.com.sentinela.tatico;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Reagenda os alarmes depois de reiniciar, atualizar o app ou mudar a hora/fuso. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        AlarmScheduler.scheduleAll(context);
    }
}
