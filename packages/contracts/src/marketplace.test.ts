import { describe, expect, test } from 'bun:test'

import {
  DEAL_STATUS_TRANSITIONS,
  dealDetailSchema,
  dealListItemSchema,
  dealStatusSchema,
  getNextDealStatuses,
  isDealStatusTransitionAllowed,
  productDetailSchema,
  productListItemSchema,
  productsQuerySchema,
  terminalDealStatuses,
  type DealDetail,
  type DealListItem,
  type ProductDetail,
  type ProductListItem,
} from './index'

const uuid = (n: number) =>
  `019c0000-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`

describe('marketplace enums', () => {
  test('dealStatus covers the seven pipeline states', () => {
    expect(dealStatusSchema.parse('new')).toBe('new')
    expect(dealStatusSchema.parse('completed')).toBe('completed')
    expect(() => dealStatusSchema.parse('draft')).toThrow()
  })
})

describe('deal state machine', () => {
  test('every deal status has an entry in the transition table', () => {
    const statuses = [
      'new',
      'verification',
      'negotiation',
      'proposal',
      'connection',
      'completed',
      'cancelled',
    ] as const
    for (const status of statuses) {
      expect(DEAL_STATUS_TRANSITIONS[status]).toBeDefined()
      expect(getNextDealStatuses(status)).toEqual(DEAL_STATUS_TRANSITIONS[status])
    }
  })

  test('terminal statuses allow no transitions', () => {
    expect(terminalDealStatuses).toEqual(['completed', 'cancelled'])
    expect(getNextDealStatuses('completed')).toEqual([])
    expect(getNextDealStatuses('cancelled')).toEqual([])
  })

  test('the happy-path pipeline is traversable end to end', () => {
    expect(isDealStatusTransitionAllowed('new', 'verification')).toBe(true)
    expect(isDealStatusTransitionAllowed('verification', 'negotiation')).toBe(true)
    expect(isDealStatusTransitionAllowed('negotiation', 'proposal')).toBe(true)
    expect(isDealStatusTransitionAllowed('proposal', 'connection')).toBe(true)
    expect(isDealStatusTransitionAllowed('connection', 'completed')).toBe(true)
  })

  test('out-of-graph transitions are rejected', () => {
    expect(isDealStatusTransitionAllowed('new', 'completed')).toBe(false)
    expect(isDealStatusTransitionAllowed('completed', 'new')).toBe(false)
    expect(isDealStatusTransitionAllowed('cancelled', 'negotiation')).toBe(false)
  })

  test('cancellation is reachable from the active negotiation stages', () => {
    // verification/negotiation/proposal allow cancelling. `new` does NOT: a brand
    // new deal must be verified first. This matches the original ПромМаркет graph,
    // where NEW only advanced to VERIFICATION.
    const cancellable = ['verification', 'negotiation', 'proposal'] as const
    for (const status of cancellable) {
      expect(isDealStatusTransitionAllowed(status, 'cancelled')).toBe(true)
    }
    expect(isDealStatusTransitionAllowed('new', 'cancelled')).toBe(false)
  })

  test('connection is a point of no return for cancellation', () => {
    expect(isDealStatusTransitionAllowed('connection', 'cancelled')).toBe(false)
    expect(isDealStatusTransitionAllowed('connection', 'completed')).toBe(true)
    expect(isDealStatusTransitionAllowed('connection', 'negotiation')).toBe(true)
  })
})

describe('product list item', () => {
  const item: ProductListItem = {
    id: uuid(1),
    title: 'Электродвигатель АИР200М4',
    slug: 'electrodyvigatel-air200m4',
    sku: 'AIR200M4',
    brand: 'ВЭМЗ',
    status: 'new',
    availability: 'in_stock',
    mainPrice: '142500.00',
    currency: 'RUB',
    volumeDiscountPercent: 14,
    primaryImage: {
      id: uuid(2),
      url: 'http://localhost:3000/static/electric-motor.png',
      alt: 'АИР200М4',
      order: 0,
      isPrimary: true,
    },
    vendorId: uuid(3),
    vendorName: 'ООО «ПромТехника»',
    vendorVerified: true,
    vendorVerificationTier: 'pro',
    categoryId: uuid(4),
    views: 42,
    createdAt: '2026-08-01T00:00:00.000Z',
  }

  test('parses a valid card', () => {
    expect(productListItemSchema.parse(item)).toEqual(item)
  })

  test('on_request products carry a null mainPrice', () => {
    const onRequest = { ...item, mainPrice: null, volumeDiscountPercent: null }
    expect(productListItemSchema.parse(onRequest)).toEqual(onRequest)
  })

  test('rejects a numeric price — decimals cross the wire as strings', () => {
    expect(() =>
      productListItemSchema.parse({ ...item, mainPrice: 142500 }),
    ).toThrow()
  })

  test('rejects an unknown status', () => {
    expect(() => productListItemSchema.parse({ ...item, status: 'broken' })).toThrow()
  })
})

