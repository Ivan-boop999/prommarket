import type { Category, FlatCategory } from '@web-app-demo/contracts'

import type { DbClient } from '../../../db'
import type { CategoryReader } from '../application/ports'

/**
 * Category repository.
 *
 * The tree is assembled in JS after a single flat query with two levels of
 * `children` include. The original ПромМаркет route hard-coded three levels
 * of include; this version walks the flat list to build an arbitrarily deep
 * tree, so a deeper category hierarchy does not require a query change.
 *
 * `descendantIds` is what makes `categoryId` roll up subcategories server-side:
 * given a parent id, it returns the parent plus every descendant, so a products
 * query filtered by a top-level category also matches products in its children.
 */
export function createPrismaCategoriesRepository(db: DbClient): CategoryReader {
  return {
    async tree() {
      const rows = await db.category.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      })
      return buildTree(rows.map(toCategory))
    },

    async flat() {
      const rows = await db.category.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      })
      return rows.map(toFlatCategory)
    },

    async descendantIds(rootId) {
      // Breadth-first traversal in JS over a single query. The category tree
      // is small (dozens of rows), so one round-trip beats recursive CTEs.
      const rows = await db.category.findMany({ select: { id: true, parentId: true } })
      const childrenOf = new Map<string, string[]>()
      for (const row of rows) {
        if (row.parentId) {
          const list = childrenOf.get(row.parentId) ?? []
          list.push(row.id)
          childrenOf.set(row.parentId, list)
        }
      }
      const result = new Set<string>([rootId])
      const queue = [rootId]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const childId of childrenOf.get(current) ?? []) {
          if (!result.has(childId)) {
            result.add(childId)
            queue.push(childId)
          }
        }
      }
      return result
    },
  }
}

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
}

function toCategory(row: CategoryRow): Category {
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
    children: [],
  }
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

/** Builds a nested tree from a flat list by `parentId`, children sorted by `order`. */
function buildTree(flat: Category[]): Category[] {
  const byId = new Map(flat.map((c) => [c.id, c]))
  const roots: Category[] = []
  for (const node of flat) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  // Children are already pushed in `flat` order which is sorted by order; ensure it.
  const sortByOrder = (a: Category, b: Category) =>
    a.order - b.order || a.name.localeCompare(b.name, 'ru')
  const sortRecursively = (nodes: Category[]) => {
    nodes.sort(sortByOrder)
    for (const node of nodes) sortRecursively(node.children)
  }
  sortRecursively(roots)
  return roots
}
