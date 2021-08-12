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
