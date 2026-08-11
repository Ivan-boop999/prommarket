import type {
  CreateVerificationRequestInput,
  ReviewVerificationInput,
  VerificationDocument,
  VerificationRequest,
} from '@web-app-demo/contracts'

import type { DbClient } from '../../../db'
import { VerificationFailure, VERIFICATION_VALIDITY_MONTHS } from '../domain/errors'
import type { VerificationRepository } from '../application/ports'
import { addMonths } from '../../billing/infrastructure/mappers'

type DocumentRow = {
  id: string
  documentType: string
  fileName: string
  objectKey: string
  contentType: string
  byteSize: number
  uploadedAt: Date
}

function toDocumentDto(row: DocumentRow): VerificationDocument {
  return {
    id: row.id,
    documentType: row.documentType as VerificationDocument['documentType'],
    fileName: row.fileName,
    objectKey: row.objectKey,
    contentType: row.contentType,
    byteSize: row.byteSize,
    uploadedAt: row.uploadedAt.toISOString(),
  }
}

type RequestRow = {
  id: string
  vendorId: string
  status: string
  requestedTier: string
  contactName: string | null
  contactPhone: string | null
  message: string | null
  submittedAt: Date | null
  reviewedAt: Date | null
  reviewerNotes: string | null
  expiresAt: Date | null
  documents: DocumentRow[]
  createdAt: Date
  updatedAt: Date
}

function toRequestDto(row: RequestRow): VerificationRequest {
  return {
    id: row.id,
    vendorId: row.vendorId,
    status: row.status as VerificationRequest['status'],
    requestedTier: row.requestedTier as VerificationRequest['requestedTier'],
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    message: row.message,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewerNotes: row.reviewerNotes,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    documents: row.documents.map(toDocumentDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function createPrismaVerificationRepository(db: DbClient): VerificationRepository {
  return {
    async createRequest({ vendorId, payload }) {
      const row = await db.verificationRequest.create({
        data: {
          vendorId,
          status: 'draft',
          requestedTier: payload.requestedTier,
          contactName: payload.contactName,
          contactPhone: payload.contactPhone ?? null,
          message: payload.message ?? null,
          documents: {
            create: payload.documents.map((d) => ({
              documentType: d.documentType,
              fileName: d.fileName,
              objectKey: d.objectKey,
              contentType: d.contentType,
              byteSize: d.byteSize,
            })),
          },
        },
        include: { documents: true },
      })
      return toRequestDto(row as RequestRow)
    },

    async findRequestById(id) {
      const row = await db.verificationRequest.findUnique({
        where: { id },
        include: { documents: true },
      })
      return row ? toRequestDto(row as RequestRow) : null
    },

    async findLatestByVendor(vendorId) {
      const row = await db.verificationRequest.findFirst({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        include: { documents: true },
      })
      return row ? toRequestDto(row as RequestRow) : null
    },

    async submit(id, now) {
      const existing = await db.verificationRequest.findUnique({ where: { id } })
      if (!existing) {
        throw new VerificationFailure('request_not_found', `Verification request ${id} not found`)
      }
      if (existing.status !== 'draft') {
        throw new VerificationFailure('not_submittable', `Request is ${existing.status}, cannot submit`)
      }
      const row = await db.verificationRequest.update({
        where: { id },
        data: { status: 'submitted', submittedAt: now },
        include: { documents: true },
      })
      return toRequestDto(row as RequestRow)
    },

    async review({ id, reviewerId, decision, reviewerNotes, now, expiresAt }) {
      const existing = await db.verificationRequest.findUnique({ where: { id } })
      if (!existing) {
        throw new VerificationFailure('request_not_found', `Verification request ${id} not found`)
      }
      if (existing.status !== 'submitted' && existing.status !== 'under_review') {
        throw new VerificationFailure(
          'not_reviewable',
          `Request is ${existing.status}, cannot review`,
        )
      }

      const row = await db.$transaction(async (tx) => {
        const updated = await tx.verificationRequest.update({
          where: { id },
          data: {
            status: decision,
            reviewedBy: reviewerId,
            reviewedAt: now,
            reviewerNotes: reviewerNotes ?? null,
            expiresAt,
          },
          include: { documents: true },
        })

        // On approval, denormalize the tier onto the vendor.
        if (decision === 'approved') {
          await tx.vendor.update({
            where: { id: existing.vendorId },
            data: {
              verified: true,
              verificationTier: existing.requestedTier,
            },
          })
        }
        return updated
      })
      return toRequestDto(row as RequestRow)
    },

    async listPending() {
      const rows = await db.verificationRequest.findMany({
        where: { status: { in: ['submitted', 'under_review'] } },
        orderBy: { submittedAt: 'asc' },
        include: { documents: true },
        take: 100,
      })
      return rows.map((r) => toRequestDto(r as RequestRow))
    },
  }
}

export { addMonths, VERIFICATION_VALIDITY_MONTHS }
export type { ReviewVerificationInput }
