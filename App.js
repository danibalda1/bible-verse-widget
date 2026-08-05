import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { NativeModules } from 'react-native';
import versesData from './verses.json';

// Configuración de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

const THEMES = [
  { code: 'fe', name: 'Fe', icon: '✝️' },
  { code: 'esperanza', name: 'Esperanza', icon: '🕊️' },
  { code: 'amor', name: 'Amor', icon: '❤️' },
  { code: 'fortaleza', name: 'Fortaleza', icon: '💪' },
  { code: 'sabiduria', name: 'Sabiduría', icon: '📖' },
  { code: 'alegria', name: 'Alegría', icon: '😊' },
  { code: 'gracia', name: 'Gracia', icon: '🌟' },
  { code: 'libertad', name: 'Libertad', icon: '🕊️' },
  { code: 'justicia', name: 'Justicia', icon: '⚖️' },
];

const TABS = [
  { code: 'dia', name: 'De hoy', icon: '📅' },
  { code: 'consejo', name: 'Consejo', icon: '💡' },
  { code: 'guia', name: 'Guía', icon: '📚' },
  { code: 'oraciones', name: 'Oraciones', icon: '🙏' },
  { code: 'mandamientos', name: 'Los 10', icon: '📜' },
  { code: 'sacramentos', name: 'Sacramentos', icon: '⛪' },
];

// Configuración FREE vs PREMIUM
const FREE_LIMITS = {
  temas: 2,            // Fe + Amor gratis
  consejos: 30,        // solo 30 consejos en gratis
  oraciones: 2,        // Padre Nuestro + Ave María
  librosGuia: 5,       // solo 5 resúmenes de libros
  planes: 1,           // solo 1 plan
  idiomasWidget: ['es'], // widget solo español en gratis
  conAnuncios: true,
};

