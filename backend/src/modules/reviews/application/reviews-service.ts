import type {
  CreateReviewInput,
  ProductReview,
  ReviewVendorReplyInput,
} from '@prommarket/contracts'

import type { DbClient } from '../../../db'
import { ReviewFailure } from '../domain/errors'

type ReviewRow = {
  id: string
  productId: string
  authorId: string
  rating: number
  title: string | null
  body: string | null
  vendorReply: string | null
  createdAt: Date
  updatedAt: Date
}

function toReviewDto(row: ReviewRow): ProductReview {
  return {
    id: row.id,
    productId: row.productId,
    authorId: row.authorId,
    rating: row.rating,
    title: row.title,
    body: row.body,
    vendorReply: row.vendorReply,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Reviews service. A buyer creates a review for a product; the product's
 * vendor may reply once. One review per (product, author) is enforced by a
 * unique constraint and checked here for a clear error.
 */
export class ReviewsService {
  constructor(private readonly db: DbClient) {}

  async listForProduct(productId: string): Promise<ProductReview[]> {
    const rows = await this.db.productReview.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => toReviewDto(r as ReviewRow))
  }

  async create(authorId: string, productId: string, input: CreateReviewInput): Promise<ProductReview> {
    const existing = await this.db.productReview.findUnique({
      where: { productId_authorId: { productId, authorId } },
    })
    if (existing) {
      throw new ReviewFailure('already_reviewed', 'You have already reviewed this product')
    }
    const row = await this.db.productReview.create({
      data: {
        productId,
        authorId,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body ?? null,
      },
    })
    return toReviewDto(row as ReviewRow)
  }

  async addVendorReply(
    vendorUserId: string,
    reviewId: string,
    input: ReviewVendorReplyInput,
  ): Promise<ProductReview> {
    const review = await this.db.productReview.findUnique({
      where: { id: reviewId },
      include: { product: { select: { vendorId: true } } },
    })
    if (!review) throw new ReviewFailure('not_found', `Review ${reviewId} not found`)
    // Only the product's vendor may reply.
    const vendor = await this.db.vendor.findUnique({
      where: { userId: vendorUserId },
      select: { id: true },
    })
    if (!vendor || vendor.id !== (review.product as { vendorId: string }).vendorId) {
      throw new ReviewFailure('not_owner', 'Only the product vendor may reply')
    }
    const updated = await this.db.productReview.update({
      where: { id: reviewId },
      data: { vendorReply: input.reply },
    })
    return toReviewDto(updated as ReviewRow)
  }
}
