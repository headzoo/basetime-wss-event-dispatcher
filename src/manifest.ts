import {
  Manifest,
  IEventHandler,
  ManifestEventName,
  JsonEventKey,
} from '@basetime/wss-node-sdk';
import Communication from './communication';
import { Attributes } from './attributes';

/**
 * Used to fetch and parse manifests.
 */
export default class ManifestHandler {
  protected communication: Communication;

  /**
   * Constructor
   *
   * @param communication
   */
  constructor(communication?: Communication) {
    this.communication = communication || new Communication();
  }

  /**
   *
   * @param communication
   */
  public setCommunication = (communication: Communication) => {
    this.communication = communication;
  };

  /**
   * Fetches a remote event listener manifest
   *
   * @param url
   * @param a
   */
  public fetchRemoteManifest = (url: URL, a: Attributes): Promise<Manifest> => {
    return new Promise((resolve, reject) => {
      const data = {
        [JsonEventKey]: { name: ManifestEventName },
      };

      /**
       * @param body
       */
      const handleBody = ([body]: [any, string]) => {
        const manifest = this.parseRemoteManifest(body);

        // Remote event handlers return string callback values which map to
        // http endpoints on the remote handler server. Convert those relative
        // paths to full URLs.
        const { subscriptions } = manifest;
        Object.keys(subscriptions).forEach((eventName) => {
          let path = subscriptions[eventName];
          if (typeof path === 'string') {
            if (path.indexOf('/') !== 0) {
              path = `/${path}`;
            }
            subscriptions[eventName] = new URL(
              `${url.pathname === '/' ? '' : url.pathname}${path}`,
              `${url.protocol}//${url.host}`,
            );
          }
        });

        resolve(manifest);
      };

      if (url.protocol === 'pubsub:') {
        this.communication.pubSub(url, data, a)
          .then(handleBody)
          .catch(reject);
      } else {
        this.communication.post(url, data, a)
          .then(handleBody)
          .catch(reject);
      }
    });
  };

  /**
   * Converts a JSON string representation of a manifest into a Manifest instance
   *
   * @param jsonData
   */
  public parseRemoteManifest = (jsonData: any): Manifest => {
    if (typeof jsonData !== 'object') {
      throw new Error('Expected remote manifest to be typeof object');
    }
    if (typeof jsonData[JsonEventKey] === undefined) {
      throw new Error(`Remote event handler incorrect ${JsonEventKey} response.`);
    }
    ['manifestVersion', 'name', 'subsystem', 'description', 'version', 'subscriptions'].forEach((key) => {
      if (jsonData[JsonEventKey][key] === undefined) {
        throw new Error(`Remote manifest missing key "${key}"`);
      }
    });

    return jsonData[JsonEventKey] as Manifest;
  };

  /**
   * Returns a manifest for a local event handler
   *
   * @param handler
   */
  public createLocalManifest = (handler: IEventHandler): Manifest => {
    return {
      name: handler.getName(),
      subsystem: handler.getSubsystem(),
      subscriptions: handler.getSubscriptions(),
      description: handler.getDescription(),
      version: handler.getVersion(),
      manifestVersion: '1.0',
    };
  };
}