export default function App() {
  const [lang, setLang] = useState('es');
  const [theme, setTheme] = useState('fe');
  const [tab, setTab] = useState('dia');
  const [verse, setVerse] = useState(null);
  const [dayOfYear, setDayOfYear] = useState(0);
  const [isPremium, setIsPremium] = useState(false);

  // Versículo del día basado en el día del año
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const day = Math.floor(diff / (1000 * 60 * 60 * 24));
    setDayOfYear(day);
    pickVerse(day);
    scheduleDailyNotification();
  }, []);

  // Programar notificación diaria (8:00) con versículo y consejo
  const scheduleDailyNotification = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Notifications.cancelAllScheduledNotificationsAsync();

      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const day = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      const verses = versesData.verses;
      const todayVerse = verses[day % verses.length];
      const consejos = versesData.consejos || [];
      const consejo = consejos.length > 0 ? consejos[day % consejos.length] : '';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 Versículo del Día',
          body: `"${todayVerse.es}" — ${todayVerse.ref}${consejo ? `\n💡 ${consejo}` : ''}`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 0,
        },
      });
    } catch (e) {
      console.log('Notificación no programada:', e.message);
    }
  };

  const pickVerse = (day, themeCode = theme) => {
    const verses = versesData.verses;
    if (themeCode && themeCode !== 'fe') {
      const themed = verses.filter((v) => v.theme === themeCode);
      if (themed.length > 0) {
        setVerse(themed[day % themed.length]);
        return;
      }
    }
    setVerse(verses[day % verses.length]);
  };

  const nextVerse = () => {
    const verses = versesData.verses;
    const idx = (verses.indexOf(verse) + 1) % verses.length;
    setVerse(verses[idx]);
  };

  const changeTheme = (code) => {
    // En gratis solo se permiten los primeros FREE_LIMITS.temas temas
    if (!isPremium && !THEMES.slice(0, FREE_LIMITS.temas).some((t) => t.code === code)) {
      Alert.alert('🔒 Contenido Premium', 'Los temas de versículos son parte de la suscripción Premium. Desbloquea todos los temas por 1€/mes.');
      return;
    }
    setTheme(code);
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const day = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    pickVerse(day, code);
  };

  const changeLang = (code) => {
    setLang(code);
    try {
      NativeModules.WidgetLang?.setLang(code);
    } catch (e) {
      console.log('WidgetLang no disponible:', e.message);
    }
  };

  const shareVerse = () => {
    if (!verse) return;
    const text = `"${verse[lang]}"\n\n— ${verse.ref}\n\n📖 Versículo del día`;
    Share.share({ message: text });
  };

  const shareConsejo = () => {
    const consejos = versesData.consejos || [];
    const consejo = consejos.length > 0 ? consejos[dayOfYear % consejos.length] : '';
    Share.share({ message: `💡 Consejo del día\n\n${consejo}\n\n— App Versículo del Día` });
  };

  const currentLang = LANGUAGES.find((l) => l.code === lang);
  const currentTheme = THEMES.find((t) => t.code === theme);

  // Alerta de contenido premium
  const showPremiumAlert = (seccion) => {
    Alert.alert(
      '🔒 Contenido Premium',
      `${seccion} son parte de Premium.\n\n• 1€/mes (cancela cuando quieras)\n• o 25€ pago único para siempre\n\nDesbloquea: todos los temas, 316 consejos, 8 oraciones, guía completa de la Biblia y widget multilingüe.`,
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Desbloquear (demo)',
          onPress: () => {
            setIsPremium(true);
            Alert.alert('✨ Premium activado', 'Modo demo: así se ve la versión de pago.');
          },
        },
      ]
    );
  };

  // Consejo del día
  const consejoDelDia = versesData.consejos && versesData.consejos.length > 0
    ? versesData.consejos[dayOfYear % versesData.consejos.length]
    : '';

  // Oración del día (rota semanalmente)
  const oracionDelDia = versesData.oraciones && versesData.oraciones.length > 0
    ? versesData.oraciones[dayOfYear % versesData.oraciones.length]
    : null;

  // Mandamiento del día (rota por día de la semana)
  const mandamientoDelDia = versesData.mandamientos && versesData.mandamientos.length > 0
    ? versesData.mandamientos[dayOfYear % versesData.mandamientos.length]
    : null;

  // Render de cada pestaña
  const renderTab = () => {
    switch (tab) {
      case 'consejo':
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💡 Consejo del día</Text>
              <Text style={styles.cardBody}>{consejoDelDia}</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={shareConsejo}>
                <Text style={styles.btnPrimaryText}>📤 Compartir</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>✝️ Los Diez Mandamientos</Text>
            {versesData.mandamientos && versesData.mandamientos.map((m) => (
              <View key={m.id} style={styles.listCard}>
                <Text style={styles.listNum}>{m.id}</Text>
                <Text style={styles.listText}>{m[lang] || m.es}</Text>
              </View>
            ))}
          </ScrollView>
        );

      case 'guia':
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionHeader}>📚 Guía de lectura de la Biblia</Text>

            {/* Guía de inicio */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{versesData.guia_inicio?.titulo}</Text>
              {versesData.guia_inicio?.pasos.map((p, i) => (
                <View key={i} style={styles.guiaPaso}>
                  <Text style={styles.guiaPasoTitle}>{p.titulo}</Text>
                  <Text style={styles.guiaPasoText}>{p.texto}</Text>
                </View>
              ))}
            </View>

            {/* Planes de lectura (premium) */}
            <Text style={styles.sectionHeader}>🗓️ Planes de lectura</Text>
            {!isPremium && (
              <TouchableOpacity style={styles.premiumCard} onPress={() => showPremiumAlert('Los planes de lectura')}>
                <Text style={styles.premiumEmoji}>🔒</Text>
                <Text style={styles.premiumText}>Desbloquea 5 planes de lectura completos con Premium</Text>
                <Text style={styles.premiumCta}>1€/mes o 25€ para siempre →</Text>
              </TouchableOpacity>
            )}
            {isPremium && versesData.planes?.map((p) => (
              <View key={p.id} style={styles.card}>
                <Text style={styles.cardTitle}>{p.titulo} · {p.duracion}</Text>
                <Text style={styles.cardBody}>{p.descripcion}</Text>
                {p.pasos.map((paso, i) => (
                  <Text key={i} style={styles.planPaso}>• {paso}</Text>
                ))}
              </View>
            ))}

            {/* Resúmenes de libros (premium) */}
            <Text style={styles.sectionHeader}>📖 Resúmenes de los 66 libros</Text>
            {!isPremium && (
              <TouchableOpacity style={styles.premiumCard} onPress={() => showPremiumAlert('Los resúmenes de los 66 libros')}>
                <Text style={styles.premiumEmoji}>🔒</Text>
                <Text style={styles.premiumText}>Desbloquea los resúmenes de los 66 libros de la Biblia</Text>
                <Text style={styles.premiumCta}>1€/mes o 25€ para siempre →</Text>
              </TouchableOpacity>
            )}
            {isPremium && versesData.libros?.map((libro) => (
              <View key={libro.id} style={styles.listCard}>
                <Text style={styles.libroNum}>{libro.id}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.libroTitle}>
                    {libro.libro} <Text style={styles.libroTest}>[{libro.testamento}]</Text>
                  </Text>
                  <Text style={styles.libroResumen}>{libro.resumen}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        );

      case 'oraciones':
        const oracionesVisibles = isPremium
          ? (versesData.oraciones || [])
          : (versesData.oraciones || []).slice(0, FREE_LIMITS.oraciones);
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionHeader}>🙏 Oración del día</Text>
            {oracionDelDia && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{oracionDelDia.titulo}</Text>
                <Text style={styles.cardBody}>{oracionDelDia[lang] || oracionDelDia.es}</Text>
              </View>
            )}
            <Text style={styles.sectionHeader}>📖 Todas las oraciones</Text>
            {oracionesVisibles.map((o) => (
              <View key={o.id} style={styles.card}>
                <Text style={styles.cardTitle}>{o.titulo}</Text>
                <Text style={styles.cardBody}>{o[lang] || o.es}</Text>
              </View>
            ))}
            {!isPremium && (
              <TouchableOpacity style={styles.premiumCard} onPress={() => showPremiumAlert('Las 8 oraciones completas')}>
                <Text style={styles.premiumEmoji}>🔒</Text>
                <Text style={styles.premiumText}>Desbloquea las 8 oraciones completas (Credo, Salve, Gloria, Acto de Contrición...)</Text>
                <Text style={styles.premiumCta}>1€/mes o 25€ para siempre →</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        );

      case 'mandamientos':
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionHeader}>📜 Los Diez Mandamientos</Text>
            {versesData.mandamientos && versesData.mandamientos.map((m) => (
              <View key={m.id} style={styles.listCard}>
                <Text style={styles.listNum}>{m.id}</Text>
                <Text style={styles.listText}>{m[lang] || m.es}</Text>
              </View>
            ))}
          </ScrollView>
        );

      case 'sacramentos':
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionHeader}>⛪ Los Siete Sacramentos</Text>
            {!isPremium && (
              <TouchableOpacity style={styles.premiumCard} onPress={() => showPremiumAlert('Los 7 Sacramentos')}>
                <Text style={styles.premiumEmoji}>🔒</Text>
                <Text style={styles.premiumText}>Desbloquea la explicación de los 7 Sacramentos con Premium</Text>
                <Text style={styles.premiumCta}>1€/mes o 25€ para siempre →</Text>
              </TouchableOpacity>
            )}
            {isPremium && versesData.sacramentos && versesData.sacramentos.map((s) => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.cardTitle}>✝️ {s.titulo}</Text>
                <Text style={styles.cardBody}>{s.es}</Text>
              </View>
            ))}
          </ScrollView>
        );

      case 'dia':
      default:
        return (
          <View style={styles.tabContent}>
            {verse && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {currentTheme?.icon} Versículo de {currentTheme?.name}
                </Text>
                <Text style={styles.verseText}>{verse[lang] || verse.es}</Text>
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

            {consejoDelDia && (
              <TouchableOpacity style={styles.consejoCard} onPress={shareConsejo}>
                <Text style={styles.consejoTitle}>💡 Consejo del día</Text>
                <Text style={styles.consejoText}>{consejoDelDia}</Text>
                <Text style={styles.consejoTap}>Toca para compartir →</Text>
              </TouchableOpacity>
            )}
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>✝️ Fe Diaria</Text>
        <Text style={styles.subtitle}>Versículos, consejos y oraciones para tu día</Text>
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
            onPress={() => changeLang(l.code)}
          >
            <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
              {l.flag} {l.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Theme selector (solo en pestaña día) */}
      {tab === 'dia' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.themeBar}
          contentContainerStyle={styles.themeBarContent}
        >
          {THEMES.map((t) => {
            const locked = !isPremium && !THEMES.slice(0, FREE_LIMITS.temas).some((x) => x.code === t.code);
            return (
              <TouchableOpacity
                key={t.code}
                style={[styles.themeChip, theme === t.code && styles.themeChipActive, locked && styles.themeChipLocked]}
                onPress={() => (locked ? showPremiumAlert('Los temas de versículos') : changeTheme(t.code))}
              >
                <Text style={[styles.themeText, theme === t.code && styles.themeTextActive]}>
                  {locked ? '🔒' : t.icon} {t.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Content */}
      <View style={styles.content}>
        {renderTab()}
      </View>

      {/* Bottom tabs */}
      <View style={styles.tabsBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.code}
            style={[styles.tabItem, tab === t.code && styles.tabItemActive]}
            onPress={() => setTab(t.code)}
          >
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text style={[styles.tabText, tab === t.code && styles.tabTextActive]}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  logo: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#a0a0c0',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  langBar: {
    marginBottom: 8,
  },
  langBarContent: {
    gap: 8,
    paddingHorizontal: 16,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#2a2a4a',
  },
  langChipActive: {
    backgroundColor: '#e94560',
  },
  langText: {
    color: '#a0a0c0',
    fontSize: 12,
  },
  langTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  themeBar: {
    marginBottom: 8,
  },
  themeBarContent: {
    gap: 8,
    paddingHorizontal: 16,
  },
  themeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#16213e',
  },
  themeChipActive: {
    backgroundColor: '#f59e0b',
  },
  themeChipLocked: {
    opacity: 0.5,
  },
  themeText: {
    color: '#a0a0c0',
    fontSize: 12,
  },
  themeTextActive: {
    color: '#1a1a2e',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardTitle: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardBody: {
    color: '#d0d0e0',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  verseText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 30,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  verseRef: {
    color: '#e94560',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  btnSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2a2a4a',
  },
  btnSecondaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  btnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e94560',
    alignItems: 'center',
    marginTop: 16,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  consejoCard: {
    backgroundColor: '#2a2a4a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  consejoTitle: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  consejoText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
  },
  consejoTap: {
    color: '#a0a0c0',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'right',
  },
  sectionHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },
  premiumCard: {
    backgroundColor: '#2a2a4a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
    alignItems: 'center',
  },
  premiumEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  premiumText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  premiumCta: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  guiaPaso: {
    marginBottom: 12,
  },
  guiaPasoTitle: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  guiaPasoText: {
    color: '#d0d0e0',
    fontSize: 13,
    lineHeight: 20,
  },
  planPaso: {
    color: '#d0d0e0',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  libroNum: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    width: 28,
  },
  libroTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  libroTest: {
    color: '#a0a0c0',
    fontSize: 11,
    fontWeight: '400',
  },
  libroResumen: {
    color: '#d0d0e0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  listNum: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '700',
    width: 30,
  },
  listText: {
    color: '#d0d0e0',
    fontSize: 14,
    flex: 1,
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    paddingVertical: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    backgroundColor: '#2a2a4a',
    borderRadius: 10,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabText: {
    color: '#a0a0c0',
    fontSize: 10,
    marginTop: 2,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
