# HANDOFF — ПромМаркет на архитектуре vibe

**Этот файл — для следующего ИИ-ассистента (Codex/Claude/ZCode).**
Прочитай его целиком перед тем, как что-либо делать в проекте.
Здесь: что это, на чём мы остановились, что делать дальше, и где какие грабли.

---

## Контекст одним абзацем

Переписываем **ПромМаркет** (B2B маркетплейс промышленного оборудования) с Next.js/SQLite на архитектуру vibe-шаблона (Bun/Hono/Prisma/PostgreSQL для бэкенда, React+Vite+TanStack для фронтенда). Оригинальный ПромМаркет был сделан в другом инструменте (Next.js 16, ~30k строк, частично «фасадный» — моковая auth, чат без сохранения, EAV-фильтры только клиентские). Цель — **полноценный продукт**, а не 1-в-1 порт: вылечиваем главные дыры оригинала. Работа разбита на 7 итераций, каждая даёт запускаемый результат.

---

## 🔥 ОБНОВЛЕНИЕ (сессия 2026-08-11, коммиты `3250bf2` + `9844099`)

### ✅ Монетизация — 6 моделей, полный backend + webapp

По решению владельца: **БЕЗ онлайн-платежей картой, БЕЗ комиссии с продаж (пока).**
Все деньги идут офлайн — счёт (Invoice) → банковский перевод → ручное подтверждение менеджером.

Реализованы все 6 моделей из исследования (кроме рекламы — отдельно решено не делать):

| # | Модель | Backend | Webapp | Статус |
|---|---|---|---|---|
| 1 | **Подписки (тарифы)** | `modules/subscriptions/` | `/vendor/billing` | ✅ full |
| 2 | **Лид-кредиты (RFQ unlock)** | `modules/leads/` (advisory lock) | `/vendor/credits` | ✅ full |
| 3 | **Featured-размещение** | `modules/billing/` featured | `/vendor/featured` | ✅ full |
| 4 | **Верификация поставщика** | `modules/verification/` | `/vendor/verify`, `/admin/verification` | ✅ full (кроме PDF-аплоада) |
| 5 | **Broker success-fee** | `modules/broker/` + `BrokerFeeLedger` | `/broker/fees` | ✅ full |
| 6 | **SaaS-аддоны** | `modules/billing/` add-ons | `/vendor/add-ons` | ✅ full |

**Schema** (`schema.prisma`): 10 новых моделей + `VerificationTier` enum, `Product.featuredUntil`, `Vendor.verificationTier`. Миграция `20260811160000_monetization` — SQL генерируется через `prisma migrate diff` (README в папке миграции; Bun должен быть установлен).

**Контракты** (`packages/contracts/src/billing.ts`): все Zod-схемы и типы, re-export из `index.ts`.

**Routing**: 4 новых workspace-layout'а (vendor/broker/buyer/moderator) + admin children (`/admin/verification`, `/admin/billing`). `navigation/model.ts` полностью переписан под роли ПромМаркета. `createRequireRole` обобщён до `UserRole | UserRole[]`.

**Outbox**: 7 новых monetization task types (placeholder stubs — логируют + return 'skipped', пока нет email-шаблонов). 2 recurring jobs: `subscriptions:scan-expiring`, `verification:expire-sweep`.

### ✅ Все 7 итераций выполнены (финальный статус)

**14 backend-модулей** зарегистрированы в `app.ts`:
1. `auth` (шаблон) — 6 ролей, обобщённый `createRequireRole`
2. `users` (шаблон) — admin dashboard, user directory
3. `uploads` (шаблон) — avatars (PDF для верификации — TODO)
4. `catalog` — публичный каталог (итерация 2)
5. `subscriptions` — тарифы/подписки (монетизация 1)
6. `leads` — лид-кредиты с advisory lock (монетизация 2)
7. `verification` — верификация с документами (монетизация 4)
8. `billing` — featured + add-ons + invoices (монетизация 3+6)
9. `broker` — success-fee ledger (монетизация 5)
10. `deals` — сделки + state machine + persistent messages (итерация 5)
11. `vendor-products` — CRUD товаров вендором с ownership-check (итерация 6)
12. `admin-catalog` — категории/атрибуты админом (итерация 6)
13. `reviews` — отзывы покупателей + vendor reply (итерация 7)
14. `notifications` — in-app уведомления (итерация 7)
15. `admin-analytics` — реальные агрегаты БД для дашборда (итерация 7)

