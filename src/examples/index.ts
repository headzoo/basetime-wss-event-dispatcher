import { Logger } from '@basetime/wss-node-sdk';
import EventDispatcher from '../index';
import { PaymentQueryEvent } from './events';

(async () => {
  const logger = new Logger('EventDispatcher', '1234', '1234');
  const dispatcher = new EventDispatcher(logger);
  // await dispatcher.add(new URL('pubsub://localhost:8089/wss/payments-cybersource?timeout=10000'));
  // await dispatcher.add(new URL('http://localhost:5001/wss/us-central1/cyberSourcePaymentHTTP'));
  await dispatcher.add(new URL('http://localhost:5001/wss/us-central1/cyberSourcePaymentRequest'));

  const e = new PaymentQueryEvent();
  await dispatcher.trigger(e, { sessionId: '1234', clubId: '1234' });
  console.log(e);

  return Promise.resolve();
})();
