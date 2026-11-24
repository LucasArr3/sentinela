package br.com.sentinela.tatico;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SentinelaAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
