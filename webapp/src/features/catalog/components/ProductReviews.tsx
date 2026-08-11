import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth'
import { useCreateReviewMutation, useProductReviewsQuery } from '../queries'

/**
 * Reviews section for the product detail page. Public visitors see existing
 * reviews; a signed-in buyer can post one (one per product, enforced server-side).
 * The vendor's reply, if any, is shown inline beneath each review.
 */
export function ProductReviews({ productId }: { productId: string }) {
  const reviewsQuery = useProductReviewsQuery(productId)
  const reviews = reviewsQuery.data ?? []

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Отзывы ({reviews.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ReviewForm productId={productId} />
        {reviewsQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : reviews.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Отзывов пока нет. Будьте первым!
          </p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border-t pt-3 first:border-t-0 first:pt-0">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="secondary">{'★'.repeat(review.rating)}<span className="text-muted-foreground">{'★'.repeat(5 - review.rating)}</span></Badge>
                {review.title && <span className="text-sm font-medium">{review.title}</span>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
              {review.body && <p className="text-sm text-muted-foreground">{review.body}</p>}
              {review.vendorReply && (
                <div className="mt-2 rounded-md bg-muted p-2 text-sm">
                  <span className="font-medium">Ответ поставщика: </span>
                  {review.vendorReply}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function ReviewForm({ productId }: { productId: string }) {
  const auth = useAuth()
  const mutation = useCreateReviewMutation(productId)
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  if (!auth.isAuthenticated || auth.user?.role !== 'buyer') {
    return null
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Оставить отзыв
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label className="block">
        Оценка
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-muted-foreground'}`}
              onClick={() => setRating(n)}
              aria-label={`${n} звёзд`}
            >
              ★
            </button>
          ))}
        </div>
      </Label>
      <Label className="block">
        Заголовок
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Кратко" className="mt-1" />
      </Label>
      <Label className="block">
        Отзыв
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Поделитесь впечатлениями о товаре"
          className="mt-1"
          rows={3}
        />
      </Label>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() => {
            mutation.mutate(
              { rating, title: title || undefined, body: body || undefined },
              {
                onSuccess: () => {
                  setOpen(false)
                  setTitle('')
                  setBody('')
                  setRating(5)
                },
              },
            )
          }}
        >
          {mutation.isPending ? 'Отправка…' : 'Опубликовать'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
      {mutation.isError && (
        <p className="text-sm text-destructive">
          Ошибка: {(mutation.error as Error)?.message ?? 'не удалось отправить'}
        </p>
      )}
    </div>
  )
}
