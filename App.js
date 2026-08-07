import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import versesData from './verses.json';
import {
  checkStreak,
  getFavorites,
  toggleFavorite,
  isFavorite,
  loadPremium,
  savePremium,
  loadLang,
  saveLang,
} from './storage';

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
  { code: 'dia', name: 'Hoy', icon: '📅' },
  { code: 'favoritos', name: 'Favoritos', icon: '❤️' },
  { code: 'guia', name: 'Guía', icon: '📚' },
  { code: 'oraciones', name: 'Oraciones', icon: '🙏' },
  { code: 'mandamientos', name: 'Los 10', icon: '📜' },
  { code: 'sacramentos', name: 'Sacramentos', icon: '⛪' },
];

// Configuración FREE vs PREMIUM (estrategia: gratis generosa, premium = funciones)
const FREE_LIMITS = {
  temas: 9,
  consejos: 316,
  oraciones: 8,
  librosGuia: 5,
  planes: 1,
  favoritos: 20,
  widgets: 1,
  conAnuncios: true,
};

export default function App() {
  const [lang, setLang] = useState('es');
  const [theme, setTheme] = useState('fe');
  const [tab, setTab] = useState('dia');
  const [verse, setVerse] = useState(null);
  const [dayOfYear, setDayOfYear] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [streak, setStreak] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [favIds, setFavIds] = useState(new Set());
  const [doneToday, setDoneToday] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const todayDate = new Date();
  const dayIndex = Math.floor(
    (todayDate - new Date(todayDate.getFullYear(), 0, 1)) / 86400000
  );

  // Cargar estado persistente al montar
  useEffect(() => {
    (async () => {
      const [s, favs, prem, savedLang] = await Promise.all([
        checkStreak(),
        getFavorites(),
        loadPremium(),
        loadLang(),
      ]);
      setStreak(s.streak);
      setFavorites(favs);
      setFavIds(new Set(favs.map((f) => `${f.type}:${f.id}`)));
      setIsPremium(prem);
      if (savedLang) setLang(savedLang);

      const done = await AsyncStorage.getItem('@fe_diaria/done_today');
      setDoneToday(done === todayDate.toISOString().slice(0, 10));

      setDayOfYear(dayIndex);
      pickVerse(dayIndex);
      scheduleDailyNotification();
    })();
  }, []);

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

  const scheduleDailyNotification = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Notifications.cancelAllScheduledNotificationsAsync();

      const v = versesData.verses[dayIndex % versesData.verses.length];
      const consejos = versesData.consejos || [];
      const consejo = consejos.length > 0 ? consejos[dayIndex % consejos.length] : '';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 Versículo del Día',
          body: `"${v[lang] || v.es}" — ${v.ref}${consejo ? `\n💡 ${consejo}` : ''}`,
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

  const nextVerse = () => {
    const allVerses = versesData.verses;
    let filtered = allVerses;
    if (theme !== 'fe') {
      const themed = allVerses.filter((v) => v.theme === theme);
      if (themed.length > 0) filtered = themed;
    }
    const idx = (filtered.indexOf(verse) + 1) % filtered.length;
    setVerse(filtered[idx]);
  };

  const changeTheme = (code) => {
    setTheme(code);
    pickVerse(dayIndex, code);
  };

  const changeLang = (code) => {
    setLang(code);
    saveLang(code);
    try {
      NativeModules.WidgetLang?.setLang(code);
    } catch (e) {}
  };

  const shareText = (text) => {
    Share.share({ message: text });
  };

  // Favoritos
  const onToggleFavorite = async (item) => {
    // Límite gratis
    if (!isPremium && favorites.length >= FREE_LIMITS.favoritos) {
      showPremiumAlert('Favoritos ilimitados');
      return;
    }
    const { favs, isFav } = await toggleFavorite(item);
    setFavorites(favs);
    const ids = new Set(favs.map((f) => `${f.type}:${f.id}`));
    setFavIds(ids);
    if (!isFav) Alert.alert('❤️ Eliminado de favoritos');
  };

  const isFav = (id, type) => favIds.has(`${type}:${id}`);

  // Momento diario completado
  const markDoneToday = async () => {
    setDoneToday(true);
    try {
      await AsyncStorage.setItem('@fe_diaria/done_today', todayDate.toISOString().slice(0, 10));
      // Actualizar racha
      const s = await checkStreak();
      setStreak(s.streak);
    } catch (e) {}
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    pickVerse(dayIndex, theme);
    setRefreshing(false);
  }, [dayIndex, theme]);

  // Alerta de contenido premium
  const showPremiumAlert = (seccion) => {
    Alert.alert(
      '✨ Premium',
      `${seccion} son parte de Premium.\n\n• 0,99€/mes (cancela cuando quieras)\n• 10€/año (2 meses gratis)\n• o 25€ pago único para siempre\n• o prueba gratis 3 días\n\nCon Premium: planes de lectura completos, estadísticas, favoritos ilimitados, widgets avanzados, temas visuales y próximas funciones.`,
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Probar 3 días gratis',
          onPress: async () => {
            setIsPremium(true);
            await savePremium(true);
            Alert.alert('✨ Prueba activada', 'Disfruta Premium 3 días. Esta demo se conectará a pagos reales con la cuenta de Play Store.');
          },
        },
        {
          text: 'Desbloquear (demo)',
          onPress: async () => {
            setIsPremium(true);
            await savePremium(true);
            Alert.alert('✨ Premium activado', 'Modo demo: así se ve la versión de pago.');
          },
        },
      ]
    );
  };

  const currentLang = LANGUAGES.find((l) => l.code === lang);
  const currentTheme = THEMES.find((t) => t.code === theme);

  // Contenido del día
  const consejoDelDia = versesData.consejos && versesData.consejos.length > 0
    ? versesData.consejos[dayIndex % versesData.consejos.length]
    : '';
  const oracionDelDia = versesData.oraciones && versesData.oraciones.length > 0
    ? versesData.oraciones[dayIndex % versesData.oraciones.length]
    : null;
  const planDelDia = isPremium && versesData.planes && versesData.planes.length > 0
    ? versesData.planes[dayIndex % versesData.planes.length]
    : null;
  const mandamientoDelDia = versesData.mandamientos && versesData.mandamientos.length > 0
    ? versesData.mandamientos[dayIndex % versesData.mandamientos.length]
    : null;

  const fechaBonita = todayDate.toLocaleDateString(lang === 'es' ? 'es-ES' : lang, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Render de cada pestaña
  const renderTab = () => {
    switch (tab) {
      case 'dia':
      default:
        return (
          <ScrollView
            contentContainerStyle={styles.tabContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Racha */}
            <View style={styles.streakRow}>
              <Text style={styles.streakText}>
                🔥 {streak} {streak === 1 ? 'día' : 'días'} seguidos
              </Text>
              {doneToday && <Text style={styles.doneBadge}>✓ Hecho hoy</Text>}
            </View>

            <Text style={styles.fechaLabel}>{fechaBonita}</Text>

            {/* Versículo del día */}
            {verse && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    {currentTheme?.icon} Versículo de {currentTheme?.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite({ id: `v_${verse.id}`, type: 'verso', texto: verse[lang] || verse.es, ref: verse.ref })}
                    style={styles.favBtn}
                  >
                    <Text style={styles.favIcon}>{isFav(`v_${verse.id}`, 'verso') ? '❤️' : '🤍'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.verseText}>{verse[lang] || verse.es}</Text>
                <Text style={styles.verseRef}>— {verse.ref}</Text>

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.btnSecondary} onPress={nextVerse}>
                    <Text style={styles.btnSecondaryText}>🔄 Otro</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnPrimary} onPress={() => shareText(`"${verse[lang] || verse.es}"\n\n— ${verse.ref}\n\n📖 Fe Diaria`)}>
                    <Text style={styles.btnPrimaryText}>📤 Compartir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Consejo del día */}
            {consejoDelDia && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>💡 Consejo del día</Text>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite({ id: `c_${dayIndex}`, type: 'consejo', texto: consejoDelDia })}
                    style={styles.favBtn}
                  >
                    <Text style={styles.favIcon}>{isFav(`c_${dayIndex}`, 'consejo') ? '❤️' : '🤍'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardBody}>{consejoDelDia}</Text>
              </View>
            )}

            {/* Oración del día */}
            {oracionDelDia && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>🙏 {oracionDelDia.titulo}</Text>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite({ id: `o_${oracionDelDia.id}`, type: 'oracion', texto: oracionDelDia[lang] || oracionDelDia.es, ref: oracionDelDia.titulo })}
                    style={styles.favBtn}
                  >
                    <Text style={styles.favIcon}>{isFav(`o_${oracionDelDia.id}`, 'oracion') ? '❤️' : '🤍'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardBodySmall}>{oracionDelDia[lang] || oracionDelDia.es}</Text>
              </View>
            )}

            {/* Fragmento del plan (premium) */}
            {planDelDia ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🗓️ {planDelDia.titulo}</Text>
                <Text style={styles.cardBodySmall}>{planDelDia.pasos[0]}</Text>
                <Text style={styles.planHint}>Plan de lectura del día · ver Guía para el plan completo</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.premiumCard} onPress={() => showPremiumAlert('Los planes de lectura')}>
                <Text style={styles.premiumEmoji}>🔒</Text>
                <Text style={styles.premiumText}>Desbloquea 5 planes de lectura completos con Premium</Text>
                <Text style={styles.premiumCta}>0,99€/mes · 10€/año · 25€ vitalicio →</Text>
              </TouchableOpacity>
            )}

            {/* Botón completar */}
            <TouchableOpacity
              style={[styles.doneBtn, doneToday && styles.doneBtnActive]}
              onPress={markDoneToday}
              disabled={doneToday}
            >
              <Text style={styles.doneBtnText}>
                {doneToday ? '✓ Momento completado hoy' : '✓ Completé mi momento de hoy'}
              </Text>
            </TouchableOpacity>

            {!isPremium && (
              <TouchableOpacity style={styles.premiumBanner} onPress={() => showPremiumAlert('Premium')}>
                <Text style={styles.premiumBannerText}>✨ Premium: planes de lectura, estadísticas, favoritos ilimitados y más</Text>
                <Text style={styles.premiumCta}>0,99€/mes · 10€/año · 25€ vitalicio →</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        );

      case 'favoritos':
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionHeader}>❤️ Mis favoritos</Text>
            {favorites.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🤍</Text>
                <Text style={styles.emptyText}>
                  Guarda versículos, consejos y oraciones tocando el corazón. {!isPremium && `Tienes ${FREE_LIMITS.favoritos} favoritos en la versión gratis.`}
                </Text>
              </View>
            )}
            {favorites.map((f, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    {f.type === 'verso' ? '📖 Versículo' : f.type === 'consejo' ? '💡 Consejo' : '🙏 Oración'}
                  </Text>
                  <TouchableOpacity onPress={() => onToggleFavorite(f)} style={styles.favBtn}>
                    <Text style={styles.favIcon}>❤️</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardBody}>{f.texto}</Text>
                {f.ref && <Text style={styles.verseRef}>{f.ref}</Text>}
                <TouchableOpacity style={styles.btnPrimary} onPress={() => shareText(`"${f.texto}"${f.ref ? `\n\n— ${f.ref}` : ''}\n\n📖 Fe Diaria`)}>
                  <Text style={styles.btnPrimaryText}>📤 Compartir</Text>
                </TouchableOpacity>
              </View>
            ))}
            {favorites.length >= FREE_LIMITS.favoritos && !isPremium && (
              <TouchableOpacity style={styles.premiumCard} onPress={() => showPremiumAlert('Favoritos ilimitados')}>
                <Text style={styles.premiumEmoji}>🔒</Text>
                <Text style={styles.premiumText}>Has llegado al límite de {FREE_LIMITS.favoritos} favoritos. Con Premium, ilimitados.</Text>
                <Text style={styles.premiumCta}>0,99€/mes · 10€/año · 25€ vitalicio →</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        );

      case 'guia':
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionHeader}>📚 Guía de lectura de la Biblia</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{versesData.guia_inicio?.titulo}</Text>
              {versesData.guia_inicio?.pasos.map((p, i) => (
                <View key={i} style={styles.guiaPaso}>
                  <Text style={styles.guiaPasoTitle}>{p.titulo}</Text>
                  <Text style={styles.guiaPasoText}>{p.texto}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionHeader}>🗓️ Planes de lectura</Text>
            {!isPremium && (
              <TouchableOpacity style={styles.premiumCard} onPress={() => showPremiumAlert('Los planes de lectura')}>
                <Text style={styles.premiumEmoji}>🔒</Text>
                <Text style={styles.premiumText}>Desbloquea 5 planes de lectura completos con Premium</Text>
                <Text style={styles.premiumCta}>0,99€/mes · 10€/año · 25€ vitalicio →</Text>
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

            <Text style={styles.sectionHeader}>📖 Resúmenes de los 66 libros</Text>
            {!isPremium && (
              <TouchableOpacity style={styles.premiumCard} onPress={() => showPremiumAlert('Los resúmenes de los 66 libros')}>
                <Text style={styles.premiumEmoji}>🔒</Text>
                <Text style={styles.premiumText}>Desbloquea los resúmenes de los 66 libros de la Biblia</Text>
                <Text style={styles.premiumCta}>0,99€/mes · 10€/año · 25€ vitalicio →</Text>
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
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionHeader}>🙏 Oración del día</Text>
            {oracionDelDia && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{oracionDelDia.titulo}</Text>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite({ id: `o_${oracionDelDia.id}`, type: 'oracion', texto: oracionDelDia[lang] || oracionDelDia.es, ref: oracionDelDia.titulo })}
                    style={styles.favBtn}
                  >
                    <Text style={styles.favIcon}>{isFav(`o_${oracionDelDia.id}`, 'oracion') ? '❤️' : '🤍'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardBody}>{oracionDelDia[lang] || oracionDelDia.es}</Text>
              </View>
            )}
            <Text style={styles.sectionHeader}>📖 Todas las oraciones</Text>
            {(versesData.oraciones || []).map((o) => (
              <View key={o.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{o.titulo}</Text>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite({ id: `o_${o.id}`, type: 'oracion', texto: o[lang] || o.es, ref: o.titulo })}
                    style={styles.favBtn}
                  >
                    <Text style={styles.favIcon}>{isFav(`o_${o.id}`, 'oracion') ? '❤️' : '🤍'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardBody}>{o[lang] || o.es}</Text>
              </View>
            ))}
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
            {versesData.sacramentos && versesData.sacramentos.map((s) => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.cardTitle}>✝️ {s.titulo}</Text>
                <Text style={styles.cardBody}>{s.es}</Text>
              </View>
            ))}
          </ScrollView>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

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
          {THEMES.map((t) => (
            <TouchableOpacity
              key={t.code}
              style={[styles.themeChip, theme === t.code && styles.themeChipActive]}
              onPress={() => changeTheme(t.code)}
            >
              <Text style={[styles.themeText, theme === t.code && styles.themeTextActive]}>
                {t.icon} {t.name}
              </Text>
            </TouchableOpacity>
          ))}
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
    backgroundColor: '#F0F4FF',
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  logo: {
    color: '#1E3A8A',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5B7BB4',
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
    backgroundColor: '#E8F0FE',
  },
  langChipActive: {
    backgroundColor: '#2563EB',
  },
  langText: {
    color: '#1E3A8A',
    fontSize: 12,
  },
  langTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
  },
  themeChipActive: {
    backgroundColor: '#1D4ED8',
  },
  themeChipLocked: {
    opacity: 0.5,
  },
  themeText: {
    color: '#1E3A8A',
    fontSize: 12,
  },
  themeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabContent: {
    paddingBottom: 100,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  streakText: {
    color: '#1D4ED8',
    fontSize: 15,
    fontWeight: '700',
  },
  doneBadge: {
    color: '#FFFFFF',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  fechaLabel: {
    color: '#5B7BB4',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    zIndex: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  favBtn: {
    padding: 4,
  },
  favIcon: {
    fontSize: 18,
  },
  cardTitle: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  dateLabel: {
    color: '#5B7BB4',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  premiumBanner: {
    backgroundColor: '#E8F0FE',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1D4ED8',
  },
  premiumBannerText: {
    color: '#1D4ED8',
    fontSize: 14,
    marginBottom: 4,
  },
  cardBody: {
    color: '#3B5A8C',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  cardBodySmall: {
    color: '#3B5A8C',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  verseText: {
    color: '#1E3A8A',
    fontSize: 16,
    lineHeight: 25,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  verseRef: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    zIndex: 10,
    elevation: 6,
  },
  btnSecondary: {
    flex: 1,
    marginRight: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
  },
  btnSecondaryText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1,
    marginLeft: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    marginTop: 0,
    zIndex: 10,
    elevation: 6,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  planHint: {
    color: '#5B7BB4',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  doneBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  doneBtnActive: {
    backgroundColor: '#16A34A',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeader: {
    color: '#1D4ED8',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },
  premiumCard: {
    backgroundColor: '#E8F0FE',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    alignItems: 'center',
  },
  premiumEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  premiumText: {
    color: '#1E3A8A',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  premiumCta: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  guiaPaso: {
    marginBottom: 12,
  },
  guiaPasoTitle: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  guiaPasoText: {
    color: '#3B5A8C',
    fontSize: 13,
    lineHeight: 20,
  },
  planPaso: {
    color: '#3B5A8C',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  libroNum: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
    width: 28,
  },
  libroTitle: {
    color: '#1E3A8A',
    fontSize: 14,
    fontWeight: '700',
  },
  libroTest: {
    color: '#5B7BB4',
    fontSize: 11,
    fontWeight: '400',
  },
  libroResumen: {
    color: '#3B5A8C',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  listNum: {
    color: '#1D4ED8',
    fontSize: 16,
    fontWeight: '700',
    width: 30,
  },
  listText: {
    color: '#3B5A8C',
    fontSize: 14,
    flex: 1,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    color: '#5B7BB4',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8F0FE',
    paddingVertical: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    backgroundColor: '#E8F0FE',
    borderRadius: 10,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabText: {
    color: '#5B7BB4',
    fontSize: 10,
    marginTop: 2,
  },
  tabTextActive: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
});
