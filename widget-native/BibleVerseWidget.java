package com.anonymous.bibleversewidget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;

public class BibleVerseWidget extends AppWidgetProvider {

    static final String PREFS = "bible_widget_prefs";
    static final String KEY_LANG = "language";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String lang = prefs.getString(KEY_LANG, "es");

        Verse verse = getVerseOfDay(context, lang);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_bible_verse);
        views.setTextViewText(R.id.widget_verse_text, verse.text);
        views.setTextViewText(R.id.widget_verse_ref, "— " + verse.ref);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    static Verse getVerseOfDay(Context context, String lang) {
        try {
            InputStream is = context.getAssets().open("verses.json");
            int size = is.available();
            byte[] buffer = new byte[size];
            is.read(buffer);
            is.close();
            String json = new String(buffer, StandardCharsets.UTF_8);

            JSONObject root = new JSONObject(json);
            JSONArray verses = root.getJSONArray("verses");

            Calendar now = Calendar.getInstance();
            // Rota el versículo cada hora: día del año * 24 + hora actual
            int dayOfYear = now.get(Calendar.DAY_OF_YEAR);
            int hour = now.get(Calendar.HOUR_OF_DAY);
            int slot = (dayOfYear - 1) * 24 + hour;
            JSONObject verse = verses.getJSONObject(slot % verses.length());

            String text = verse.optString(lang, verse.optString("es", ""));
            String ref = verse.getString("ref");
            return new Verse(text, ref);
        } catch (Exception e) {
            return new Verse("Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree no se pierda, mas tenga vida eterna.", "Juan 3:16");
        }
    }

    static class Verse {
        String text;
        String ref;

        Verse(String text, String ref) {
            this.text = text;
            this.ref = ref;
        }
    }
}