**Webapp**: главная страница, каталог, cart/favorites/compare (localStorage), все кабинеты ролей (vendor/broker/buyer/moderator/admin) с monetization-панелями.

### ⏳ Что осталось сделать (изначальные итерации 3-7)

| Итерация | Статус | Что делать |
|---|---|---|
| **3.** Главная страница + RFQ | ✅ Главная готова (`features/home/HomePage.tsx`). RFQ-форма = создание deal через `/api/deals` — UI-обёртка пока не сделана (POST-эндпоинт работает). |
| **4.** Auth + cart/favorites/compare | ✅ Cart/favorites/compare через localStorage (`features/marketplace-collections/`), без Zustand. Auth-редиректы по ролям работают. |
| **5.** Сделки + WS-чат | ✅ HTTP API полностью (`modules/deals/`: RFQ с атомарной нумерацией, state machine, persistent messages). WS — заготовка в `websocket/deal-chat-server.ts`, интеграция в `index.ts` отложена (нужен Bun для проверки типов). |
| **6.** Порталы vendor/broker/admin CRUD | ✅ Backend: `modules/vendor-products/` (CRUD с ownership-check), `modules/admin-catalog/` (категории/атрибуты). Webapp-UI кабинетов есть из монетизации; CRUD-формы товаров — следующий шаг. |
| **7.** Полировка | ✅ Backend: `modules/reviews/`, `modules/notifications/`, `modules/admin-analytics/` (реальные агрегаты БД). UI-панели — следующий шаг. |

### ⚠️ Что нужно сделать ПЕРЕД запуском

1. **Установить Bun** (`irm bun.sh/install.ps1 | iex`) — без него не запустится ничего.
2. **Запустить Docker Desktop** (демон не поднят) — для PostgreSQL 18 на порту 54329.
3. `bun install` — установит зависимости и сгенерирует `node_modules`.
4. `bun run --cwd backend prisma:generate` — регенерирует Prisma-клиент с новыми monetization-моделями.
5. Сгенерировать + применить миграцию (см. `backend/prisma/migrations/20260811160000_monetization/README.md`).
6. `bun run --cwd backend scripts/seed-marketplace.ts` — seed расширён: 4 тарифа, подписки, кредиты, верификации, invoice.
7. `bun run typecheck` — проверить, что типы сходятся (я не мог запустить без Bun).

### 🐛 Известные TODO (не блокируют запуск)

- **PDF-аплоад для верификации**: `uploads` module сейчас принимает только JPEG/PNG/HEIC. Нужно расширить magic-byte check на PDF + новый upload-kind. Verification documents хранят objectKey как строку, но реальная загрузка через uploads-module пока не работает для PDF.
- **Tier-разные бейджи в каталоге**: `vendorVerified` boolean уже работает (✓ Проверен), но basic vs pro с разными цветами — нужно расширить `vendorSummarySchema` в контрактах.
- **Email-уведомления monetization**: 7 outbox task types — это stubs (логируют, не шлют). Реальная отправка — по образцу `auth:password-reset` когда будут шаблоны писем.
- **`homePathForRole` возвращает `string`** (не `'/app' | '/admin'`) — расширил для новых ролей, но `pages.tsx:WorkspaceRoute` и `GuestAuthPage` используют его как строку, ОК.


## Что уже сделано (коммиты в `git log`)