describe('product detail', () => {
  const detail: ProductDetail = {
    id: uuid(1),
    title: 'Насос КМ 80/200',
    slug: 'nasos-km-80-200',
    sku: 'KM80/200',
    brand: 'ГМС Ливгидромаш',
    status: 'new',
    availability: 'in_stock',
    mainPrice: '285000.00',
    currency: 'RUB',
    volumeDiscountPercent: 14,
    primaryImage: {
      id: uuid(2),
      url: 'http://localhost:3000/static/centrifugal-pump.png',
      alt: null,
      order: 0,
      isPrimary: true,
    },
    vendorId: uuid(3),
    vendorName: 'ООО «ПромТехника»',
    vendorVerified: true,
    vendorVerificationTier: 'pro',
    categoryId: uuid(4),
    views: 7,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    description: 'Центробежный консольно-моноблочный насос',
    oemNumber: null,
    model: 'КМ 80-200',
    year: 2024,
    leadTime: '2-3 недели',
    conditionNote: null,
    images: [],
    prices: [],
    attributes: [
      {
        id: uuid(5),
        attributeId: uuid(6),
        attributeSlug: 'power',
        attributeName: 'Мощность',
        value: 30,
      },
    ],
    vendorDescription: 'Проверенный производитель',
    vendorRating: 4.8,
    vendorTotalDeals: 12,
  }

  test('parses a full product with EAV attributes', () => {
    expect(productDetailSchema.parse(detail)).toEqual(detail)
  })

  test('accepts an array value for multi_select attributes', () => {
    const withArray = {
      ...detail,
      attributes: [
        ...detail.attributes,
        {
          id: uuid(7),
          attributeId: uuid(8),
          attributeSlug: 'certifications',
          attributeName: 'Сертификаты',
          value: ['ГОСТ', 'ISO 9001'],
        },
      ],
    }
    expect(productDetailSchema.parse(withArray)).toEqual(withArray)
  })
})

describe('products query', () => {
  test('applies defaults for pagination and sort', () => {
    const parsed = productsQuerySchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.pageSize).toBe(12)
    expect(parsed.sortBy).toBe('createdAt')
    expect(parsed.sortDir).toBe('desc')
  })

  test('coerces string query params to numbers', () => {
    const parsed = productsQuerySchema.parse({
      page: '2',
      pageSize: '24',
      priceMin: '100000',
      priceMax: '500000',
    })
    expect(parsed.page).toBe(2)
    expect(parsed.pageSize).toBe(24)
    expect(parsed.priceMin).toBe(100000)
    expect(parsed.priceMax).toBe(500000)
  })

  test('accepts multiple statuses and EAV attribute filters', () => {
    const parsed = productsQuerySchema.parse({
      status: ['new', 'used'],
      attributes: { 'ip-class': ['IP55', 'IP54'] },
    })
    expect(parsed.status).toEqual(['new', 'used'])
    expect(parsed.attributes).toEqual({ 'ip-class': ['IP55', 'IP54'] })
  })

  test('rejects pageSize over 100', () => {
    expect(() => productsQuerySchema.parse({ pageSize: '200' })).toThrow()
  })
})

describe('deal DTOs', () => {
  const deal: DealListItem = {
    id: uuid(1),
    dealNumber: 'SD-2026-0001',
    type: 'rfq',
    status: 'negotiation',
    title: 'Закупка электродвигателей',
    productId: uuid(2),
    productTitle: 'Электродвигатель АИР200М4',
    buyerId: uuid(3),
    buyerName: 'ООО «МашСтройПром»',
    vendorId: uuid(4),
    vendorName: 'ООО «ПромТехника»',
    brokerId: uuid(5),
    quantity: 10,
    totalAmount: '1425000.00',
    currency: 'RUB',
    commission: '42750.00',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  }

  test('list item parses without relations', () => {
    expect(dealListItemSchema.parse(deal)).toEqual(deal)
  })

  test('detail extends list with messages and history', () => {
    const detail: DealDetail = {
      ...deal,
      description: 'Срочно',
      deliveryDate: '2026-09-01T00:00:00.000Z',
      deliveryAddress: 'г. Москва',
      notes: null,
      messages: [],
      history: [],
    }
    expect(dealDetailSchema.parse(detail)).toEqual(detail)
  })
})
