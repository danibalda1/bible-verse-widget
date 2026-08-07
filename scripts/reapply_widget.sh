#!/bin/bash
# Re-aplica el widget Android tras un `npx expo prebuild`
# Fuente persistente: widget-native/  →  Destino: android/app/src/main/
cd "$(dirname "$0")/.."
SRC="widget-native"
DEST="android/app/src/main"

# 1. Código Java del widget + módulo de idioma
mkdir -p "$DEST/java/com/anonymous/bibleversewidget"
cp "$SRC/BibleVerseWidget.java" "$DEST/java/com/anonymous/bibleversewidget/"
cp "$SRC/WidgetConfigActivity.java" "$DEST/java/com/anonymous/bibleversewidget/"
cp "$SRC/WidgetLangModule.java" "$DEST/java/com/anonymous/bibleversewidget/"
cp "$SRC/WidgetLangPackage.java" "$DEST/java/com/anonymous/bibleversewidget/"

# 2. Layouts, XML de configuración y drawable
mkdir -p "$DEST/res/layout" "$DEST/res/xml" "$DEST/res/drawable"
cp "$SRC/widget_bible_verse.xml" "$DEST/res/layout/"
cp "$SRC/activity_widget_config.xml" "$DEST/res/layout/"
cp "$SRC/bible_verse_widget_info.xml" "$DEST/res/xml/"
cp "$SRC/widget_background.xml" "$DEST/res/drawable/"

# 3. Registro en AndroidManifest (receiver + activity config)
MANIFEST="$DEST/AndroidManifest.xml"
if ! grep -q "BibleVerseWidget" "$MANIFEST"; then
  sed -i 's|</application>|    <!-- Widget Versículo del Día -->\n    <receiver android:name=".BibleVerseWidget" android:exported="true" android:label="@string/app_name">\n      <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter>\n      <meta-data android:name="android.appwidget.provider" android:resource="@xml/bible_verse_widget_info"/>\n    </receiver>\n    <activity android:name=".WidgetConfigActivity" android:exported="false" android:theme="@style/Theme.App.SplashScreen"></activity>\n  </application>|' "$MANIFEST"
fi

# 4. strings.xml (descripción del widget)
STRINGS="$DEST/res/values/strings.xml"
if ! grep -q "widget_description" "$STRINGS"; then
  sed -i 's|</resources>|<string name="widget_description">Versículo bíblico del día en tu pantalla</string>\n</resources>|' "$STRINGS"
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
