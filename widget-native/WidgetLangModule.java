package com.anonymous.bibleversewidget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class WidgetLangModule extends ReactContextBaseJavaModule {

    public WidgetLangModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "WidgetLang";
    }

    @ReactMethod
    public void setLang(String lang) {
        Context context = getReactApplicationContext();

        SharedPreferences prefs = context.getSharedPreferences(BibleVerseWidget.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(BibleVerseWidget.KEY_LANG, lang).apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName widgetComponent = new ComponentName(context, BibleVerseWidget.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(widgetComponent);
        if (appWidgetIds != null && appWidgetIds.length > 0) {
            for (int appWidgetId : appWidgetIds) {
                BibleVerseWidget.updateWidget(context, appWidgetManager, appWidgetId);
            }
        }
    }
}
