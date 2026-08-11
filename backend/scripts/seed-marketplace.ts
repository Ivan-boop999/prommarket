import 'dotenv/config'

import { createPrisma } from '../src/db'

/**
 * Marketplace development seed.
 *
 * Ported from the original ПромМаркет seed.ts, adapted to the vibe schema:
 *  - enum values are lowercase (new/used/... in_stock/on_order fixed/...).
 *  - EAV attribute values are typed JSON (number for NUMBER attrs, string for
 *    SELECT) instead of the original's JSON-in-a-String.
 *  - prices are numbers; Prisma converts them to Decimal.
 *  - Vendor and Buyer profiles are linked 1:1 to User rows, because the vibe
 *    schema makes auth the source of identity. Demo users are created with
 *    argon2id password hashes (password: "marketplace-demo") so the login flow
 *    works end-to-end once iteration 4 wires auth into the webapp.
 *
 * Run with: DATABASE_URL=... bun scripts/seed-marketplace.ts
 */

const DEMO_PASSWORD = 'marketplace-demo'

const db = createPrisma(
  process.env.DATABASE_URL ??
    'postgresql://superuser:superpassword@localhost:54329/web_app_demo?schema=public',
)

async function main() {
  console.log('🌱 Seeding marketplace data...')

  // Clear marketplace tables in dependency order. Auth users created here are
  // also removed so the seed is idempotent across reruns.
  await db.brokerFeeLedger.deleteMany()
  await db.vendorAddOn.deleteMany()
  await db.featuredPlacement.deleteMany()
  await db.leadCreditLedger.deleteMany()
  await db.verificationDocument.deleteMany()
  await db.verificationRequest.deleteMany()
  await db.vendorSubscription.deleteMany()
  await db.invoice.deleteMany()
  await db.invoiceNumberSequence.deleteMany()
  await db.dealHistory.deleteMany()
  await db.dealMessage.deleteMany()
  await db.deal.deleteMany()
  await db.dealNumberSequence.deleteMany()
  await db.productPrice.deleteMany()
  await db.productImage.deleteMany()
  await db.productAttribute.deleteMany()
  await db.product.deleteMany()
  await db.categoryAttribute.deleteMany()
  await db.attribute.deleteMany()
  await db.category.deleteMany()
  await db.buyer.deleteMany()
  await db.vendor.deleteMany()
  // Remove the demo users (recognised by email domain) from previous runs.
  await db.user.deleteMany({ where: { email: { endsWith: '@prommarket.demo' } } })

  const passwordHash = await Bun.password.hash(DEMO_PASSWORD)

  // ==================== CATEGORIES ====================
  console.log('  categories…')
  const rootCategories = await Promise.all([
    db.category.create({ data: { name: 'Двигатели', slug: 'dvigateli', description: 'Промышленные двигатели и электроприводы', order: 1, icon: '⚙️', productCount: 245 } }),
    db.category.create({ data: { name: 'Насосное оборудование', slug: 'nasosnoe-oborudovanie', description: 'Промышленные насосы и насосные установки', order: 2, icon: '🔧', productCount: 189 } }),
    db.category.create({ data: { name: 'Компрессоры', slug: 'kompresory', description: 'Промышленные компрессорные установки', order: 3, icon: '🌬️', productCount: 134 } }),
    db.category.create({ data: { name: 'Металлообрабатывающие станки', slug: 'stanki', description: 'Станки для обработки металлов', order: 4, icon: '🏭', productCount: 167 } }),
    db.category.create({ data: { name: 'Трансформаторы и электрощиты', slug: 'transformatory', description: 'Электротехническое оборудование', order: 5, icon: '🔌', productCount: 112 } }),
    db.category.create({ data: { name: 'Запасные части', slug: 'zapchasti', description: 'Комплектующие и запчасти', order: 6, icon: '🧩', productCount: 534 } }),
    db.category.create({ data: { name: 'Грузоподъёмное оборудование', slug: 'gruzopodemnoe', description: 'Краны, тали и подъёмные механизмы', order: 7, icon: '🏗️', productCount: 89 } }),
    db.category.create({ data: { name: 'Сварочное оборудование', slug: 'svarochnoe', description: 'Сварочные аппараты', order: 8, icon: '⚡', productCount: 76 } }),
  ])
  const [catEngines, catPumps, catComp, catMachines, catTrans, catParts, catCranes] = rootCategories

  const catElectricMotors = await db.category.create({ data: { name: 'Электродвигатели', slug: 'elektrodvigateli', description: 'Асинхронные, синхронные и специальные', order: 1, icon: '⚡', productCount: 128, parentId: catEngines.id } })
  const catCombustion = await db.category.create({ data: { name: 'Двигатели внутреннего сгорания', slug: 'dvs', description: 'Дизельные, газовые и бензиновые ДВС', order: 2, icon: '🔥', productCount: 67, parentId: catEngines.id } })
  const catAsync = await db.category.create({ data: { name: 'Асинхронные', slug: 'asinhronnye', order: 1, icon: '🔄', productCount: 78, parentId: catElectricMotors.id } })

  await db.category.create({ data: { name: 'Центробежные насосы', slug: 'centrobezhnye-nasosy', order: 1, icon: '🔄', productCount: 72, parentId: catPumps.id } })
  await db.category.create({ data: { name: 'Винтовые компрессоры', slug: 'vintovye', order: 1, icon: '🔄', productCount: 58, parentId: catComp.id } })
  await db.category.create({ data: { name: 'Токарные станки', slug: 'tokarnye', order: 1, icon: '🔧', productCount: 89, parentId: catMachines.id } })
  await db.category.create({ data: { name: 'Силовые трансформаторы', slug: 'silovye-transformatory', order: 1, icon: '⚡', productCount: 45, parentId: catTrans.id } })
  await db.category.create({ data: { name: 'Подшипники', slug: 'podshipniki', order: 1, icon: '⚙️', productCount: 234, parentId: catParts.id } })

  // ==================== ATTRIBUTES ====================
  console.log('  attributes…')
  const attrs = await Promise.all([
    db.attribute.create({ data: { name: 'Мощность', slug: 'power', type: 'number', unit: 'кВт', isFilterable: true, order: 1 } }),
    db.attribute.create({ data: { name: 'Частота вращения', slug: 'rpm', type: 'number', unit: 'об/мин', isFilterable: true, order: 2 } }),
    db.attribute.create({ data: { name: 'Напряжение', slug: 'voltage', type: 'number', unit: 'В', isFilterable: true, order: 3 } }),
    db.attribute.create({ data: { name: 'Класс защиты', slug: 'ip-class', type: 'select', options: ['IP44', 'IP54', 'IP55', 'IP56', 'IP65'], isFilterable: true, order: 7 } }),
    db.attribute.create({ data: { name: 'Масса', slug: 'weight', type: 'number', unit: 'кг', isFilterable: false, order: 9 } }),
    db.attribute.create({ data: { name: 'Подача', slug: 'flow-rate', type: 'number', unit: 'м³/ч', isFilterable: true, order: 4 } }),
    db.attribute.create({ data: { name: 'Напор', slug: 'head', type: 'number', unit: 'м', isFilterable: true, order: 5 } }),
    db.attribute.create({ data: { name: 'Производительность', slug: 'capacity', type: 'number', unit: 'м³/мин', isFilterable: true, order: 6 } }),
  ])

  await db.categoryAttribute.createMany({
    data: [
      { categoryId: catEngines.id, attributeId: attrs[0].id },
      { categoryId: catEngines.id, attributeId: attrs[1].id },
      { categoryId: catEngines.id, attributeId: attrs[2].id },
      { categoryId: catEngines.id, attributeId: attrs[3].id },
      { categoryId: catEngines.id, attributeId: attrs[4].id },
      { categoryId: catPumps.id, attributeId: attrs[0].id },
      { categoryId: catPumps.id, attributeId: attrs[5].id },
      { categoryId: catPumps.id, attributeId: attrs[6].id },
    ],
  })

  // ==================== VENDORS + BUYERS (linked to demo users) ====================
  console.log('  vendors and buyers…')
  const vendorUsers = await Promise.all([
    db.user.create({ data: { email: 'promtechnika@prommarket.demo', passwordHash, displayName: 'Менеджер ПромТехника', role: 'vendor' } }),
    db.user.create({ data: { email: 'energomash@prommarket.demo', passwordHash, displayName: 'Отдел продаж ЭнергоМаш', role: 'vendor' } }),
    db.user.create({ data: { email: 'kozlov@prommarket.demo', passwordHash, displayName: 'Козлов С.А.', role: 'vendor' } }),
    db.user.create({ data: { email: 'compmir@prommarket.demo', passwordHash, displayName: 'Компрессорный мир', role: 'vendor' } }),
    db.user.create({ data: { email: 'transelectro@prommarket.demo', passwordHash, displayName: 'ТрансЭлектро', role: 'vendor' } }),
  ])

  const vendors = await Promise.all([
    db.vendor.create({
      data: {
        userId: vendorUsers[0].id,
        companyName: 'ООО «ПромТехника»', inn: '7712345678', ogrn: '1177700000001',
        description: 'Крупнейший поставщик промышленного двигателестроительного оборудования. Более 15 лет на рынке.',
        verified: true, verificationTier: 'pro', rating: 4.8, totalDeals: 234,
        contactName: 'Иванов Алексей Петрович', contactEmail: 'info@promtechnika.ru', contactPhone: '+7 (495) 123-45-67', city: 'Москва',
      },
    }),
    db.vendor.create({
      data: {
        userId: vendorUsers[1].id,
        companyName: 'АО «ЭнергоМаш»', inn: '7709876543', ogrn: '1027700000002',
        description: 'Производитель и поставщик насосного оборудования для нефтегазовой промышленности.',
        verified: true, verificationTier: 'pro', rating: 4.6, totalDeals: 178,
        contactName: 'Петрова Мария Ивановна', contactEmail: 'sales@energomash.ru', contactPhone: '+7 (812) 234-56-78', city: 'Санкт-Петербург',
      },
    }),
    db.vendor.create({
      data: {
        userId: vendorUsers[2].id,
        companyName: 'ИП Козлов С.А.', inn: '501234567890', ogrn: '3185000000003',
        description: 'Поставщик б/у и восстановленного промышленного оборудования.',
        verified: true, verificationTier: 'basic', rating: 4.3, totalDeals: 89,
        contactName: 'Козлов Сергей Андреевич', contactEmail: 'kozlov@used-prom.ru', contactPhone: '+7 (4852) 34-56-78', city: 'Ярославль',
      },
    }),
    db.vendor.create({
      data: {
        userId: vendorUsers[3].id,
        companyName: 'ООО «Компрессорный мир»', inn: '7312345678', ogrn: '1157300000004',
        description: 'Специализированный поставщик компрессорного оборудования.',
        verified: true, verificationTier: 'basic', rating: 4.7, totalDeals: 156,
        contactName: 'Смирнов Дмитрий Николаевич', contactEmail: 'info@comp-mir.ru', contactPhone: '+7 (727) 123-45-67', city: 'Новосибирск',
      },
    }),
    db.vendor.create({
      data: {
        userId: vendorUsers[4].id,
        companyName: 'ООО «ТрансЭлектро»', inn: '6609876543', ogrn: '1166600000005',
        description: 'Поставщик трансформаторов и электрощитового оборудования.',
        verified: false, rating: 4.1, totalDeals: 67,
        contactName: 'Кузнецова Ольга Владимировна', contactEmail: 'sales@transelectro.ru', contactPhone: '+7 (343) 234-56-78', city: 'Екатеринбург',
      },
    }),
  ])

  const buyerUsers = await Promise.all([
    db.user.create({ data: { email: 'machstroy@prommarket.demo', passwordHash, displayName: 'Закупки МашСтройПром', role: 'buyer' } }),
    db.user.create({ data: { email: 'neftehimproekt@prommarket.demo', passwordHash, displayName: 'Снабжение НефтехимПроект', role: 'buyer' } }),
    db.user.create({ data: { email: 'nikolaev@prommarket.demo', passwordHash, displayName: 'Николаев В.П.', role: 'buyer' } }),
  ])

  const buyers = await Promise.all([
    db.buyer.create({
      data: {
        userId: buyerUsers[0].id,
        companyName: 'ООО «МашСтройПром»', inn: '6612345678', ogrn: '1166600000011',
        contactName: 'Белов Игорь Сергеевич', contactEmail: 'procurement@machstroy.ru', contactPhone: '+7 (343) 345-67-89', city: 'Екатеринбург',
      },
    }),
    db.buyer.create({
      data: {
        userId: buyerUsers[1].id,
        companyName: 'АО «НефтехимПроект»', inn: '5501234567', ogrn: '1025500000022',
        contactName: 'Федорова Анна Юрьевна', contactEmail: 'supply@neftehimproekt.ru', contactPhone: '+7 (846) 456-78-90', city: 'Самара',
      },
    }),
    db.buyer.create({
      data: {
        userId: buyerUsers[2].id,
        companyName: 'ИП Николаев В.П.', inn: '781234567890', ogrn: '3187800000033',
        contactName: 'Николаев Виктор Петрович', contactEmail: 'nikolaev@vp.ru', contactPhone: '+7 (812) 567-89-01', city: 'Санкт-Петербург',
      },
    }),
  ])

  // ==================== PRODUCTS ====================
  console.log('  products…')
  const [v0, v1, v2, v3, v4] = vendors
  await Promise.all([
    db.product.create({
      data: {
        title: 'Электродвигатель АИР200М4 30 кВт 1500 об/мин', slug: 'elektrodvigatel-air200m4-30kw',
        description: 'Асинхронный электродвигатель с короткозамкнутым ротором. Трёхфазный, общепромышленного назначения.',
        sku: 'АИР200М4-30/1500', oemNumber: 'AIR200M4-30', brand: 'ВЭМЗ', model: 'АИР200М4', year: 2023,
        status: 'new', availability: 'in_stock', leadTime: '1-3 дня', categoryId: catAsync.id, vendorId: v0.id, views: 342,
        images: { create: [
          { url: '/products/electric-motor.png', alt: 'Электродвигатель АИР200М4', order: 0, isPrimary: true },
          { url: '/products/electric-motor.png', alt: 'Электродвигатель — вид сбоку', order: 1, isPrimary: false },
        ] },
        attributes: { create: [
          { attributeId: attrs[0].id, value: 30 },
          { attributeId: attrs[1].id, value: 1500 },
          { attributeId: attrs[2].id, value: 380 },
          { attributeId: attrs[3].id, value: 'IP55' },
          { attributeId: attrs[4].id, value: 185 },
        ] },
        prices: { create: [
          { type: 'fixed', price: 285000, currency: 'RUB', includesVat: true, vatRate: 20 },
          { type: 'volume', price: 265000, currency: 'RUB', includesVat: true, vatRate: 20, volumeFrom: 5, volumeTo: 10 },
          { type: 'volume', price: 245000, currency: 'RUB', includesVat: true, vatRate: 20, volumeFrom: 11 },
        ] },
      },
    }),
    db.product.create({
      data: {
        title: 'Насос центробежный КМ 80/200 55 кВт', slug: 'nasos-km80-200-55kw',
        description: 'Консольно-моноблочный центробежный насос для перекачки воды и нейтральных жидкостей.',
        sku: 'КМ80/200-55', oemNumber: 'KM-80-200-55', brand: 'ГМС Насосы', model: 'КМ 80/200', year: 2022,
        status: 'new', availability: 'in_stock', leadTime: '3-5 дней', categoryId: catPumps.id, vendorId: v1.id, views: 218,
        images: { create: [{ url: '/products/centrifugal-pump.png', alt: 'Насос КМ 80/200', order: 0, isPrimary: true }] },
        attributes: { create: [
          { attributeId: attrs[0].id, value: 55 },
          { attributeId: attrs[5].id, value: 50 },
          { attributeId: attrs[6].id, value: 50 },
          { attributeId: attrs[4].id, value: 320 },
        ] },
        prices: { create: [{ type: 'fixed', price: 456000, currency: 'RUB', includesVat: true, vatRate: 20 }] },
      },
    }),
    db.product.create({
      data: {
        title: 'Компрессор винтовой Atlas Copco GA30 30 кВт', slug: 'kompresor-atlas-copco-ga30',
        description: 'Винтовой компрессор с регенеративным осушителем. Полностью интегрированное решение.',
        sku: 'GA30-VSD+', oemNumber: '2912-6505-00', brand: 'Atlas Copco', model: 'GA30 VSD+', year: 2021,
        status: 'used', availability: 'in_stock', conditionNote: 'Малая наработка, 4500 моточасов.',
        categoryId: catComp.id, vendorId: v3.id, views: 456,
        images: { create: [{ url: '/products/air-compressor.png', alt: 'Компрессор Atlas Copco GA30', order: 0, isPrimary: true }] },
        attributes: { create: [{ attributeId: attrs[0].id, value: 30 }, { attributeId: attrs[7].id, value: 5.2 }] },
        prices: { create: [{ type: 'fixed', price: 1850000, currency: 'RUB', includesVat: true, vatRate: 20 }] },
      },
    }),
    db.product.create({
      data: {
        title: 'Токарный станок 16К20 (восстановленный)', slug: 'stanok-16k20-vosstanovlennyi',
        description: 'Токарно-винторезный станок 16К20 после полного восстановления.',
        sku: '16К20-Р', brand: 'Станкостроительный завод', model: '16К20', year: 1985,
        status: 'refurbished', availability: 'in_stock', conditionNote: 'Полное восстановление 2024 г.',
        categoryId: catMachines.id, vendorId: v2.id, views: 567,
        images: { create: [{ url: '/products/cnc-lathe.png', alt: 'Токарный станок 16К20', order: 0, isPrimary: true }] },
        attributes: { create: [{ attributeId: attrs[0].id, value: 11 }, { attributeId: attrs[4].id, value: 2850 }] },
        prices: { create: [{ type: 'fixed', price: 680000, currency: 'RUB', includesVat: true, vatRate: 20 }] },
      },
    }),
    db.product.create({
      data: {
        title: 'Трансформатор силовой ТМ-630/10 630 кВА', slug: 'transformator-tm630-10',
        description: 'Масляный трансформатор мощностью 630 кВА.',
        sku: 'ТМ-630/10/0.4', oemNumber: 'TM630-10', brand: 'Электрозавод', model: 'ТМ-630/10', year: 2020,
        status: 'used', availability: 'in_stock', categoryId: catTrans.id, vendorId: v4.id, views: 189,
        images: { create: [{ url: '/products/power-transformer.png', alt: 'Трансформатор ТМ-630/10', order: 0, isPrimary: true }] },
        prices: { create: [{ type: 'on_request', currency: 'RUB', includesVat: true, vatRate: 20 }] },
      },
    }),
    db.product.create({
      data: {
        title: 'Дизельный генератор Cummins C500 D5 500 кВА', slug: 'generator-cummins-c500-d5',
        description: 'Дизельная электростанция в шумозащищённом кожухе.',
        sku: 'C500D5-NC', brand: 'Cummins', model: 'C500 D5', year: 2022,
        status: 'new', availability: 'on_order', leadTime: '6-8 недель', categoryId: catCombustion.id, vendorId: v0.id, views: 623,
        images: { create: [{ url: '/products/air-compressor.png', alt: 'Дизельный генератор Cummins', order: 0, isPrimary: true }] },
        attributes: { create: [{ attributeId: attrs[0].id, value: 500 }] },
        prices: { create: [{ type: 'fixed', price: 8900000, currency: 'RUB', includesVat: true, vatRate: 20 }] },
      },
    }),
    db.product.create({
      data: {
        title: 'Подшипник шариковый 6310-2RS SKF', slug: 'podshipnik-6310-2rs-skf',
        description: 'Двухрядный шариковый подшипник с уплотнениями.',
        sku: '6310-2RS', oemNumber: '6310-2RS1/C3', brand: 'SKF', model: '6310-2RS',
        status: 'new', availability: 'in_stock', leadTime: '1-2 дня', categoryId: catParts.id, vendorId: v0.id, views: 890,
        images: { create: [{ url: '/products/spare-parts.png', alt: 'Подшипник SKF 6310-2RS', order: 0, isPrimary: true }] },
        prices: { create: [
          { type: 'fixed', price: 8500, currency: 'RUB', includesVat: true, vatRate: 20 },
          { type: 'volume', price: 7200, currency: 'RUB', includesVat: true, vatRate: 20, volumeFrom: 10, volumeTo: 50 },
          { type: 'volume', price: 6100, currency: 'RUB', includesVat: true, vatRate: 20, volumeFrom: 51 },
        ] },
      },
    }),
    db.product.create({
      data: {
        title: 'Козловой кран КМ-10 10 тонн', slug: 'kran-kozdovoy-km10',
        description: 'Козловой кран грузоподъёмностью 10 тонн.',
        sku: 'КМ-10/16', brand: 'Саранский крановый завод', model: 'КМ-10', year: 2019,
        status: 'used', availability: 'in_stock', conditionNote: 'На консервации с 2022 г.',
        categoryId: catCranes.id, vendorId: v2.id, views: 312,
        images: { create: [{ url: '/products/cnc-lathe.png', alt: 'Козловой кран КМ-10', order: 0, isPrimary: true }] },
        prices: { create: [{ type: 'on_request', currency: 'RUB', includesVat: true, vatRate: 20 }] },
      },
    }),
  ])

  // ==================== MONETIZATION ====================
  // Reference data + demo state for the six offline-billed monetization models.
  // All amounts are RUB; no online payments — invoices await manual confirmation.
  console.log('  monetization (plans, subscriptions, credits, verification, fees)…')

  // --- Subscription plans (Модель 1) ---
  const plans = await Promise.all([
    db.subscriptionPlan.create({ data: {
      code: 'free', name: 'Старт', description: 'Бесплатный тариф для начала работы.',
      price: 0, currency: 'RUB', billingPeriod: 'monthly', maxProducts: 10,
      includedLeadCredits: 5, hasFeatured: false, hasPrioritySupport: false, isActive: true, sortOrder: 1,
    } }),
    db.subscriptionPlan.create({ data: {
      code: 'basic_monthly', name: 'Базовый', description: 'Расширенный каталог и базовые инструменты.',
      price: 1500, currency: 'RUB', billingPeriod: 'monthly', maxProducts: 100,
      includedLeadCredits: 20, hasFeatured: false, hasPrioritySupport: false, isActive: true, sortOrder: 2,
    } }),
    db.subscriptionPlan.create({ data: {
      code: 'pro_yearly', name: 'Про', description: 'Профессиональный тариф с продвижением и приоритетом.',
      price: 32000, currency: 'RUB', billingPeriod: 'yearly', maxProducts: 10000,
      includedLeadCredits: 200, hasFeatured: true, hasPrioritySupport: true, isActive: true, sortOrder: 3,
    } }),
    db.subscriptionPlan.create({ data: {
      code: 'enterprise_yearly', name: 'Enterprise', description: 'Безлимитный каталог и персональный менеджер.',
      price: 45000, currency: 'RUB', billingPeriod: 'yearly', maxProducts: null,
      includedLeadCredits: 1000, hasFeatured: true, hasPrioritySupport: true, isActive: true, sortOrder: 4,
    } }),
  ])

  // --- Vendor subscriptions ---
  const now = new Date()
  const periodEndPro = new Date(now.getTime() + 320 * 24 * 60 * 60 * 1000)
  const periodEndBasic = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000)
  await db.vendorSubscription.create({ data: {
    vendorId: vendors[0].id, planId: plans[2].id, status: 'active',
    periodStart: now, periodEnd: periodEndPro, amount: 32000, currency: 'RUB',
  } })
  await db.vendorSubscription.create({ data: {
    vendorId: vendors[1].id, planId: plans[2].id, status: 'active',
    periodStart: now, periodEnd: periodEndPro, amount: 32000, currency: 'RUB',
  } })
  await db.vendorSubscription.create({ data: {
    vendorId: vendors[3].id, planId: plans[1].id, status: 'active',
    periodStart: now, periodEnd: periodEndBasic, amount: 1500, currency: 'RUB',
  } })

  // --- Lead credits (Модель 2): opening balances ---
  await db.leadCreditLedger.create({ data: { vendorId: vendors[0].id, delta: 200, reason: 'subscription_grant', balanceAfter: 200 } })
  await db.leadCreditLedger.create({ data: { vendorId: vendors[1].id, delta: 200, reason: 'subscription_grant', balanceAfter: 200 } })
  await db.leadCreditLedger.create({ data: { vendorId: vendors[2].id, delta: 50, reason: 'purchase', balanceAfter: 50 } })
  await db.leadCreditLedger.create({ data: { vendorId: vendors[3].id, delta: 20, reason: 'subscription_grant', balanceAfter: 20 } })

  // --- Verification requests (Модель 4): mixed statuses ---
  await db.verificationRequest.create({ data: {
    vendorId: vendors[4].id, status: 'submitted', requestedTier: 'pro',
    contactName: 'Кузнецова Ольга Владимировна', contactPhone: '+7 (343) 234-56-78',
    message: 'Просим рассмотреть заявку на статус Pro.', submittedAt: now,
  } })
  // A pending invoice for a lead-credit purchase to show in admin/billing.
  await db.invoice.create({ data: {
    number: 'INV-2026-0001', type: 'lead_credits', payerType: 'vendor',
    payerUserId: vendors[2].userId, vendorId: vendors[2].id,
    amount: 5000, currency: 'RUB', status: 'issued', issuedAt: now,
    items: [{ description: 'Покупка 50 лид-кредитов', quantity: 50, unitPrice: '100', total: '5000' }],
  } })

  console.log('✅ Marketplace seed complete!')
  console.log(`   Categories: ${await db.category.count()}`)
  console.log(`   Attributes: ${await db.attribute.count()}`)
  console.log(`   Vendors:    ${await db.vendor.count()}`)
  console.log(`   Buyers:     ${await db.buyer.count()}`)
  console.log(`   Products:   ${await db.product.count()}`)
  console.log(`   Demo users: ${await db.user.count({ where: { email: { endsWith: '@prommarket.demo' } } })} (password: "${DEMO_PASSWORD}")`)
  console.log(`   Subscriptions: ${await db.vendorSubscription.count()} | Plans: ${await db.subscriptionPlan.count()}`)
  console.log(`   Lead credits ledger entries: ${await db.leadCreditLedger.count()}`)
  console.log(`   Verification requests: ${await db.verificationRequest.count()}`)
  console.log(`   Invoices: ${await db.invoice.count()}`)
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