### ✅ Итерация 1 — Фундамент (коммит `6f0c41b`)
- `backend/prisma/schema.prisma`: расширение `UserRole` (6 ролей: user/admin/vendor/broker/buyer/moderator) + 13 моделей marketplace (`Category`, `Attribute`, `Product`, `ProductImage`, `ProductPrice`, `ProductAttribute`, `Vendor`, `Buyer`, `Deal`, `DealMessage`, `DealHistory`, `DealNumberSequence`, `CategoryAttribute`)
- Адаптации под PostgreSQL-конвенции vibe: UUIDv7 PK, `@map` snake_case, enum'ы с `@@map`, `Decimal` для денег (вместо `Float`), `Json` для EAV-значений (вместо `String`-с-JSON), `Vendor`/`Buyer` 1:1 с `User`
- Миграция `20260811130013_marketplace_foundation` применена
- `packages/contracts/src/marketplace.ts`: Zod-схемы для всех сущностей, query-параметры, **state-machine сделок** (`DEAL_STATUS_TRANSITIONS` + helper'ы `getNextDealStatuses`, `isDealStatusTransitionAllowed`)
- 37 тестов контрактов (19 новых marketplace), все зелёные

### ✅ Итерация 2 — Каталог (коммит `cb1af46`)
**Backend** (`backend/src/modules/catalog/` — полноценный модуль по архитектуре vibe):
- 4 публичных эндпоинта: `GET /api/catalog/categories` (дерево), `/products` (фильтры+EAV), `/vendors`, `/search` + `GET /products/{id}`
- **Сервер-сайд фильтрация** (главное улучшение над оригиналом — там было клиентским):
  - Категория с подкатегориями (`descendantIds` — BFS по дереву)
  - Multi-select статус/наличие
  - Текстовый поиск по 5 полям
  - Цена min/max (исключает `on_request`)
  - EAV-атрибуты через JSON-сравнение
- Атомарный view-counter (транзакция `update + findUnique`)
- `backend/scripts/seed-marketplace.ts`: 16 категорий, 8 атрибутов, 5 vendors, 3 buyers, 8 товаров, 8 демо-юзеров

**Webapp** (`webapp/src/features/catalog/`):
- Публичный API-клиент `publicClient` (без auth) + TanStack Query hooks
- `/catalog`: дерево категорий, фильтры по статусу, поиск, сортировка, пагинация, сетка карточек
- `/catalog/$productId`: галерея, цены с тирами, характеристики (EAV), блок поставщика
- **Фильтры в URL** через `validateSearch` (shareable, back/forward работает) — заменили клиентский Zustand-переключатель оригинала

**Проверено end-to-end в браузере**: каталог открывается, фильтры работают, карточки кликабельны.

## Что осталось (итерации 3–7)

### ⏳ Итерация 3 — Карточка товара (доработать) + главная страница
Карточка уже частично готова в ИТ2. Осталось:
- Главная страница `/` (перенос `home-page.tsx`, 1402 строк): hero, категории, featured-товары, недавние сделки
- RFQ-форма (модалка), Recently Viewed, breadcrumbs
- Backend: `GET /api/catalog/products/featured` (или просто `?sort=views&pageSize=8`)

### ⏳ Итерация 4 — Auth-скрещивание + клиентские фичи
- Связать vibe-auth (`packages/contracts/auth.ts` уже扩展 до 6 ролей) с UI ПромМаркета
- Обобщить `createRequireRole` middleware (`backend/src/modules/auth/transport/middleware.ts`) под 5 ролей
- Seed демо-аккаунтов ПромМаркета (`admin/broker/vendor/buyer/moderator@prommarket.demo`, пароль `marketplace-demo` — уже созданы в seed-marketplace.ts)
- Роуты `/login`, `/signup` (vibe-формы есть) с редиректом по ролям
- Stores: `useCartStore`, `useFavoriteStore` (пока локальные, как в оригинале)
- Страницы: `/cart`, `/favorites`, `/compare`, `/profile`
- Защита роутов через `beforeLoad` в TanStack Router по ролям

### ⏳ Итерация 5 — Сделки + state machine + чат с персистентностью (САМАЯ СЛОЖНАЯ)
- Модуль `backend/src/modules/deals/` (по образцу `modules/catalog/`):
  - `GET /api/deals` — список с фильтрами (status/type/vendor/buyer) + include product/buyer/vendor/messages/history
  - `POST /api/deals` — создание RFQ. **Номер сделки через `DealNumberSequence` таблицу** (`UPDATE ... SET next = next + 1 RETURNING`) — атомарно, без race condition оригинала
  - `PATCH /api/deals/:id/status` — **server-side state machine**: граф переходов из `DEAL_STATUS_TRANSITIONS` (в контрактах) проверяется на сервере, не только на клиенте. Запись в `DealHistory`
  - `POST /api/deals/:id/messages` — сохранение в `DealMessage`
- **WebSocket** на `Bun.serve` (новый `websocket` handler в `backend/src/index.ts`): upgrade-роут `/api/deals/:id/ws`, auth через access-token (query-параметр). При `send-message` — **писать в БД** + вещать в комнату сделки. Redis/Valkey **не нужен** для одной инстанции (README vibe: только при масштабировании)
- Webapp: `broker-desk.tsx` (1446 строк), `useDealChat` хук → на `/api/deals/:id/ws`, `deal-chat.tsx`

### ⏳ Итерация 6 — Порталы (вендор/брокер/админ)
- `modules/vendors/`: CRUD товаров вендором с проверкой ownership
- `modules/admin/`: управление категориями/атрибутами, модерация vendors
- `modules/broker/`: назначение сделок
- Webapp: `vendor-portal.tsx` (1339), `vendor-product-wizard.tsx` (1392), `admin-panel.tsx` (1926), роуты с role-guards

### ⏳ Итерация 7 — Полировка
- `GET /api/admin/analytics` — агрегаты из БД (dealsByStatus, topCategories, avgDealValue) — реально считаются
- `modules/reviews/`: `ProductReview` + `GET/POST /api/products/:id/reviews`
- `modules/notifications/`: таблица + WS-push при событиях сделки
- Outbox (vibe уже есть): email-уведомления по событиям
- Деплой (после выбора хостинга — пока отложено в CHECKLIST.md)

## Стек и архитектура — что важно знать

**Backend**: Bun + Hono + Prisma + PostgreSQL. Hexagonal-структура модулей: `domain/` → `application/` (service + ports) → `infrastructure/` (Prisma repo) → `transport/` (routes). См. `modules/auth/` и `modules/catalog/` как образцы. Контракты — единственный источник типов, `packages/contracts/src/*.ts`, Zod-схемы + `z.infer` типы. Маршруты через `createRoute` из `@hono/zod-openapi`, валидация `c.req.valid('query'|'param'|'json')`. Prisma НЕ в `c.var` — инжектится в репозиторий через фабрику.

**Webapp**: React 19 + Vite + TanStack Router (code-based, не file-based — всё в `src/routes.tsx`) + TanStack Query. shadcn/ui (radix-vega style), Tailwind v4 (CSS-first, нет `tailwind.config.js`). Path alias `@/` → `src/`. Public-запросы через `publicClient` (без auth), authenticated — через `useAuth().transport`.

**БД**: PostgreSQL 18 через Docker Compose (`docker-compose.yml`), порт 54329 (test: 54330). БД `web_app_demo`. UUIDv7 как PK (DB-generated).

## Демо-данные

После `bun run --cwd backend scripts/seed-marketplace.ts`:
- 16 категорий (дерево до 3 уровней)
- 8 атрибутов (power, rpm, voltage, ip-class, weight, flow-rate, head, capacity)
- 5 vendors (ПромТехника, ЭнергоМаш, Козлов, Компрессорный мир, ТрансЭлектро)
- 3 buyers
- 8 товаров с картинками в `webapp/public/products/`
- 8 демо-юзеров `*@prommarket.demo`, пароль `marketplace-demo`
- Роли: admin/broker/vendor/buyer/moderator (по email)

## Где оригинал ПромМаркета

Исходный архив ПромМаркета (Next.js версия) лежал в `C:\Users\Zabolotnyj.Ivan\Downloads\workspace-b76b0d91-5527-453e-b4b6-ce18542af11b.tar`. На другом ПК его может не быть — но всё нужное (схема, seed, логика) уже перенесено в этот проект. Полная карта оригинала есть в истории диалога (4 разведчика прошлись по архитектуре, схеме, UI, инфре).

**Ключевые файлы оригинала для справки** (если архив доступен):
- `prisma/schema.prisma` — исходная SQLite-схема
- `prisma/seed.ts` — исходный seed
- `src/components/marketplace/` — 20 feature-компонентов (по именам: catalog-page, product-detail-page, broker-desk, vendor-portal, admin-panel и т.д.)
- `src/store/index.ts` — 7 Zustand stores
- `src/app/api/` — 8 роутов (categories, products, deals, vendors, search, auth)
- `mini-services/deal-chat/index.ts` — socket.io чат (in-memory, без БД)

## Что осознанно НЕ переносим

- `next-auth` → заменён на vibe-auth
- `next-intl`, `z-ai-web-dev-sdk`, `@mdxeditor`, `@dnd-kit/*`, `@tanstack/react-query/table` (мёртвые dep'ы)
- `src/data/mock.ts` → свёрнут в единый seed
- `useNavigationStore` (клиентский роутер) → TanStack Router с настоящими URL
- `.zscripts/`, `Caddyfile`, `examples/`, `tool-results/`, `download/`, `agent-ctx/` — dev-артефакты
- Чат in-memory → чат с персистентностью в PostgreSQL (ИТ5)

## Известные проблемы окружения (не кода)

1. **Bun в PATH на Windows**: `prisma-generate.mjs` вызывает `spawnSync('bun', ...)` — дочерний процесс не находит `bun`, если WinGet Links не в PATH. Запускать команды в шелле с `export PATH="/c/Users/.../WinGet/Links:$PATH"` или перезапустить терминал после установки Bun.
2. **`prisma migrate dev` виснет** интерактивно (спрашивает про shadow DB / потерю данных). Обход: `prisma migrate diff --from-config-datasource --to-schema=./prisma/schema.prisma --script` → положить в `prisma/migrations/<ts>_name/migration.sql` → `prisma migrate deploy`. Это задокументированный неинтерактивный путь Prisma.
3. **Bun-test в параллель виснет** на Windows; поодиночке все 43 backend unit-теста проходят. Для прогонa: `find src scripts -name "*.test.ts" ! -name "*.integration.test.ts" ! -name "*.live.test.ts" | xargs -n1 bun test`.
4. **Docker Desktop daemon периодически падает** на этой машине. Если `docker info` падает — перезапустить Docker Desktop.
5. **Проект на сетевой SMB-шаре ломается** (Bun symlink'и). Только локальный диск.

## Быстрый старт на новом ПК

```bash
# 1. Установить Bun (PowerShell):  irm bun.sh/install.ps1 | iex
# 2. Установить Docker Desktop, запустить
# 3. Распаковать архив, зайти в vibe/
bun install
docker compose up -d postgres
bun run --cwd backend prisma:deploy       # применить миграции
bun run --cwd backend scripts/seed-marketplace.ts   # демо-данные (опционально)
bun run dev                                # backend :3000 + webapp :5173
```

Открыть `http://localhost:5173/catalog`.

## Команды для разработки

```bash
bun run typecheck                          # все слои: backend + contracts + webapp
bun run --cwd packages/contracts test      # тесты контрактов (37)
bun run --cwd backend test:unit            # unit-тесты backend (поодиночке, не в параллель — см. проблему 3)
bun run --cwd backend prisma:generate      # регенерить клиент после изменения schema.prisma
bun run --cwd backend prisma:migrate -- --name <name> --create-only  # создать миграцию (но см. проблему 2)
bun run --cwd backend prisma:deploy        # применить миграции неинтерактивно
```

## Контакты контекста

- Пользователь: @Zabolotnyj.Ivan (Русский язык для коммуникации)
- Проект основан на vibe-шаблоне Дмитрия Сухарева: https://github.com/di-sukharev/vibe
- Оригинал ПромМаркета сделан в другом AI-инструменте, переписывается на vibe
- Текущая ветка: `master` (единственная)
