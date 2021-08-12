import nock from 'nock';
import { expect } from 'chai';
import { HeaderWssEvent, JsonEventKey } from '@basetime/wss-node-sdk';
import ManifestHandler from '../src/manifest';

describe('ManifestHandler', () => {
  describe('#fetchRemoteManifest', () => {
    it('downloads successfully', async () => {
      const response = {
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
      nock('http://localhost:5001')
        .post('/')
        .reply(200, response, {
          [HeaderWssEvent]: '__testing__',
        });

      const mh = new ManifestHandler();
      const manifest = await mh.fetchRemoteManifest(new URL('http://localhost:5001/'));
      expect(typeof manifest).to.equal('object');
      expect(manifest.name).to.equal('Test');
      expect(manifest.subsystem).to.equal('test');
      expect(manifest.subscriptions['payment.QUERY']).to.be.an.instanceOf(URL);
    });
  });

  describe('#parseRemoteManifest', () => {
    it('parses correctly', () => {
      const mh = new ManifestHandler();
      const manifest = mh.parseRemoteManifest({
        [JsonEventKey]: {
          name: 'Test',
          subsystem: 'test',
          description: 'Foo',
          version: '1.0',
          manifestVersion: '1.0',
          subscriptions: {},
        },
      });
      expect(typeof manifest).to.equal('object');
      expect(manifest.name).to.equal('Test');
      expect(manifest.subsystem).to.equal('test');
    });

    it('throws an error', () => {
      const mh = new ManifestHandler();
      expect(() => {
        mh.parseRemoteManifest({
          name: 'Test',
        });
      }).to.throw();
    });
  });
});
