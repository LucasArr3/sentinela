package br.com.sentinela.tatico;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;

/** Configuração do widget: prévia real sobre o papel de parede, opacidade, cores, texto e cantos. */
public class WidgetConfigActivity extends Activity {
    private interface Pick { void on(int i); }

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private WidgetKit.Cfg cfg;
    private String kind;
    private int wDp, hDp;
    private float d;
    private FrameLayout prev;
    private TextView pct;
    private LinearLayout themeRow, accentRow, textRow, cornerRow;

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
        d = getResources().getDisplayMetrics().density;
        cfg = WidgetKit.cfg(this, widgetId);
        kind = WidgetKit.kindOf(this, widgetId);
        int[] sz = WidgetKit.size(this, widgetId, kind);
        wDp = sz[0];
        hDp = sz[1];

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);

        TextView title = text("Configurações do widget", 20, "#FFFFFF", true);
        title.setShadowLayer(6, 0, 2, Color.parseColor("#99000000"));
        title.setPadding((int) (24 * d), (int) (44 * d), (int) (24 * d), (int) (6 * d));
        page.addView(title);

        // prévia: o widget de verdade, no tamanho atual, sobre o papel de parede do sistema
        FrameLayout stage = new FrameLayout(this);
        prev = new FrameLayout(this);
        int maxW = getResources().getDisplayMetrics().widthPixels - (int) (32 * d);
        int pw = Math.min((int) (wDp * d), maxW);
        int ph = (int) (Math.min(hDp, 300) * d);
        FrameLayout.LayoutParams pl = new FrameLayout.LayoutParams(pw, ph);
        pl.gravity = Gravity.CENTER;
        stage.addView(prev, pl);
        page.addView(stage, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        // painel de opções
        ScrollView sv = new ScrollView(this);
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        int p = (int) (20 * d);
        panel.setPadding(p, p, p, p);
        GradientDrawable pg = new GradientDrawable();
        pg.setColor(Color.parseColor("#F2121214"));
        pg.setCornerRadii(new float[]{28 * d, 28 * d, 28 * d, 28 * d, 0, 0, 0, 0});
        sv.setBackground(pg);
        sv.addView(panel);
        page.addView(sv, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) (getResources().getDisplayMetrics().heightPixels * 0.5f)));

        pct = label("");
        panel.addView(pct);
        SeekBar sb = new SeekBar(this);
        sb.setMax(100);
        sb.setProgress(100 - cfg.alpha);
        sb.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar s, int v, boolean user) {
                cfg.alpha = 100 - v;
                redraw();
            }

            @Override
            public void onStartTrackingTouch(SeekBar s) {}

            @Override
            public void onStopTrackingTouch(SeekBar s) {}
        });
        panel.addView(sb);

        panel.addView(label("Cor do fundo"));
        themeRow = seg(WidgetKit.THEME_NAMES, indexOf(WidgetKit.THEMES, cfg.theme), new Pick() {
            @Override
            public void on(int i) {
                cfg.theme = WidgetKit.THEMES[i];
                redraw();
            }
        });
        panel.addView(themeRow);

        panel.addView(label("Cor de destaque"));
        accentRow = swatches();
        panel.addView(accentRow);

        panel.addView(label("Tamanho do texto"));
        textRow = seg(new String[]{"Pequeno", "Normal", "Grande"}, cfg.text, new Pick() {
            @Override
            public void on(int i) {
                cfg.text = i;
                redraw();
            }
        });
        panel.addView(textRow);

        panel.addView(label("Cantos"));
        cornerRow = seg(new String[]{"Retos", "Médios", "Redondos"}, cfg.corner, new Pick() {
            @Override
            public void on(int i) {
                cfg.corner = i;
                redraw();
            }
        });
        panel.addView(cornerRow);

        {
            Switch sw = new Switch(this);
            sw.setText("Mostrar horário do alarme");
            sw.setTextColor(Color.parseColor("#F0F0F4"));
            sw.setTextSize(15);
            sw.setChecked(cfg.alarm);
            sw.setOnCheckedChangeListener(new android.widget.CompoundButton.OnCheckedChangeListener() {
                @Override
                public void onCheckedChanged(android.widget.CompoundButton v, boolean on) {
                    cfg.alarm = on;
                    redraw();
                }
            });
            LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) (52 * d));
            sl.topMargin = (int) (14 * d);
            panel.addView(sw, sl);
        }

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        TextView no = button("Cancelar", false);
        no.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        TextView ok = button("Salvar", true);
        ok.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                save();
            }
        });
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(0, (int) (50 * d), 1f);
        bp.rightMargin = (int) (6 * d);
        bar.addView(no, bp);
        LinearLayout.LayoutParams bp2 = new LinearLayout.LayoutParams(0, (int) (50 * d), 1f);
        bp2.leftMargin = (int) (6 * d);
        bar.addView(ok, bp2);
        LinearLayout.LayoutParams barl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        barl.topMargin = (int) (20 * d);
        panel.addView(bar, barl);

        setContentView(page);
        redraw();
    }

    private int indexOf(String[] a, String v) {
        for (int i = 0; i < a.length; i++) if (a[i].equals(v)) return i;
        return 1;
    }

    private TextView text(String s, int sp, String color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(Color.parseColor(color));
        if (bold) t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        return t;
    }

    private TextView label(String s) {
        TextView t = text(s, 14, "#F0F0F4", true);
        t.setPadding(0, (int) (16 * d), 0, (int) (6 * d));
        return t;
    }

    private TextView button(String s, boolean primary) {
        TextView t = text(s, 15, primary ? "#111113" : "#F0F0F4", true);
        t.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(26 * d);
        g.setColor(Color.parseColor(primary ? "#F5A524" : "#2A2A30"));
        t.setBackground(g);
        return t;
    }

    /** Linha de opções (uma marcada). */
    private LinearLayout seg(String[] names, int sel, final Pick cb) {
        final LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        for (int i = 0; i < names.length; i++) {
            final int idx = i;
            TextView t = text(names[i], 13, "#F0F0F4", true);
            t.setGravity(Gravity.CENTER);
            t.setSingleLine(true);
            t.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    mark(row, idx);
                    cb.on(idx);
                }
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, (int) (40 * d), 1f);
            lp.rightMargin = i < names.length - 1 ? (int) (6 * d) : 0;
            row.addView(t, lp);
        }
        mark(row, sel);
        return row;
    }

    private void mark(LinearLayout row, int sel) {
        for (int i = 0; i < row.getChildCount(); i++) {
            TextView t = (TextView) row.getChildAt(i);
            GradientDrawable g = new GradientDrawable();
            g.setCornerRadius(20 * d);
            g.setColor(Color.parseColor(i == sel ? "#F5A524" : "#2A2A30"));
            t.setBackground(g);
            t.setTextColor(Color.parseColor(i == sel ? "#111113" : "#F0F0F4"));
        }
    }

    private LinearLayout swatches() {
        final LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        final String[] hex = {"#FFFFFF", "#F5A524", "#38BDF8", "#22C55E", "#F472B6", "#EF4444"};
        for (int i = 0; i < hex.length; i++) {
            final int idx = i;
            TextView t = text(i == 0 ? "Auto" : "", 11, "#111113", true);
            t.setGravity(Gravity.CENTER);
            t.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    cfg.accent = WidgetKit.ACCENTS[idx];
                    markSw(row);
                    redraw();
                }
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams((int) (42 * d), (int) (42 * d));
            lp.rightMargin = (int) (10 * d);
            row.addView(t, lp);
            t.setTag(hex[i]);
        }
        markSw(row);
        return row;
    }

    private void markSw(LinearLayout row) {
        for (int i = 0; i < row.getChildCount(); i++) {
            View v = row.getChildAt(i);
            GradientDrawable g = new GradientDrawable();
            g.setShape(GradientDrawable.OVAL);
            g.setColor(Color.parseColor(String.valueOf(v.getTag())));
            boolean on = WidgetKit.ACCENTS[i].equals(cfg.accent);
            g.setStroke((int) ((on ? 3 : 1) * d), Color.parseColor(on ? "#FFFFFF" : "#55FFFFFF"));
            v.setBackground(g);
        }
    }

    private void redraw() {
        pct.setText("Opacidade do fundo: " + cfg.alpha + "%");
        prev.removeAllViews();
        android.widget.RemoteViews rv = WidgetKit.build(this, widgetId, kind, cfg, wDp, hDp, true);
        View v = rv.apply(this, prev);
        prev.addView(v, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private void save() {
        WidgetKit.save(this, widgetId, cfg);
        WidgetKit.updateOne(this, widgetId);
        Intent r = new Intent();
        r.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, r);
        finish();
    }
}
