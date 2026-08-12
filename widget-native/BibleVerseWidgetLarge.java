package com.anonymous.bibleversewidget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

public class BibleVerseWidgetLarge extends BibleVerseWidget {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidgetLarge(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateWidgetLarge(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String lang = prefs.getString(KEY_LANG, "es");
        Verse verse = getVerseOfDay(context, lang);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_bible_verse_large);
        views.setTextViewText(R.id.widget_verse_text_large, verse.text);
        views.setTextViewText(R.id.widget_verse_ref_large, "— " + verse.ref);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
