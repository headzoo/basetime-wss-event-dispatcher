import { IEvent, EventHandler, EventHandlerCallback } from '@basetime/wss-node-sdk';

export default class PaymentHandler extends EventHandler {
  getDescription = (): string => {
    return 'A description.';
  };

  getName = (): string => {
    return 'PaymentHandler';
  };

  getSubsystem = (): string => {
    return 'payments';
  };

  getVersion = (): string => {
    return '1.0';
  };

  getSubscriptions = (): Record<string, EventHandlerCallback> => {
    return {
      'payment.PAYMENT_QUERY': this.handlePaymentQuery,
    };
  };

  handlePaymentQuery = async (e: IEvent) => {
    e.stopPropagation();
  };
}
