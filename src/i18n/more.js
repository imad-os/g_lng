// Texts of newer features, per language. AI texts live in ./ai.js and are merged under the key "ai".
import ai from './ai.js?v=2.4.0';

export default {
  en: { ai: ai.en, leagueEmpty: "Earn XP to join this week's league.", leagueOffline: "League unavailable offline.", leagueYou: "You", leagueRename: "Change name", leagueNameHint: "Your name in the league", leagueOutside: "You: {xp} XP (outside the top)", leagueSave: "Save", leagueResets: "Resets every week" },
  fr: { ai: ai.fr, leagueEmpty: "Gagnez de l'XP pour rejoindre la ligue.", leagueOffline: "Ligue indisponible hors ligne.", leagueYou: "Vous", leagueRename: "Changer le nom", leagueNameHint: "Votre nom dans la ligue", leagueOutside: "Vous : {xp} XP (hors du haut)", leagueSave: "Enregistrer", leagueResets: "Remise à zéro chaque semaine" },
  es: { ai: ai.es, leagueEmpty: "Gana XP para unirte a la liga.", leagueOffline: "Liga no disponible sin conexión.", leagueYou: "Tú", leagueRename: "Cambiar nombre", leagueNameHint: "Tu nombre en la liga", leagueOutside: "Tú: {xp} XP (fuera del top)", leagueSave: "Guardar", leagueResets: "Se reinicia cada semana" },
  ar: { ai: ai.ar, leagueEmpty: "اكسب نقاطًا لتنضم إلى دوري الأسبوع.", leagueOffline: "الدوري غير متاح دون اتصال.", leagueYou: "أنت", leagueRename: "تغيير الاسم", leagueNameHint: "اسمك في الدوري", leagueOutside: "أنت: {xp} نقطة (خارج الأوائل)", leagueSave: "حفظ", leagueResets: "يبدأ من جديد كل أسبوع" },
};
