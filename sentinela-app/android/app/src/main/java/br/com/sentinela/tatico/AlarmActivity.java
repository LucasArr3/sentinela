package br.com.sentinela.tatico;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

/** Tela de alarme: aparece sobre a tela bloqueada, com botões grandes para desligar ou adiar. */
public class AlarmActivity extends Activity {
    private BroadcastReceiver stopped;
    private TextView titleView;
    private TextView bodyView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        int pad = dp(24);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#050505"));
        root.setPadding(pad, dp(48), pad, dp(36));

        // parte de cima: hora e do que se trata
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.VERTICAL);
        top.setGravity(Gravity.CENTER);

        android.widget.TextClock clock = new android.widget.TextClock(this);
        clock.setFormat24Hour("HH:mm");
        clock.setFormat12Hour("HH:mm");
        clock.setTextColor(Color.WHITE);
        clock.setTextSize(72);
        clock.setTypeface(Typeface.DEFAULT_BOLD);
        clock.setGravity(Gravity.CENTER);

        titleView = new TextView(this);
        titleView.setTextColor(Color.parseColor("#F5A524"));
        titleView.setTextSize(22);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleView.setGravity(Gravity.CENTER);
        titleView.setPadding(0, dp(8), 0, dp(4));

        bodyView = new TextView(this);
        bodyView.setTextColor(Color.parseColor("#9A9AA3"));
        bodyView.setTextSize(16);
        bodyView.setGravity(Gravity.CENTER);

        top.addView(clock);
        top.addView(titleView);
        top.addView(bodyView);
        root.addView(top, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        // parte de baixo (alcance do polegar): desligar e soneca
        Button stop = button("Desligar", Color.parseColor("#F5A524"), Color.parseColor("#0A0A0A"), true);
        stop.setOnClickListener(v -> send(AlarmService.ACTION_STOP));
        Button snooze = button("Soneca " + AlarmStore.snoozeMin(this) + " min", Color.TRANSPARENT, Color.parseColor("#E8E8EA"), false);
        snooze.setOnClickListener(v -> send(AlarmService.ACTION_SNOOZE));
        root.addView(stop, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(84)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56));
        lp.topMargin = dp(12);
        root.addView(snooze, lp);
        setContentView(root);
        fill(getIntent());

        stopped = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                finish();
            }
        };
        ContextCompat.registerReceiver(this, stopped, new IntentFilter(AlarmService.ACTION_STOPPED), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        fill(intent);
    }

    private void fill(Intent i) {
        String t = i != null ? i.getStringExtra(AlarmScheduler.EXTRA_TITLE) : null;
        String b = i != null ? i.getStringExtra(AlarmScheduler.EXTRA_BODY) : null;
        titleView.setText(t == null ? "Alarme" : t);
        bodyView.setText(b == null ? "" : b);
    }

    private void send(String action) {
        startService(new Intent(this, AlarmService.class).setAction(action));
        finish();
    }

    private Button button(String text, int bg, int fg, boolean filled) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(fg);
        b.setTextSize(filled ? 24 : 16);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setAllCaps(false);
        GradientDrawable d = new GradientDrawable();
        d.setCornerRadius(dp(42));
        d.setColor(bg);
        if (!filled) d.setStroke(dp(2), Color.parseColor("#4A4A50"));
        b.setBackground(d);
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        if (stopped != null) unregisterReceiver(stopped);
        super.onDestroy();
    }
}
