window.APP_CONFIG = {
  appName: "tradestation b2b Ersatzteile",
  currency: "EUR",
  locale: "de-DE",
  priceListUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2R3O4d67rRnfVkau6dRZlFxdjttwUsLDbNBVgaCU5dHWaNdQhYLcW1i1qw5xhCQ/pub?gid=1018114951&single=true&output=csv",
  fallbackPriceListUrl: "data/preisliste.csv",
  defaultLocation: "Offenbach",
  locations: [
    {
      id: "offenbach",
      name: "Offenbach",
      city: "Offenbach am Main",
      whatsappField: "WhatsAppOffenbach",
      fallbackWhatsApp: "4915238242082",
      mapsField: "StandortOffenbachGoogleMaps",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=tradestation%20Offenbach%20am%20Main"
    },
    {
      id: "kassel",
      name: "Kassel",
      city: "Kassel",
      whatsappField: "WhatsAppKassel",
      fallbackWhatsApp: "491772897314",
      mapsField: "StandortKasselGoogleMaps",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=tradestation%20Kassel"
    },
    {
      id: "goettingen",
      name: "Göttingen",
      city: "Göttingen",
      whatsappField: "WhatsAppGoettingen",
      fallbackWhatsApp: "4915238242082",
      fallbackLocationName: "Offenbach",
      mapsField: "StandortGoettingenGoogleMaps",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=tradestation%20G%C3%B6ttingen"
    }
  ],
  hiddenDisplayModelsForOled: ["iPhone 8", "iPhone 8 Plus", "iPhone XR", "iPhone 11"],
  diagnosticBatteryMinimumModel: 12
};
