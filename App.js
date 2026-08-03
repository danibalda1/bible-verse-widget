import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Share,
} from 'react-native';
import versesData from './verses.json';

const LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

export default function App() {
  const [lang, setLang] = useState('es');
  const [verse, setVerse] = useState(null);
  const [dayOfYear, setDayOfYear] = useState(0);

  // Versículo del día basado en el día del año (estable, no cambia en el día)
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const day = Math.floor(diff / (1000 * 60 * 60 * 24));
    setDayOfYear(day);
    pickVerse(day);
  }, []);

  const pickVerse = (day) => {
    const verses = versesData.verses;
    const idx = day % verses.length;
    setVerse(verses[idx]);
  };

  const nextVerse = () => {
    const verses = versesData.verses;
    const idx = (verses.indexOf(verse) + 1) % verses.length;
    setVerse(verses[idx]);
  };

  const shareVerse = () => {
    if (!verse) return;
    const text = `"${verse[lang]}"\n\n— ${verse.ref}\n\n📖 Versículo del día`;
    Share.share({ message: text });
  };

  const currentLang = LANGUAGES.find((l) => l.code === lang);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>📖 Versículo del Día</Text>
        <Text style={styles.subtitle}>Tu palabra es lámpara a mis pies</Text>
      </View>

      {/* Language selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.langBar}
        contentContainerStyle={styles.langBarContent}
      >
        {LANGUAGES.map((l) => (
          <TouchableOpacity
            key={l.code}
            style={[styles.langChip, lang === l.code && styles.langChipActive]}
            onPress={() => setLang(l.code)}
          >
            <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
              {l.flag} {l.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Verse card */}
      {verse && (
        <View style={styles.card}>
          <Text style={styles.verseText}>{verse[lang]}</Text>
          <Text style={styles.verseRef}>— {verse.ref}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={nextVerse}>
              <Text style={styles.btnSecondaryText}>🔄 Otro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={shareVerse}>
              <Text style={styles.btnPrimaryText}>📤 Compartir</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.footer}>
        Día {dayOfYear} de {new Date().getFullYear()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: '#a0a0c0',
    fontSize: 13,
    marginTop: 4,
  },
  langBar: {
    marginBottom: 20,
  },
  langBarContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a4a',
  },
  langChipActive: {
    backgroundColor: '#e94560',
  },
  langText: {
    color: '#a0a0c0',
    fontSize: 13,
  },
  langTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    padding: 28,
    flex: 1,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  verseText: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 34,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  verseRef: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 30,
  },
  btnSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2a2a4a',
  },
  btnSecondaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e94560',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
  },
});
