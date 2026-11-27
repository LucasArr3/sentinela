package br.com.sentinela.tatico;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

/** Tela de configuração do widget: transparência e tema. Abre ao adicionar e ao reconfigurar. */
public class WidgetConfigActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private int alphaPct = 88;
    private String theme = "escuro";
    private TextView pct;
    private TextView box;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setResult(RESULT_CANCELED);
        Intent in = getIntent();
        if (in != null && in.getExtras() != null) {
            widgetId = in.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        alphaPct = WidgetKit.alpha(this, widgetId);
        theme = WidgetKit.theme(this, widgetId);
        final float d = getResources().getDisplayMetrics().density;

        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(Color.parseColor("#0B0B0D"));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int p = (int) (22 * d);
        root.setPadding(p, (int) (44 * d), p, p);
        sv.addView(root);

        TextView title = text("Configurar widget", 22, "#F0F0F4", true);
        root.addView(title);
        root.addView(text("Escolha a transparência e as cores. Você pode mudar depois segurando o widget.", 13, "#9A9AA3", false));

        FrameLayout wall = new FrameLayout(this);
        GradientDrawable wg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{Color.parseColor("#3B2A6B"), Color.parseColor("#0E6B6B")});
        wg.setCornerRadius(18 * d);
        wall.setBackground(wg);
        LinearLayout.LayoutParams wl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) (130 * d));
        wl.topMargin = (int) (18 * d);
        root.addView(wall, wl);
        box = new TextView(this);
        box.setGravity(Gravity.CENTER_VERTICAL);
        box.setPadding((int) (16 * d), 0, (int) (16 * d), 0);
        box.setText("EM SERVIÇO\nTermina às 07:00\n18:00–20:00  ·  G2");
        box.setTextSize(15);
        FrameLayout.LayoutParams bl = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, (int) (96 * d));
        bl.gravity = Gravity.CENTER;
        bl.leftMargin = (int) (16 * d);
        bl.rightMargin = (int) (16 * d);
        wall.addView(box, bl);

        pct = text("", 15, "#F0F0F4", true);
        LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        pl.topMargin = (int) (22 * d);
        root.addView(pct, pl);
        SeekBar sb = new SeekBar(this);
        sb.setMax(100);
        sb.setProgress(100 - alphaPct);
        sb.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar s, int v, boolean user) {
                alphaPct = 100 - v;
                refresh();
            }

            @Override
            public void onStartTrackingTouch(SeekBar s) {}

            @Override
            public void onStopTrackingTouch(SeekBar s) {}
        });
        root.addView(sb);

        TextView tl = text("Tema", 15, "#F0F0F4", true);
        LinearLayout.LayoutParams tll = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tll.topMargin = (int) (18 * d);
        root.addView(tl, tll);
        RadioGroup rg = new RadioGroup(this);
        rg.setOrientation(RadioGroup.VERTICAL);
        final String[] keys = {"escuro", "claro", "azul"};
        String[] names = {"Escuro", "Claro", "Azul"};
        for (int i = 0; i < keys.length; i++) {
            RadioButton rb = new RadioButton(this);
            rb.setText(names[i]);
            rb.setTextColor(Color.parseColor("#F0F0F4"));
            rb.setId(View.generateViewId());
            rb.setTag(keys[i]);
            rg.addView(rb);
            if (keys[i].equals(theme)) rb.setChecked(true);
        }
        rg.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup g, int checkedId) {
                View rb = g.findViewById(checkedId);
                if (rb != null && rb.getTag() != null) theme = String.valueOf(rb.getTag());
                refresh();
            }
        });
        root.addView(rg);

        Button ok = new Button(this);
        ok.setText("Salvar");
        ok.setAllCaps(false);
        ok.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                save();
            }
        });
        LinearLayout.LayoutParams ol = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) (52 * d));
        ol.topMargin = (int) (24 * d);
        root.addView(ok, ol);
        setContentView(sv);
        refresh();
    }

    private TextView text(String s, int sp, String color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(Color.parseColor(color));
        if (bold) t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        return t;
    }

    private void refresh() {
        WidgetKit.Th t = WidgetKit.th(theme);
        pct.setText("Transparência: " + (100 - alphaPct) + "%");
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(20 * getResources().getDisplayMetrics().density);
        g.setColor(t.bg);
        g.setAlpha(Math.round(alphaPct * 2.55f));
        box.setBackground(g);
        box.setTextColor(t.text);
    }

    private void save() {
        WidgetKit.save(this, widgetId, alphaPct, theme);
        WidgetKit.updateOne(this, widgetId);
        Intent r = new Intent();
        r.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, r);
        finish();
    }
}
