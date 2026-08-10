import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { NativeModules } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  ACHIEVEMENTS,
  getUnlockedAchievements,
  saveUnlockedAchievements,
  getDoneDays,
  addDoneDay,
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

// Sistema de niveles tipo juego (basado en racha)
const LEVELS = [
  { min: 0, name: 'Semilla', icon: '🌱', color: '#059669' },
  { min: 3, name: 'Brote', icon: '🌿', color: '#10B981' },
  { min: 7, name: 'Planta', icon: '🌷', color: '#D97706' },
  { min: 14, name: 'Árbol', icon: '🌳', color: '#7C3AED' },
  { min: 30, name: 'Jardín', icon: '🌸', color: '#DB2777' },
  { min: 60, name: 'Bosque', icon: '🌲', color: '#2563EB' },
  { min: 100, name: 'Roble', icon: '🌳', color: '#1D4ED8' },
  { min: 200, name: 'Redwood', icon: '🎄', color: '#0F2A6E' },
];

const getLevel = (streak) => {
  let level = LEVELS[0];
  let next = LEVELS[1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (streak >= LEVELS[i].min) {
      level = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  return { level, next };
};

const { width: SCREEN_W } = Dimensions.get('window');

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
  const [achievements, setAchievements] = useState([]);
  const [doneDays, setDoneDays] = useState([]);
  // Animaciones
  const verseAnim = useRef(new Animated.Value(1)).current;
  const confettiPieces = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      x: useRef(new Animated.Value(0)).current,
      y: useRef(new Animated.Value(-30)).current,
      rotate: useRef(new Animated.Value(0)).current,
      delay: i * 60,
      color: ['#3B82F6', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#EF4444'][i % 6],
      emoji: ['✨', '⭐', '🌿', '🕊️', '💙', '🌟'][i % 6],
    }))
  ).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Animación de aparición del versículo
  const animateVerseChange = () => {
    Animated.sequence([
      Animated.timing(verseAnim, { toValue: 0.2, duration: 120, useNativeDriver: true }),
      Animated.timing(verseAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  // Explosión de confeti (al completar el momento)
  const burstConfetti = () => {
    confettiPieces.forEach((piece) => {
      piece.x.setValue(0);
      piece.y.setValue(0);
      piece.rotate.setValue(0);
      Animated.parallel([
        Animated.timing(piece.y, {
          toValue: -(180 + Math.random() * 120),
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(piece.x, {
          toValue: (Math.random() - 0.5) * SCREEN_W * 0.8,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(piece.rotate, {
          toValue: Math.random() * 360,
          duration: 900,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Pulsación suave de botones
  const pressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
  };
  const pressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  };

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

      const [achs, ddays] = await Promise.all([getUnlockedAchievements(), getDoneDays()]);
      setAchievements(achs);
      setDoneDays(ddays);
      // Comprobar logros según la racha actual
      const newAchs = [...achs];
      let changed = false;
      ACHIEVEMENTS.forEach((a) => {
        if (s.streak >= a.days && !newAchs.includes(a.id)) {
          newAchs.push(a.id);
          changed = true;
        }
      });
      if (changed) {
        setAchievements(newAchs);
        await saveUnlockedAchievements(newAchs);
      }

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
    animateVerseChange();
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
    burstConfetti();
    try {
      const todayStr = todayDate.toISOString().slice(0, 10);
      await AsyncStorage.setItem('@fe_diaria/done_today', todayStr);
      const days = await addDoneDay(todayStr);
      setDoneDays(days);
      // Actualizar racha
      const s = await checkStreak();
      setStreak(s.streak);
      // Comprobar logros
      const newAchs = [...achievements];
      let changed = false;
      ACHIEVEMENTS.forEach((a) => {
        if (s.streak >= a.days && !newAchs.includes(a.id)) {
          newAchs.push(a.id);
          changed = true;
        }
      });
      if (changed) {
        setAchievements(newAchs);
        await saveUnlockedAchievements(newAchs);
        // Nueva insignia -> alerta especial
        const newlyUnlocked = ACHIEVEMENTS.filter((a) => newAchs.includes(a.id) && !achievements.includes(a.id));
        if (newlyUnlocked.length > 0) {
          Alert.alert('🏅 ¡Nuevo logro!', `${newlyUnlocked.map((a) => `${a.icon} ${a.name} — ${a.desc}`).join('\n')}`);
        }
      }
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
        const { level, next } = getLevel(streak);
          const progress = next ? (streak - level.min) / (next.min - level.min) : 1;
          return (
            <ScrollView
              contentContainerStyle={styles.tabContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              {/* Confeti overlay */}
              {confettiPieces.map((piece, i) => (
                <Animated.View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: SCREEN_W / 2 - 15,
                    top: 200,
                    opacity: 1,
                    transform: [
                      { translateY: piece.y },
                      { translateX: piece.x },
                      { rotate: piece.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                    ],
                    zIndex: 100,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{piece.emoji}</Text>
                </Animated.View>
              ))}

              {/* Tarjeta de nivel (game-like) */}
              <View style={[styles.levelCard, { backgroundColor: level.color }]}>
                <View style={styles.levelRow}>
                  <Text style={styles.levelIcon}>{level.icon}</Text>
                  <View style={styles.levelInfo}>
                    <Text style={styles.levelName}>Nivel {LEVELS.indexOf(level) + 1} · {level.name}</Text>
                    <Text style={styles.levelStreak}>🔥 {streak} {streak === 1 ? 'día' : 'días'} seguidos</Text>
                  </View>
                  {doneToday && <Text style={styles.doneBadge}>✓ Hoy</Text>}
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {next ? `${next.min - streak} días para ${next.name} ${next.icon}` : '¡Nivel máximo! 🏆'}
                </Text>
              </View>

              <Text style={styles.fechaLabel}>{fechaBonita}</Text>

              {/* Versículo del día */}
              {verse && (
                <Animated.View style={[styles.card, { opacity: verseAnim, transform: [{ scale: verseAnim }] }]}>
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
                    <TouchableOpacity style={styles.btnSecondary} onPress={nextVerse} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={0.8}>
                      <Text style={styles.btnSecondaryText}>🔄 Otro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => shareText(`"${verse[lang] || verse.es}"\n\n— ${verse.ref}\n\n📖 Fe Diaria`)} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={0.8}>
                      <Text style={styles.btnPrimaryText}>📤 Compartir</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
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
              onPressIn={pressIn}
              onPressOut={pressOut}
              activeOpacity={0.85}
            >
              <Text style={styles.doneBtnText}>
                {doneToday ? '✓ Momento completado hoy' : '✓ Completé mi momento de hoy'}
              </Text>
            </TouchableOpacity>

            {/* Calendario de racha (últimos 7 días) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📅 Tu semana</Text>
              <View style={styles.weekRow}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(todayDate);
                  d.setDate(todayDate.getDate() - (6 - i));
                  const dStr = d.toISOString().slice(0, 10);
                  const isDone = doneDays.includes(dStr);
                  const isToday = i === 6;
                  return (
                    <View key={i} style={styles.weekDay}>
                      <View style={[styles.weekDot, isDone && styles.weekDotDone, isToday && styles.weekDotToday]}>
                        {isDone && <Text style={styles.weekDotCheck}>✓</Text>}
                      </View>
                      <Text style={styles.weekLabel}>
                        {d.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 2)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Logros / Insignias */}
            <Text style={styles.sectionHeader}>🏅 Logros</Text>
            <View style={styles.achievementsGrid}>
              {ACHIEVEMENTS.map((a) => {
                const unlocked = achievements.includes(a.id);
                return (
                  <View key={a.id} style={[styles.achievementCard, !unlocked && styles.achievementLocked]}>
                    <Text style={styles.achievementIcon}>{unlocked ? a.icon : '🔒'}</Text>
                    <Text style={[styles.achievementName, !unlocked && styles.achievementNameLocked]}>{a.name}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.achievementHint}>
              {achievements.length}/{ACHIEVEMENTS.length} logros · completa tu momento cada día para desbloquearlos
            </Text>

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
    <LinearGradient
      colors={['#EEF4FF', '#F7F8FA', '#F7F8FA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 0.6 }}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#3B82F6', '#1D4ED8', '#0F2A6E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoBadge}
        >
          <Text style={styles.logoBadgeText}>✝</Text>
        </LinearGradient>
        <Text style={styles.logo}>Fe Diaria</Text>
        <Text style={styles.subtitle}>Tu momento espiritual de cada día</Text>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    paddingTop: 54,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  logo: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#4B5563',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  langBar: {
    marginBottom: 8,
  },
  langBarContent: {
    gap: 6,
    paddingHorizontal: 12,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF1F6',
    justifyContent: 'center',
  },
  langChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  langText: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '500',
  },
  langTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  themeBar: {
    marginBottom: 12,
  },
  themeBarContent: {
    gap: 8,
    paddingHorizontal: 12,
  },
  themeChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EEF1F6',
  },
  themeChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  themeChipLocked: {
    opacity: 0.5,
  },
  themeText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '500',
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
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  streakText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  levelCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelIcon: {
    fontSize: 34,
    marginRight: 12,
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  levelStreak: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  weekDay: {
    alignItems: 'center',
    flex: 1,
  },
  weekDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  weekDotDone: {
    backgroundColor: '#10B981',
  },
  weekDotToday: {
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  weekDotCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  weekLabel: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  achievementLocked: {
    opacity: 0.45,
    backgroundColor: '#F3F4F6',
  },
  achievementIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  achievementName: {
    color: '#111827',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  achievementNameLocked: {
    color: '#6B7280',
  },
  achievementHint: {
    color: '#6B7280',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  doneBadge: {
    color: '#FFFFFF',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  fechaLabel: {
    color: '#4B5563',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
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
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.2,
  },
  dateLabel: {
    color: '#4B5563',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  premiumBanner: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  premiumBannerText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardBody: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  cardBodySmall: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  verseText: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 26,
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '500',
  },
  verseRef: {
    color: '#2563EB',
    fontSize: 14,
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
    marginRight: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
  },
  btnSecondaryText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1,
    marginLeft: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    marginTop: 0,
    zIndex: 10,
    elevation: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  planHint: {
    color: '#4B5563',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  doneBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnActive: {
    backgroundColor: '#10B981',
    opacity: 0.7,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeader: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  premiumEmoji: {
    fontSize: 26,
    marginBottom: 8,
  },
  premiumText: {
    color: '#374151',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  premiumCta: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  guiaPaso: {
    marginBottom: 12,
  },
  guiaPasoTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  guiaPasoText: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 20,
  },
  planPaso: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  libroNum: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
    width: 28,
  },
  libroTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  libroTest: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '400',
  },
  libroResumen: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  listNum: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '700',
    width: 30,
  },
  listText: {
    color: '#4B5563',
    fontSize: 14,
    flex: 1,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECEDF0',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    color: '#4B5563',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECEDF0',
    paddingVertical: 8,
    paddingBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  tabItemActive: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabText: {
    color: '#4B5563',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#111827',
    fontWeight: '700',
  },
});
