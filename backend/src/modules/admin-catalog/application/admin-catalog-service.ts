import type {
  Attribute,
  Category,
  CreateAttributeInput,
  CreateCategoryInput,
  FlatCategory,
  UpdateCategoryInput,
} from '@prommarket/contracts'

import type { DbClient } from '../../../db'
import { AdminCatalogFailure } from '../domain/errors'
/**
 * Failure-to-HTTP mapping happens in the transport routes (executeAdminCatalog
 * there); the application layer only propagates domain failures.
 */
async function executeAdminCatalog<T>(operation: () => Promise<T>): Promise<T> {
  return operation()
}

/**
 * Admin catalog service — category/attribute CRUD. Lives behind requireAdmin.
 * Read endpoints return the same DTOs as the public catalog module so the
 * admin UI can reuse the same shapes.
 */

type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  order: number
  icon: string | null
  image: string | null
  productCount: number
  createdAt: Date
  updatedAt: Date
}

function toFlatCategory(row: CategoryRow): FlatCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parentId,
    order: row.order,
    icon: row.icon,
    image: row.image,
    productCount: row.productCount,
  }
}

type AttributeRow = {
  id: string
  name: string
  slug: string
  description: string | null
  type: string
  unit: string | null
  options: unknown
  isFilterable: boolean
  isRequired: boolean
  order: number
}

function toAttribute(row: AttributeRow): Attribute {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    type: row.type as Attribute['type'],
    unit: row.unit,
    options: (row.options as string[] | null) ?? null,
    isFilterable: row.isFilterable,
    isRequired: row.isRequired,
    order: row.order,
  }
}

export class AdminCatalogService {
  constructor(private readonly db: DbClient) {}

  // --- Categories ---

  async listCategories(): Promise<FlatCategory[]> {
    const rows = await this.db.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] })
    return rows.map((r) => toFlatCategory(r as CategoryRow))
  }

  async createCategory(input: CreateCategoryInput): Promise<FlatCategory> {
    return executeAdminCatalog(async () => {
      const existing = await this.db.category.findUnique({ where: { slug: input.slug } })
      if (existing) throw new AdminCatalogFailure('slug_taken', `Slug ${input.slug} already in use`)
      const row = await this.db.category.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          parentId: input.parentId ?? null,
          order: input.order,
          icon: input.icon ?? null,
          image: input.image ?? null,
        },
      })
      return toFlatCategory(row as CategoryRow)
    })
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<FlatCategory> {
    return executeAdminCatalog(async () => {
      const existing = await this.db.category.findUnique({ where: { id } })
      if (!existing) throw new AdminCatalogFailure('not_found', `Category ${id} not found`)
      if (input.slug && input.slug !== existing.slug) {
        const taken = await this.db.category.findUnique({ where: { slug: input.slug } })
        if (taken) throw new AdminCatalogFailure('slug_taken', `Slug ${input.slug} already in use`)
      }
      const row = await this.db.category.update({
        where: { id },
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          parentId: input.parentId,
          order: input.order,
          icon: input.icon,
          image: input.image,
        },
      })
      return toFlatCategory(row as CategoryRow)
    })
  }

  async deleteCategory(id: string): Promise<void> {
    return executeAdminCatalog(async () => {
      const existing = await this.db.category.findUnique({ where: { id } })
      if (!existing) throw new AdminCatalogFailure('not_found', `Category ${id} not found`)
      const childCount = await this.db.category.count({ where: { parentId: id } })
      if (childCount > 0) {
        throw new AdminCatalogFailure('has_children', 'Cannot delete a category with subcategories')
      }
      await this.db.category.delete({ where: { id } })
    })
  }

  // --- Attributes ---

  async listAttributes(): Promise<Attribute[]> {
    const rows = await this.db.attribute.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] })
    return rows.map((r) => toAttribute(r as AttributeRow))
  }

  async createAttribute(input: CreateAttributeInput): Promise<Attribute> {
    return executeAdminCatalog(async () => {
      const existing = await this.db.attribute.findUnique({ where: { slug: input.slug } })
      if (existing) throw new AdminCatalogFailure('slug_taken', `Slug ${input.slug} already in use`)
      const row = await this.db.$transaction(async (tx) => {
        const attr = await tx.attribute.create({
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description ?? null,
            type: input.type,
            unit: input.unit ?? null,
            options: input.options ?? undefined,
            isFilterable: input.isFilterable,
            isRequired: input.isRequired,
            order: input.order,
          },
        })
        if (input.categoryIds.length > 0) {
          await tx.categoryAttribute.createMany({
            data: input.categoryIds.map((categoryId) => ({ categoryId, attributeId: attr.id })),
            skipDuplicates: true,
          })
        }
        return attr
      })
      return toAttribute(row as AttributeRow)
    })
  }

  async deleteAttribute(id: string): Promise<void> {
    return executeAdminCatalog(async () => {
      const existing = await this.db.attribute.findUnique({ where: { id } })
      if (!existing) throw new AdminCatalogFailure('not_found', `Attribute ${id} not found`)
      await this.db.attribute.delete({ where: { id } })
    })
  }
}
