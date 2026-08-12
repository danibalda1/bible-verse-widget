#!/bin/bash
# Re-aplica el widget Android tras un `npx expo prebuild`
# Fuente persistente: widget-native/  →  Destino: android/app/src/main/
cd "$(dirname "$0")/.."
SRC="widget-native"
DEST="android/app/src/main"

# 1. Código Java del widget + módulo de idioma
mkdir -p "$DEST/java/com/anonymous/bibleversewidget"
cp "$SRC/BibleVerseWidget.java" "$DEST/java/com/anonymous/bibleversewidget/"
cp "$SRC/BibleVerseWidgetSmall.java" "$DEST/java/com/anonymous/bibleversewidget/"
cp "$SRC/BibleVerseWidgetLarge.java" "$DEST/java/com/anonymous/bibleversewidget/"
cp "$SRC/WidgetConfigActivity.java" "$DEST/java/com/anonymous/bibleversewidget/"
cp "$SRC/WidgetLangModule.java" "$DEST/java/com/anonymous/bibleversewidget/"
cp "$SRC/WidgetLangPackage.java" "$DEST/java/com/anonymous/bibleversewidget/"

# 2. Layouts, XML de configuración y drawable
mkdir -p "$DEST/res/layout" "$DEST/res/xml" "$DEST/res/drawable"
cp "$SRC/widget_bible_verse.xml" "$DEST/res/layout/"
cp "$SRC/widget_bible_verse_small.xml" "$DEST/res/layout/"
cp "$SRC/widget_bible_verse_large.xml" "$DEST/res/layout/"
cp "$SRC/activity_widget_config.xml" "$DEST/res/layout/"
cp "$SRC/bible_verse_widget_info.xml" "$DEST/res/xml/"
cp "$SRC/bible_verse_widget_info_small.xml" "$DEST/res/xml/"
cp "$SRC/bible_verse_widget_info_large.xml" "$DEST/res/xml/"
cp "$SRC/widget_background.xml" "$DEST/res/drawable/"

# 3. Registro en AndroidManifest (receiver + activity config)
MANIFEST="$DEST/AndroidManifest.xml"
if ! grep -q "BibleVerseWidget" "$MANIFEST"; then
  sed -i 's|</application>|    <!-- Widget Versículo del Día (mediano) -->\n    <receiver android:name=".BibleVerseWidget" android:exported="true" android:label="@string/app_name">\n      <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter>\n      <meta-data android:name="android.appwidget.provider" android:resource="@xml/bible_verse_widget_info"/>\n    </receiver>\n    <!-- Widget Versículo del Día (pequeño) -->\n    <receiver android:name=".BibleVerseWidgetSmall" android:exported="true" android:label="@string/widget_name_small">\n      <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter>\n      <meta-data android:name="android.appwidget.provider" android:resource="@xml/bible_verse_widget_info_small"/>\n    </receiver>\n    <!-- Widget Versículo del Día (grande) -->\n    <receiver android:name=".BibleVerseWidgetLarge" android:exported="true" android:label="@string/widget_name_large">\n      <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter>\n      <meta-data android:name="android.appwidget.provider" android:resource="@xml/bible_verse_widget_info_large"/>\n    </receiver>\n    <activity android:name=".WidgetConfigActivity" android:exported="false" android:theme="@style/Theme.App.SplashScreen"></activity>\n  </application>|' "$MANIFEST"
fi

# 4. strings.xml (descripción del widget)
STRINGS="$DEST/res/values/strings.xml"
if ! grep -q "widget_description" "$STRINGS"; then
  sed -i 's|</resources>|<string name="widget_description">Versículo bíblico del día en tu pantalla</string>\n<string name="widget_name_small">Versículo Mini</string>\n<string name="widget_description_small">Versículo bíblico compacto</string>\n<string name="widget_name_large">Versículo Grande</string>\n<string name="widget_description_large">Versículo bíblico con referencia</string>\n</resources>|' "$STRINGS"
fi

# 5. MainApplication.kt: registrar WidgetLangPackage
MAINAPP="$DEST/java/com/anonymous/bibleversewidget/MainApplication.kt"
if ! grep -q "WidgetLangPackage" "$MAINAPP"; then
  sed -i 's|// add(MyReactNativePackage())|// add(MyReactNativePackage())\n          add(WidgetLangPackage())|' "$MAINAPP"
fi

# 6. verses.json en assets
mkdir -p "$DEST/assets"
cp verses.json "$DEST/assets/"

echo "✅ Widget re-aplicado tras prebuild"
