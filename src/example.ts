import { Event, Logger } from '@basetime/wss-node-sdk';
import EventDispatcher from './index';

(async () => {
  const logger = new Logger('EventDispatcher', '1234', '1234');
  const dispatcher = new EventDispatcher(logger, { sessionId: '1234', clubId: '1234' });
  await dispatcher.add(new URL('pubsub://localhost:8087/wss/payments-cybersource?timeout=10000'));
  await dispatcher.add(new URL('http://localhost:5001/wss/us-central1/cyberSourcePaymentHTTP'));

  class PaymentQueryEvent extends Event {
    public action = 'token';
    public token = '';

    constructor() {
      super('payment.PAYMENT_QUERY');
    }
  }

  const e = new PaymentQueryEvent();
  await dispatcher.trigger(e);
  console.log(e);

  return Promise.resolve();
})();
