import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import type { ProductDetail, CreateDealInput } from '@web-app-demo/contracts'
import type { AuthenticatedTransport } from '@/platform/api'
import { dealDetailSchema } from '@web-app-demo/contracts'

/**
 * RFQ (Request for Quote) form on the product card. A signed-in buyer opens
 * the dialog, fills quantity + delivery + notes, and the deal is created via
 * POST /api/deals. The deal lands in `new` status; a broker picks it up from
 * the pipeline.
 */
export async function createDeal(
  transport: AuthenticatedTransport,
  input: CreateDealInput,
) {
  return transport.request('/api/deals', dealDetailSchema, {
    method: 'POST',
    body: input,
  })
}

export function RfqButton({ product }: { product: ProductDetail }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)

  // Only buyers can place an RFQ.
  if (!auth.isAuthenticated || auth.user?.role !== 'buyer') {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Запросить КП</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Запрос коммерческого предложения</DialogTitle>
          <DialogDescription>
            {product.title} — {product.vendorName}
          </DialogDescription>
        </DialogHeader>
        <RfqFormBody product={product} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RfqFormBody({
  product,
  onSuccess,
}: {
  product: ProductDetail
  onSuccess: () => void
}) {
  const auth = useAuth()
  const [quantity, setQuantity] = useState('1')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await createDeal(auth.transport, {
        type: 'rfq',
        title: `RFQ: ${product.title}`,
        productId: product.id,
        vendorId: product.vendorId,
        quantity: Number(quantity) || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onSuccess()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Label className="block">
        Количество
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="mt-1"
        />
      </Label>
      <Label className="block">
        Адрес доставки
        <Input
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          placeholder="Город, адрес объекта"
          className="mt-1"
        />
      </Label>
      <Label className="block">
        Комментарий
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Условия, сроки, особые требования"
          rows={3}
          className="mt-1"
        />
      </Label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onSuccess}>
          Отмена
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Отправка…' : 'Отправить заявку'}
        </Button>
      </div>
    </form>
  )
}
