import { useState } from 'react'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  useCreateVendorProductMutation,
  useDeleteVendorProductMutation,
  useVendorProductsQuery,
} from './queries'

/**
 * Vendor product management page. Lists the vendor's products with edit/delete
 * actions, and a "create" dialog with the minimal viable product form (title,
 * category, price, description). Image upload and EAV attributes can be added
 * in a follow-up; the backend already accepts them.
 */
export function VendorProductsPanel() {
  const productsQuery = useVendorProductsQuery()
  const deleteMutation = useDeleteVendorProductMutation()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <PageContainer>
      <PageHeader
        title="Мои товары"
        description="Управление каталогом ваших товаров."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Добавить товар</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Новый товар</DialogTitle>
              </DialogHeader>
              <CreateProductForm onSuccess={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardContent className="p-0">
          {productsQuery.isLoading ? (
            <Skeleton className="m-4 h-40 w-auto" />
          ) : (productsQuery.data ?? []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              У вас пока нет товаров. Нажмите «Добавить товар».
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Просмотры</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(productsQuery.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{statusLabel(p.status)}</Badge>
                    </TableCell>
                    <TableCell>{p.mainPrice ? formatMoney(p.mainPrice) : 'По запросу'}</TableCell>
                    <TableCell>{p.views}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Удалить «${p.title}»?`)) {
                            deleteMutation.mutate(p.id)
                          }
                        }}
                      >
                        Удалить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function CreateProductForm({ onSuccess }: { onSuccess: () => void }) {
  const mutation = useCreateVendorProductMutation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('')
  const [sku, setSku] = useState('')
  const [brand, setBrand] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [images, setImages] = useState<Array<{ url: string; alt?: string }>>([])

  const canSubmit = title.trim().length >= 3 && categoryId.length > 0 && price.length > 0

  const addImage = () => {
    const url = imageUrl.trim()
    if (!url) return
    setImages((prev) => [...prev, { url, alt: title }])
    setImageUrl('')
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        mutation.mutate(
          {
            title: title.trim(),
            description: description.trim() || undefined,
            categoryId,
            sku: sku.trim() || undefined,
            brand: brand.trim() || undefined,
            status: 'new',
            availability: 'in_stock',
            prices: [
              {
                type: 'fixed',
                price: price,
                currency: 'RUB',
                includesVat: true,
                vatRate: 20,
              },
            ],
            images: images.map((img, i) => ({
              url: img.url,
              alt: img.alt,
              order: i,
              isPrimary: i === 0,
            })),
            attributes: [],
          },
          {
            onSuccess,
            onError: (e) => alert(`Ошибка: ${(e as Error).message}`),
          },
        )
      }}
    >
      <Label className="block">
        Название *
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" required minLength={3} />
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label className="block">
          Категория (UUID) *
          <Input
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1"
            placeholder="019c…"
            required
          />
        </Label>
        <Label className="block">
          Цена (RUB) *
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1"
            required
          />
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Label className="block">
          Артикул
          <Input value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1" />
        </Label>
        <Label className="block">
          Бренд
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1" />
        </Label>
      </div>
      <Label className="block">
        Описание
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
      </Label>
      <div>
        <Label className="block">
          Изображения (URL)
          <div className="mt-1 flex gap-2">
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/products/my-item.jpg или https://…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addImage()
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addImage}>
              Добавить
            </Button>
          </div>
        </Label>
        {images.length > 0 && (
          <ul className="mt-2 space-y-1">
            {images.map((img, i) => (
              <li key={img.url} className="flex items-center gap-2 text-xs">
                <span className="truncate text-muted-foreground">
                  {i + 1}. {img.url}
                  {i === 0 && <span className="ml-1 text-primary">(основное)</span>}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto text-xs text-destructive"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  убрать
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        UUID категории можно скопировать из каталога или админ-панели. Первое изображение становится основным.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onSuccess}>
          Отмена
        </Button>
        <Button type="submit" disabled={!canSubmit || mutation.isPending}>
          {mutation.isPending ? 'Создание…' : 'Создать'}
        </Button>
      </div>
    </form>
  )
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'Новый',
    used: 'Б/у',
    refurbished: 'Восстановленный',
    spare_parts: 'Запчасти',
    storage: 'На складе',
  }
  return map[status] ?? status
}

function formatMoney(value: string): string {
  const num = Number(value)
  if (Number.isNaN(num)) return value
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽'
}
