import type { SupportedLanguage } from '@shared/types';

export interface TranslationStrings {
  appName: string;
  tagline: string;
  connectGemini: string;
  geminiConnected: string;
  morningAlerts: string;
  printableGuide: string;
  searchPlaceholder: string;
  winterHotspots: string;
  nearbySensors: string;
  noSensorsNearby: string;
  indoorSensorLabel: string;
  indoorSensorPlaceholder: string;
  ioRatioLabel: string;
  tailorTitle: string;
  tailorSubtitle: string;
  savedProfiles: string;
  saveProfileBtn: string;
  familyHome: string;
  communitySchool: string;
  regeneratePlan: string;
  synthesizingPlan: string;
  tailoredBrief: string;
  directImpactLedger: string;
  allChoices: string;
  lowEmissionRoutines: string;
  indoorAirHacks: string;
  sustainableAlts: string;
  communityPledgesTitle: string;
  communityPledgesSubtitle: string;
  askAdvisorTitle: string;
  askButton: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGE_OPTIONS: Array<{ code: SupportedLanguage; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ur', label: 'Urdu', native: 'اردو' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'pl', label: 'Polish', native: 'Polski' },
  { code: 'es', label: 'Spanish', native: 'Español' },
];

export const TRANSLATIONS: Record<SupportedLanguage, TranslationStrings> = {
  en: {
    appName: 'ClearAir AI',
    tagline: 'Winter Smog & Urban Air Quality Assistant for Families & Communities',
    connectGemini: 'Connect Gemini Key',
    geminiConnected: 'Gemini Connected',
    morningAlerts: 'Morning Alerts',
    printableGuide: 'Printable Guide',
    searchPlaceholder: 'Search any city or neighborhood (e.g., Nagpur, New Delhi, Denver)...',
    winterHotspots: 'Winter Smog Hotspots:',
    nearbySensors: 'Nearby Ground Stations',
    noSensorsNearby: 'No public street sensors within 25 km — using modeled Open-Meteo telemetry',
    indoorSensorLabel: 'Indoor PM2.5 Monitor (µg/m³, optional)',
    indoorSensorPlaceholder: 'e.g., 42 (calibrates I/O ratio)',
    ioRatioLabel: 'Indoor/Outdoor Ratio',
    tailorTitle: 'Tailor to Your Lifestyle',
    tailorSubtitle: 'Saved automatically & calibrates exposure.',
    savedProfiles: 'Saved Profiles',
    saveProfileBtn: 'Save As New',
    familyHome: 'Family Home',
    communitySchool: 'Community / School',
    regeneratePlan: 'Regenerate Tailored Plan',
    synthesizingPlan: 'Synthesizing Tailored Plan...',
    tailoredBrief: 'Tailored Daily Action Brief',
    directImpactLedger: 'Direct Impact Ledger',
    allChoices: 'All Choices',
    lowEmissionRoutines: 'Low-Emission Routines',
    indoorAirHacks: 'Indoor Air Quality Hacks',
    sustainableAlts: 'Sustainable Alternatives',
    communityPledgesTitle: 'Shareable Neighborhood & School Pledges',
    communityPledgesSubtitle: 'Rally nearby households and share one-click clean-air commitments.',
    askAdvisorTitle: 'Ask ClearAir GenAI Advisor',
    askButton: 'Ask',
    dir: 'ltr',
  },
  ur: {
    appName: 'ClearAir AI',
    tagline: 'خاندانوں اور برادریوں کے لیے سردیوں کے سموگ اور شہری فضائی آلودگی کا معاون',
    connectGemini: 'Gemini کلید جوڑیں',
    geminiConnected: 'Gemini منسلک ہے',
    morningAlerts: 'صبح کے الرٹس',
    printableGuide: 'پرنٹ گائیڈ',
    searchPlaceholder: 'کوئی بھی شہر تلاش کریں (مثلاً لاہور، دہلی، وارسا)...',
    winterHotspots: 'سموگ کے اہم شہر:',
    nearbySensors: 'قریبی زمینی سینسرز',
    noSensorsNearby: '25 کلومیٹر میں کوئی عوامی سینسر نہیں — ماڈل ڈیٹا استعمال ہو رہا ہے',
    indoorSensorLabel: 'گھر کے اندر PM2.5 ریڈنگ (µg/m³، اختیاری)',
    indoorSensorPlaceholder: 'مثلاً 42 (حقیقی حساب کے لیے)',
    ioRatioLabel: 'اندرونی/بیرونی تناسب',
    tailorTitle: 'اپنے طرز زندگی کے مطابق ڈھالیں',
    tailorSubtitle: 'آپ کی پروفائل خودکار محفوظ رہتی ہے۔',
    savedProfiles: 'محفوظ پروفائلز',
    saveProfileBtn: 'نئی محفوظ کریں',
    familyHome: 'خاندانی گھر',
    communitySchool: 'کمیونٹی / اسکول',
    regeneratePlan: 'نیا منصوبہ بنائیں',
    synthesizingPlan: 'منصوبہ تیار ہو رہا ہے...',
    tailoredBrief: 'آج کا خصوصی سموگ بریف',
    directImpactLedger: 'آپ کے انتخاب کا براہِ راست اثر',
    allChoices: 'تمام تجاویز',
    lowEmissionRoutines: 'کم اخراج والے معمولات',
    indoorAirHacks: 'اندرونی ہوا بہتر بنانے کے طریقے',
    sustainableAlts: 'پائیدار متبادل',
    communityPledgesTitle: 'محلے اور اسکول کے قابلِ اشتراک عہد',
    communityPledgesSubtitle: 'پڑوسیوں کو شامل کریں اور صاف ہوا کا لنک شیئر کریں۔',
    askAdvisorTitle: 'ClearAir AI مشیر سے پوچھیں',
    askButton: 'پوچھیں',
    dir: 'rtl',
  },
  hi: {
    appName: 'ClearAir AI',
    tagline: 'परिवारों और समुदायों के लिए सर्दियों के स्मॉग और शहरी वायु प्रदूषण सहायक',
    connectGemini: 'Gemini कुंजी जोड़ें',
    geminiConnected: 'Gemini जुड़ा है',
    morningAlerts: 'सुबह के अलर्ट',
    printableGuide: 'प्रिंट गाइड',
    searchPlaceholder: 'कोई भी शहर खोजें (जैसे दिल्ली, लाहौर, वारसॉ)...',
    winterHotspots: 'प्रमुख स्मॉग शहर:',
    nearbySensors: 'नज़दीकी ग्राउंड सेंसर',
    noSensorsNearby: '25 किमी के भीतर कोई सार्वजनिक सेंसर नहीं — मॉडल डेटा उपयोग में है',
    indoorSensorLabel: 'इनडोर PM2.5 रीडिंग (µg/m³, वैकल्पिक)',
    indoorSensorPlaceholder: 'उदा. 42 (I/O अनुपात हेतु)',
    ioRatioLabel: 'इनडोर/आउटडोर अनुपात',
    tailorTitle: 'अपनी जीवनशैली के अनुसार चुनें',
    tailorSubtitle: 'प्रोफ़ाइल अपने आप सहेजी जाती है।',
    savedProfiles: 'सहेजी गई प्रोफ़ाइल',
    saveProfileBtn: 'नया सहेजें',
    familyHome: 'परिवार का घर',
    communitySchool: 'समुदाय / स्कूल',
    regeneratePlan: 'नई योजना बनाएं',
    synthesizingPlan: 'योजना तैयार हो रही है...',
    tailoredBrief: 'आज का विशेष स्मॉग सारांश',
    directImpactLedger: 'आपके निर्णयों का सीधा प्रभाव',
    allChoices: 'सभी सुझाव',
    lowEmissionRoutines: 'कम-उत्सर्जन दिनचर्या',
    indoorAirHacks: 'इनडोर हवा सुधार उपाय',
    sustainableAlts: 'टिकाऊ विकल्प',
    communityPledgesTitle: 'साझा करने योग्य मोहल्ला और स्कूल संकल्प',
    communityPledgesSubtitle: 'पड़ोसियों को जोड़ें और स्वच्छ हवा लिंक साझा करें।',
    askAdvisorTitle: 'ClearAir AI सलाहकार से पूछें',
    askButton: 'पूछें',
    dir: 'ltr',
  },
  pl: {
    appName: 'ClearAir AI',
    tagline: 'Asystent AI dla rodzin i społeczności w walce ze smogiem zimowym',
    connectGemini: 'Połącz klucz Gemini',
    geminiConnected: 'Gemini połączony',
    morningAlerts: 'Poranne alerty',
    printableGuide: 'Wersja do druku',
    searchPlaceholder: 'Szukaj miasta (np. Kraków, Warszawa, Salt Lake City)...',
    winterHotspots: 'Ogniska smogu zimowego:',
    nearbySensors: 'Pobliskie czujniki naziemne',
    noSensorsNearby: 'Brak publicznych czujników w promieniu 25 km — dane modelowe Open-Meteo',
    indoorSensorLabel: 'Pomiar PM2.5 w domu (µg/m³, opcjonalnie)',
    indoorSensorPlaceholder: 'np. 42 (kalibruje współczynnik I/O)',
    ioRatioLabel: 'Współczynnik Wewnątrz/Zewnątrz',
    tailorTitle: 'Dopasuj do stylu życia',
    tailorSubtitle: 'Zapisywane automatycznie w przeglądarce.',
    savedProfiles: 'Zapisane profile',
    saveProfileBtn: 'Zapisz jako nowy',
    familyHome: 'Dom rodzinny',
    communitySchool: 'Społeczność / Szkoła',
    regeneratePlan: 'Wygeneruj plan ponownie',
    synthesizingPlan: 'Tworzenie planu...',
    tailoredBrief: 'Dzisiejszy raport smogowy',
    directImpactLedger: 'Bezpośredni wpływ Twoich wyborów',
    allChoices: 'Wszystkie opcje',
    lowEmissionRoutines: 'Niskoemisyjne nawyki',
    indoorAirHacks: 'Czyste powietrze w domu',
    sustainableAlts: 'Ekologiczne alternatywy',
    communityPledgesTitle: 'Sąsiedzkie i szkolne zobowiązania',
    communityPledgesSubtitle: 'Zaproś sąsiadów i udostępnij lokalny cel czystego powietrza.',
    askAdvisorTitle: 'Zapytaj doradcę ClearAir AI',
    askButton: 'Zapytaj',
    dir: 'ltr',
  },
  es: {
    appName: 'ClearAir AI',
    tagline: 'Asistente de IA para familias y comunidades frente al esmog invernal',
    connectGemini: 'Conectar clave Gemini',
    geminiConnected: 'Gemini conectado',
    morningAlerts: 'Alertas matutinas',
    printableGuide: 'Guía imprimible',
    searchPlaceholder: 'Busca una ciudad (ej. Ciudad de México, Madrid, Santiago)...',
    winterHotspots: 'Zonas críticas de esmog:',
    nearbySensors: 'Estaciones terrestres cercanas',
    noSensorsNearby: 'Sin sensores públicos a 25 km — usando datos modelados Open-Meteo',
    indoorSensorLabel: 'Sensor interior PM2.5 (µg/m³, opcional)',
    indoorSensorPlaceholder: 'ej. 42 (calibra relación I/O)',
    ioRatioLabel: 'Relación Interior/Exterior',
    tailorTitle: 'Adapta a tu estilo de vida',
    tailorSubtitle: 'Guardado automático y calibración de exposición.',
    savedProfiles: 'Perfiles guardados',
    saveProfileBtn: 'Guardar nuevo',
    familyHome: 'Hogar familiar',
    communitySchool: 'Comunidad / Escuela',
    regeneratePlan: 'Regenerar plan personalizado',
    synthesizingPlan: 'Generando plan personalizado...',
    tailoredBrief: 'Resumen diario personalizado',
    directImpactLedger: 'Impacto directo de tus decisiones',
    allChoices: 'Todas las opciones',
    lowEmissionRoutines: 'Rutinas de bajas emisiones',
    indoorAirHacks: 'Trucos de aire interior',
    sustainableAlts: 'Alternativas sostenibles',
    communityPledgesTitle: 'Compromisos vecinales y escolares compartibles',
    communityPledgesSubtitle: 'Suma a tu vecindario y comparte metas de aire limpio.',
    askAdvisorTitle: 'Pregunta al asesor ClearAir AI',
    askButton: 'Enviar',
    dir: 'ltr',
  },
};
