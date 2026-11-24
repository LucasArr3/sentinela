package br.com.sentinela.tatico;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Só existe no build de depuração. Agenda um alarme de teste: adb shell am broadcast -a ...DEBUG_ALARM --ei sec 8 */
public class DebugTriggerReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int sec = intent.getIntExtra("sec", 8);
        String sound = intent.getStringExtra("sound");
        AlarmScheduler.scheduleOne(context, 900002, System.currentTimeMillis() + sec * 1000L,
                "Alarme de teste (CI)", "Posto: Portaria", sound == null ? "sirene_lamento" : sound);
    }
}
