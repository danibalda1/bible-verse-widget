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

    // Abre el diálogo del sistema para fijar el widget en la pantalla de inicio
    // (requestPinAppWidget: API 21+, funciona en la mayoría de launchers)
    @ReactMethod
    public void requestPinWidget() {
        Context context = getReactApplicationContext();
        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName widgetComponent = new ComponentName(context, BibleVerseWidget.class);
            boolean supported = appWidgetManager.isRequestPinAppWidgetSupported();
            if (supported) {
                appWidgetManager.requestPinAppWidget(widgetComponent, null, null);
            }
        } catch (Exception e) {
            // Launcher sin soporte -> el usuario tendrá que añadirlo manualmente
        }
    }
}
