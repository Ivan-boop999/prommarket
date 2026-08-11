/**
 * Broker success-fee domain failures.
 */
export type BrokerFailureKind =
  | 'not_found'
  | 'deal_not_found'
  | 'fee_not_found'
  | 'invoice_not_found'
  | 'not_payable'
  | 'already_confirmed'
  | 'not_brokered'
  | 'not_completed'

export class BrokerFailure extends Error {
  constructor(readonly kind: BrokerFailureKind, message: string) {
    super(message)
    this.name = 'BrokerFailure'
  }
}

/** Default commission percent applied to a closed deal's totalAmount. */
export const DEFAULT_BROKER_FEE_PERCENT = 7.5
export const DEFAULT_CURRENCY = 'RUB'
