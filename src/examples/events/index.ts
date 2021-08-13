import { Event } from '@basetime/wss-node-sdk';

export class PaymentQueryEvent extends Event {
  public action = 'token';
  public token = '';

  constructor() {
    super('payment.PAYMENT_QUERY');
  }
}
