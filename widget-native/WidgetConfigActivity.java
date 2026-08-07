package com.anonymous.bibleversewidget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.RadioGroup;
import android.widget.Toast;

public class WidgetConfigActivity extends Activity {

    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_widget_config);

        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            );
        }

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        SharedPreferences prefs = getSharedPreferences(BibleVerseWidget.PREFS, Context.MODE_PRIVATE);
        String currentLang = prefs.getString(BibleVerseWidget.KEY_LANG, "es");
        RadioGroup radioGroup = findViewById(R.id.lang_group);

        switch (currentLang) {
            case "en": radioGroup.check(R.id.lang_en); break;
            case "pt": radioGroup.check(R.id.lang_pt); break;
            case "fr": radioGroup.check(R.id.lang_fr); break;
            case "it": radioGroup.check(R.id.lang_it); break;
            default: radioGroup.check(R.id.lang_es); break;
        }

        Button saveBtn = findViewById(R.id.save_lang_btn);
        saveBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                int checkedId = radioGroup.getCheckedRadioButtonId();
                String lang;
                if (checkedId == R.id.lang_en) lang = "en";
                else if (checkedId == R.id.lang_pt) lang = "pt";
                else if (checkedId == R.id.lang_fr) lang = "fr";
                else if (checkedId == R.id.lang_it) lang = "it";
                else lang = "es";

                prefs.edit().putString(BibleVerseWidget.KEY_LANG, lang).apply();

                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(WidgetConfigActivity.this);
                BibleVerseWidget.updateWidget(WidgetConfigActivity.this, appWidgetManager, appWidgetId);

                Toast.makeText(WidgetConfigActivity.this, "Idioma: " + lang.toUpperCase(), Toast.LENGTH_SHORT).show();

                Intent result = new Intent();
                result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
                setResult(RESULT_OK, result);
                finish();
            }
        });
    }
}
