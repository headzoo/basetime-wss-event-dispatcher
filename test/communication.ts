import nock from 'nock';
import { expect } from 'chai';
import { HeaderWssEvent } from '@basetime/wss-node-sdk';
import Communication from '../src/communication';

describe('Communication', () => {
  beforeEach(() => {
    const response = {
      name: 'payments.QUERY',
      isComplete: true,
    };
    nock('http://localhost:5001')
      .post('/payment-query')
      .reply(200, response, {
        [HeaderWssEvent]: '__testing__',
      });
  });

  describe('#post', () => {
    it('request is complete', () => {
      const c = new Communication();
      return c.post('http://localhost:5001/payment-query', { event: { name: 'payments.QUERY' } }, {})
        .then(([resp]) => {
          expect(typeof resp).to.equal('object');
          expect(resp.isComplete).to.equal(true);
        });
    });
  });
});
