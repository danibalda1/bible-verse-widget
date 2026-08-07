// Utilidades de persistencia: racha diaria + favoritos
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  streak: '@fe_diaria/streak',
  favorites: '@fe_diaria/favorites',
  lastVisit: '@fe_diaria/last_visit',
  premium: '@fe_diaria/premium',
  lang: '@fe_diaria/lang',
};

// ── Rachas ──
// Guarda la fecha de visita y calcula la racha.
// Reglas: si visitas hoy -> racha se mantiene (o +1 si ayer no contaba).
// Si visitas ayer y ayer no se registró -> +1.
// Si saltas un día -> racha se reinicia a 1.
export async function checkStreak() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const [lastVisit, streakRaw] = await Promise.all([
      AsyncStorage.getItem(KEYS.lastVisit),
      AsyncStorage.getItem(KEYS.streak),
    ]);
    const streak = parseInt(streakRaw || '0', 10);

    if (lastVisit === todayStr) {
      // Ya visitó hoy: no cambia
      return { streak, today: true };
    }

    let newStreak;
    if (lastVisit === yesterdayStr) {
      newStreak = streak + 1;
    } else {
      newStreak = 1;
    }

    await AsyncStorage.multiSet([
      [KEYS.lastVisit, todayStr],
      [KEYS.streak, String(newStreak)],
    ]);
    return { streak: newStreak, today: true, updated: true };
  } catch (e) {
    console.log('checkStreak error:', e.message);
    return { streak: 0, today: false };
  }
}

export async function getStreak() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.streak);
    return parseInt(raw || '0', 10);
  } catch {
    return 0;
  }
}

// ── Favoritos ──
export async function getFavorites() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.favorites);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function toggleFavorite(item) {
  try {
    const favs = await getFavorites();
    const idx = favs.findIndex((f) => f.id === item.id && f.type === item.type);
    let isFav = true;
    if (idx >= 0) {
      favs.splice(idx, 1);
      isFav = false;
    } else {
      favs.push(item);
    }
    await AsyncStorage.setItem(KEYS.favorites, JSON.stringify(favs));
    return { favs, isFav };
  } catch (e) {
    console.log('toggleFavorite error:', e.message);
    return { favs: [], isFav: false };
  }
}

export async function isFavorite(id, type) {
  try {
    const favs = await getFavorites();
    return favs.some((f) => f.id === id && f.type === type);
  } catch {
    return false;
  }
}

// ── Premium (demo) ──
export async function loadPremium() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.premium);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function savePremium(value) {
  try {
    await AsyncStorage.setItem(KEYS.premium, value ? 'true' : 'false');
  } catch {}
}

// ── Idioma ──
export async function loadLang() {
  try {
    return (await AsyncStorage.getItem(KEYS.lang)) || 'es';
  } catch {
    return 'es';
  }
}

export async function saveLang(lang) {
  try {
    await AsyncStorage.setItem(KEYS.lang, lang);
  } catch {}
}
