// Настройки приложения. Здесь нет секретов: этот файл будет виден всем.
window.APP_CONFIG = {
  // Адрес Google Apps Script (появится позже). Пока пусто, приложение работает в ДЕМО-режиме.
  API_URL: "https://script.google.com/macros/s/AKfycbyQnZv8NvfkZkmBscpqDMH7Myk8FmnZMga-i1Ynlou-6gwdNvQn7OBMET-I_ZnwHYIrbg/exec",

  currency: "смн",
  daysAhead: 14, // на сколько дней вперёд можно записаться

  barber: {
    name: "Белов",
    title: "Барбер",
    experience: "8 лет опыта",
    rating: 4.9,
    reviews: 127,
    address: "г. Душанбе, ул. Рудаки, 45",
    mapUrl: "https://maps.google.com/?q=Душанбе+Рудаки+45",
    phone: "+992900000000",
    phoneText: "+992 900 00 00 00",
    telegram: "belov_barber" // username в Telegram без @
  },

  // Портфолио: позже сюда можно вписать ссылки на фото, например "img/work1.jpg"
  portfolio: [
    { title: "Фейд", tone: "a" },
    { title: "Классика", tone: "b" },
    { title: "Борода", tone: "c" },
    { title: "Текстура", tone: "d" },
    { title: "Кроп", tone: "e" }
  ]
};
