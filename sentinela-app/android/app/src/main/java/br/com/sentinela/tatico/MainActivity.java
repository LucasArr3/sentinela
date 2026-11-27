package br.com.sentinela.tatico;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SentinelaAlarmPlugin.class);
        super.onCreate(savedInstanceState);
        grab(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        grab(intent);
    }

    /** Toque no widget: guarda o pedido para o app abrir direto no quarto/alarme. */
    private void grab(Intent i) {
        if (i == null || !i.hasExtra("open")) return;
        SentinelaAlarmPlugin.setPending(i.getStringExtra("open"), i.getStringExtra("date"), i.getIntExtra("qi", -1));
        i.removeExtra("open");
    }
}
