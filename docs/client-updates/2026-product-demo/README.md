# Полный демо-ролик продукта (RU)

Кинетический демо-ролик ~105 с с телефонами/планшетами: гостевое меню (реальные скрины Woodly), конструктор акций, расписание, лояльность, доставка и iiko.

## Файлы

| Путь | Назначение |
|------|------------|
| [STORYBOARD.md](./STORYBOARD.md) | Тайминг битов |
| [film/](./film/) | HyperFrames-проект |
| [film/out/menu-product-demo-ru.mp4](./film/out/menu-product-demo-ru.mp4) | Готовый MP4 |
| [film/assets/screens/](./film/assets/screens/) | Скрины гостевого приложения |

Короткий ролик только про обновления акций: [`../2026-q2-guest-promotions/`](../2026-q2-guest-promotions/).

## Как поделиться

Отправьте `film/out/menu-product-demo-ru.mp4` в WhatsApp / Telegram / email.

## Пересборка

```bash
cd film
npx hyperframes lint
npx hyperframes check
npx hyperframes render -o out/menu-product-demo-ru.mp4
```

Нужны FFmpeg в PATH и установленный HyperFrames CLI.

## Источник скринов

Гостевые кадры сняты с локального `menu-customer` (`locationId=dec6608c-…`, Woodly).  
Платформа / лояльность / доставка / iiko — стилизованные эмуляции интерфейса (hybrid), когда live-админка недоступна без логина.
