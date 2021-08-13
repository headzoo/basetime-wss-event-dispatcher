WSS Event Dispatcher
====================
Event dispatcher which can dispatch events to local code and remote HTTP and pubsub endpoints.

```typescript
import { Event, Logger } from '@basetime/wss-node-sdk';
import EventDispatcher from '@basetime/wss-event-dispatcher';
import { PaymentQueryEvent } from './events';
import WheatherPlugin from './weatherPlugin';

(async () => {
  const dispatcher = new EventDispatcher(new Logger('EventDispatcher', '1234', '4567'));
  await dispatcher.add(new URL('https://us-central1-project.cloudfunctions.net/cybersourcePayments'));
  await dispatcher.add(new URL('pubsub://us-central1-project.cloudfunctions.net/shift4Payments'));
  await dispatcher.add(new WheatherPlugin());

  const e = new PaymentQueryEvent();
  await dispatcher.trigger(e, { sessionId: '1234', clubId: '4567' });
  console.log(e);
})();
```

The event handlers can be added to the event dispatcher using strings which are suitable for config storage. Such as saving the list of enabled plugins in a database or other config store.

```typescript
import { Logger } from '@basetime/wss-node-sdk';
import EventDispatcher from '../index';
import { PaymentQueryEvent } from './events';

(async () => {
  const logger = new Logger('EventDispatcher', '1234', '1234');
  const dispatcher = new EventDispatcher(logger);

  const config = [
    'http://localhost:5001/wss/us-central1/cyberSourcePaymentRequest',
    'http://localhost:5001/wss/us-central1/cyberSourcePaymentHTTP',
    'pubsub://localhost:8089/wss/payments-cybersource?timeout=10000',
    `${__dirname}/plugins/paymentHandler`,
  ];
  await dispatcher.addFromConfig(config);

  const e = new PaymentQueryEvent();
  await dispatcher.trigger(e, { sessionId: '1234', clubId: '1234' });
  console.log(e);
})();
```
