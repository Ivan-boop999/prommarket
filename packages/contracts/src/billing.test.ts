import { describe, expect, test } from 'bun:test'

import {
  createSubscriptionInputSchema,
  invoiceSchema,
  leadCreditBalanceSchema,
  leadCreditPriceSchema,
  subscriptionPlanSchema,
  vendorSubscriptionSchema,
  verificationRequestSchema,
  verificationTierSchema,
  decimalStringSchema,
  createReviewInputSchema,
  dealsQuerySchema,
} from './index'

const uuid = (n: number) =>
  `019c0000-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`

describe('monetization enums', () => {
  test('verificationTier covers none/basic/pro', () => {
    expect(verificationTierSchema.parse('none')).toBe('none')
    expect(verificationTierSchema.parse('basic')).toBe('basic')
    expect(verificationTierSchema.parse('pro')).toBe('pro')
    expect(() => verificationTierSchema.parse('enterprise')).toThrow()
  })

  test('decimalString rejects non-numeric and accepts negative', () => {
    expect(decimalStringSchema.parse('100')).toBe('100')
    expect(decimalStringSchema.parse('-50.25')).toBe('-50.25')
    expect(() => decimalStringSchema.parse('abc')).toThrow()
    expect(() => decimalStringSchema.parse('')).toThrow()
  })
})

describe('subscription contracts', () => {
  const validPlan = {
    id: uuid(1),
    code: 'pro_yearly',
    name: 'Про',
    description: 'Pro tier',
    price: '32000',
    currency: 'RUB',
    billingPeriod: 'yearly' as const,
    maxProducts: 10000,
    maxRegions: null,
    includedLeadCredits: 200,
    hasFeatured: true,
    hasPrioritySupport: true,
    isActive: true,
    sortOrder: 3,
  }

  test('subscriptionPlanSchema parses a valid plan', () => {
    expect(subscriptionPlanSchema.parse(validPlan)).toEqual(validPlan)
  })

  test('createSubscriptionInputSchema requires a planId', () => {
    expect(createSubscriptionInputSchema.parse({ planId: uuid(1) })).toEqual({
      planId: uuid(1),
    })
    expect(() => createSubscriptionInputSchema.parse({})).toThrow()
  })

  test('vendorSubscriptionSchema parses with plan included', () => {
    const sub = {
      id: uuid(2),
      vendorId: uuid(3),
      planId: uuid(1),
      status: 'active' as const,
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2027-01-01T00:00:00.000Z',
      amount: '32000',
      currency: 'RUB',
      invoiceId: null,
      confirmedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      plan: validPlan,
    }
    expect(vendorSubscriptionSchema.parse(sub)).toEqual(sub)
  })
})

describe('lead credit contracts', () => {
  test('leadCreditBalanceSchema carries vendor + balance', () => {
    expect(
      leadCreditBalanceSchema.parse({ vendorId: uuid(1), balance: 42 }),
    ).toEqual({ vendorId: uuid(1), balance: 42 })
  })

  test('leadCreditPriceSchema has pricePerCredit and tiers', () => {
    const price = {
      pricePerCredit: '100',
      currency: 'RUB',
      tiers: [{ minCredits: 50, pricePerCredit: '90' }],
    }
    expect(leadCreditPriceSchema.parse(price)).toEqual(price)
  })
})

describe('invoice contract', () => {
  test('invoiceSchema parses an issued subscription invoice', () => {
    const invoice = {
      id: uuid(1),
      number: 'INV-2026-0001',
      type: 'subscription' as const,
      payerType: 'vendor' as const,
      payerUserId: uuid(2),
      vendorId: uuid(3),
      subscriptionId: uuid(4),
      dealId: null,
      amount: '32000',
      currency: 'RUB',
      status: 'issued' as const,
      dueDate: '2026-02-01T00:00:00.000Z',
      issuedAt: '2026-01-01T00:00:00.000Z',
      paidAt: null,
      paymentReference: null,
      confirmedAt: null,
      notes: null,
      items: [
        {
          description: 'Подписка Про',
          quantity: 1,
          unitPrice: '32000',
          total: '32000',
        },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(invoiceSchema.parse(invoice)).toEqual(invoice)
  })
})

describe('verification contract', () => {
  test('verificationRequestSchema parses a submitted request', () => {
    const req = {
      id: uuid(1),
      vendorId: uuid(2),
      status: 'submitted' as const,
      requestedTier: 'pro' as const,
      contactName: 'Иванов И.И.',
      contactPhone: '+7 495 123-45-67',
      message: 'Прошу верифицировать',
      submittedAt: '2026-01-01T00:00:00.000Z',
      reviewedAt: null,
      reviewerNotes: null,
      expiresAt: null,
      documents: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(verificationRequestSchema.parse(req)).toEqual(req)
  })
})

describe('deals query contract', () => {
  test('dealsQuerySchema applies pagination defaults', () => {
    const parsed = dealsQuerySchema.parse({} as Record<string, unknown>)
    expect(parsed.page).toBe(1)
    expect(parsed.pageSize).toBe(12)
  })

  test('dealsQuerySchema accepts status and type filters', () => {
    const parsed = dealsQuerySchema.parse({
      status: ['new', 'negotiation'],
      type: ['rfq'],
    })
    expect(parsed.status).toEqual(['new', 'negotiation'])
    expect(parsed.type).toEqual(['rfq'])
  })
})

describe('review contract', () => {
  test('createReviewInputSchema validates rating range 1-5', () => {
    expect(createReviewInputSchema.parse({ rating: 5 }).rating).toBe(5)
    expect(() => createReviewInputSchema.parse({ rating: 0 })).toThrow()
    expect(() => createReviewInputSchema.parse({ rating: 6 })).toThrow()
  })

  test('createReviewInputSchema accepts optional title and body', () => {
    const result = createReviewInputSchema.parse({
      rating: 4,
      title: 'Хороший товар',
      body: 'Рекомендую',
    })
    expect(result.title).toBe('Хороший товар')
    expect(result.body).toBe('Рекомендую')
  })
})
