// eslint-disable-next-line max-classes-per-file
import nock from 'nock';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  EventHandlerCallback,
  Event,
  EventHandler,
  JsonEventKey,
  HeaderWssEvent,
  Logger,
} from '@basetime/wss-node-sdk';
import EventDispatcher from '../src';

chai.use(chaiAsPromised);

declare global {
  module Chai {
    interface Assertion {
      rejectedWith: (e: any) => Assertion;
    }
  }
}

class PaymentQueryEvent extends Event {
  public isComplete = false;

  constructor() {
    super('payment.QUERY');
  }
}

class TestEventHandler extends EventHandler {
  getDescription = (): string => {
    return 'Foo';
  };

  getName = (): string => {
    return 'Test';
  };

  getSubsystem = (): string => {
    return 'test';
  };

  getVersion = (): string => {
    return '1.0';
  };

  getSubscriptions = (): Record<string, EventHandlerCallback> => {
    return {
      'payment.QUERY': this.handleTest,
    };
  };

  handleTest = async (e: PaymentQueryEvent): Promise<void> => {
    e.isComplete = true;
    e.stopPropagation();
  };
}

const logger = new Logger('testing', '', '', 0, 0);

describe('EventDispatcher', () => {
  describe('#add', () => {
    it('adds a local event handler', async () => {
      const dispatcher = new EventDispatcher(logger);
      await dispatcher.add(new TestEventHandler());
      const handlers = dispatcher.getHandlers();

      expect(typeof handlers).to.equal('object');
      expect(handlers).to.have.key('test.Test');
      expect(handlers['test.Test'].manifest.subscriptions).to.have.key('payment.QUERY');
    });

    it('adds a remote event handler', async () => {
      nock('http://localhost:5001')
        .post('/')
        .reply(200, () => {
          return {
            [JsonEventKey]: {
              name: 'Test',
              subsystem: 'test',
              description: 'Foo',
              version: '1.0',
              manifestVersion: '1.0',
              subscriptions: {
                'payment.QUERY': '/payment-query',
              },
            },
          };
        }, {
          [HeaderWssEvent]: '__testing__',
        });

      const dispatcher = new EventDispatcher(logger);
      await dispatcher.add(new URL('http://localhost:5001/'));
      const handlers = dispatcher.getHandlers();

      expect(typeof handlers).to.equal('object');
      expect(handlers).to.have.key('test.Test');
      expect(handlers['test.Test'].manifest.subscriptions).to.have.key('payment.QUERY');
      expect(handlers['test.Test'].manifest.subscriptions['payment.QUERY']).to.be.instanceOf(URL);
    });
  });

  describe('#trigger', () => {
    it('triggers a local event handler', async () => {
      const dispatcher = new EventDispatcher(logger);
      await dispatcher.add(new TestEventHandler());
      const e = new PaymentQueryEvent();
      await dispatcher.trigger(e);
      expect(e.isComplete).to.equal(true);
      expect(e.isPropagationStopped).to.equal(true);
    });

    it('triggers a remote event handler', async () => {
      nock('http://localhost:5001')
        .post('/')
        .reply(200, () => {
          return {
            [JsonEventKey]: {
              name: 'Test',
              subsystem: 'test',
              description: 'Foo',
              version: '1.0',
              manifestVersion: '1.0',
              subscriptions: {
                'payment.QUERY': '/payment-query',
              },
            },
          };
        }, {
          [HeaderWssEvent]: '__testing__',
        });

      nock('http://localhost:5001')
        .post('/payment-query')
        .reply(200, () => {
          return {
            [JsonEventKey]: {
              isComplete: true,
              isPropagationStopped: true,
            },
          };
        }, {
          [HeaderWssEvent]: '__testing__',
        });

      const dispatcher = new EventDispatcher(logger);
      await dispatcher.add(new URL('http://localhost:5001/'));
      const e = new PaymentQueryEvent();
      await dispatcher.trigger(e);
      expect(e.isComplete).to.equal(true);
      expect(e.isPropagationStopped).to.equal(true);
    });

    it('does not return the wss event header', async () => {
      nock('http://localhost:5001')
        .post('/')
        .reply(200, () => {
          return {
            [JsonEventKey]: {
              name: 'Test',
              subsystem: 'test',
              description: 'Foo',
              version: '1.0',
              manifestVersion: '1.0',
              subscriptions: {
                'payment.QUERY': '/payment-query',
              },
            },
          };
        });

      const dispatcher = new EventDispatcher(logger);
      await expect(dispatcher.add(new URL('http://localhost:5001/'))).to.be.rejectedWith(Error);
    });
  });
});
