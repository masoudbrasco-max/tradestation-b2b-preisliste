window.APP_CONFIG = {
  appName: "TradeStation Ersatzteile",
  currency: "EUR",
  locale: "de-DE",
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2R3O4d67rRnfVkau6dRZlFxdjttwUsLDbNBVgaCU5dHWaNdQhYLcW1i1qw5xhCQ/pub?gid=1018114951&single=true&output=csv",
  fallbackCsvUrl: "data/preisliste.csv",
  defaultLocation: "Offenbach",
  locations: [
    {
      id: "offenbach",
      name: "Offenbach",
      whatsappField: "WhatsAppOffenbach",
      fallbackWhatsApp: "4915238242082",
      mapsField: "StandortOffenbachGoogleMaps"
    },
    {
      id: "kassel",
      name: "Kassel",
      whatsappField: "WhatsAppKassel",
      fallbackWhatsApp: "491772897314",
      mapsField: "StandortKasselGoogleMaps"
    }
  ],
  hiddenDisplayModelsForOled: ["iPhone 8", "iPhone 8 Plus", "iPhone XR", "iPhone 11"],
  diagnosticBatteryMinimumModel: 12
};
