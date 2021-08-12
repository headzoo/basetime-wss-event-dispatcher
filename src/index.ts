import cacheManager, { Cache } from 'cache-manager';
import {
  IEvent,
  Event,
  Manifest,
  AnyEventHandler,
  JsonEventKey,
  JsonPluginVersion,
  Logger,
} from '@basetime/wss-node-sdk';
import ManifestHandler from './manifest';
import Communication from './communication';
import { Attributable, Attributes } from './attributes';

type EventCallback = URL | ((e: IEvent, attributes: Record<string, any>) => Promise<void>);
type EventHandlers = Record<string, { callback: AnyEventHandler, manifest: Manifest }>;
type EventListeners = Record<string, Record<string, EventCallback[]>>;

/**
 * Dispatches events to local and remote event handlers.
 */
export default class EventDispatcher implements Attributable {
  protected static manifestCacheSeconds = 300;
  private handlers: EventHandlers = {};
  private listeners: EventListeners = {};
  private manifestHandler: ManifestHandler;
  private readonly communication: Communication;
  private cache: Cache;

  /**
   * Constructor
   *
   * @param logger Logs incoming and outgoing requests
   * @param attributes Get passed along to each event handler
   * @param cache Caches manifests
   */
  constructor(
    protected logger: Logger,
    protected attributes: Attributes = {},
    cache?: Cache,
  ) {
    this.communication = new Communication();
    this.manifestHandler = new ManifestHandler(this.communication);
    this.cache = cache || cacheManager.caching({
      store: 'memory',
      max: 100,
      ttl: EventDispatcher.manifestCacheSeconds,
    });
  }

  /**
   * @inheritDoc
   */
  public setAttributes = (attributes: Attributes): void => {
    this.attributes = attributes;
  };

  /**
   * Returns the event handlers which have been added to the dispatcher
   */
  public getHandlers = (): EventHandlers => {
    return this.handlers;
  };

  /**
   * Adds an event handler
   *
   * @param handler
   */
  public add = async (handler: AnyEventHandler): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (handler instanceof URL) {
          this.cache.wrap<Manifest>(handler.toString(), () => {
            return this.manifestHandler.fetchRemoteManifest(handler, this.attributes);
          }, { ttl: EventDispatcher.manifestCacheSeconds })
            .then((manifest) => {
              this.saveManifest(handler, manifest);
              resolve();
            })
            .catch(reject);
        } else {
          this.saveManifest(handler, this.manifestHandler.createLocalManifest(handler));
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * Sends the given event to handlers which subscribe to the event
   *
   * @param e
   * @param a
   */
  public trigger = async (e: IEvent, a: Attributes = {}): Promise<void> => {
    if (!(e instanceof Event)) {
      throw new Error('Invalid event argument.');
    }

    const attributes = { ...this.attributes, ...a };
    const handlerNames = Object.keys(this.listeners);
    for (let y = 0; y < handlerNames.length; y++) {
      const handlerName = handlerNames[y];
      const handleManifest = this.handlers[handlerName].manifest;

      if (this.listeners[handlerName] && this.listeners[handlerName][e.name]) {
        const listeners = this.listeners[handlerName][e.name];

        for (let i = 0; i < listeners.length; i++) {
          try {
            const callback = listeners[i];
            if (callback instanceof URL) {
              const req = {
                [JsonEventKey]: e,
                [JsonPluginVersion]: handleManifest.version,
              };
              const comFunc = callback.protocol === 'pubsub:' ? this.communication.pubSub : this.communication.post;
              this.logger.debug(`Dispatching to "${callback.toString()}"`, req);
              const [body, version] = await comFunc(callback, req, attributes);
              this.logger.debug(`Response from "${callback.toString()}"`, body);

              this.mergeRemoteEventValues(e, body);
              this.reloadManifest(handlerName, version);
            } else if (typeof callback === 'function') {
              await callback(e, this.attributes);
            }

            if (e.isPropagationStopped) {
              break;
            }
          } catch (error) {
            this.logger.error(error);
          }
        }
      }
    }
  };

  /**
   * Combine the original event with values returned by an event handler
   *
   * @param e
   * @param values
   */
  protected mergeRemoteEventValues = (e: IEvent, values: any): IEvent => {
    if (values[JsonEventKey] === undefined) {
      throw new Error(`Remote event handler incorrect ${JsonEventKey} response.`);
    }
    Object.keys(values[JsonEventKey]).forEach((key) => {
      // @ts-ignore
      if (key !== 'name' && e[key] !== undefined) {
        // @ts-ignore
        e[key] = values[JsonEventKey][key];
      }
    });

    return e;
  };

  /**
   * Fills this.listeners with subscriptions found in the manifest
   *
   * @param handler
   * @param manifest
   */
  protected saveManifest = (handler: AnyEventHandler, manifest: Manifest) => {
    const name = `${manifest.subsystem}.${manifest.name}`;
    this.handlers[name] = {
      manifest,
      callback: handler,
    };

    Object.keys(manifest.subscriptions).forEach((eventName) => {
      if (!this.listeners[name]) {
        this.listeners[name] = {};
      }
      if (!this.listeners[name][eventName]) {
        this.listeners[name][eventName] = [];
      }
      const callback = manifest.subscriptions[eventName];
      if (callback instanceof URL || typeof callback === 'function') {
        this.listeners[name][eventName].push(callback);
      }
    });
  };

  /**
   * @param handlerName
   * @param version
   */
  protected reloadManifest = (handlerName: string, version: string) => {
    const handler = this.handlers[handlerName];
    if (handler.manifest.version !== version && handler.callback instanceof URL) {
      this.logger.debug(`Reloading manifest for ${handler.callback.toString()}`);
      this.manifestHandler.fetchRemoteManifest(handler.callback, this.attributes)
        .then((manifest) => {
          this.saveManifest(handler.callback, manifest);
        });
    }
  };
}
