import {
  IEvent,
  Event,
  Manifest,
  AnyEventHandler,
  JsonEventKey,
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
  private handlers: EventHandlers = {};
  private listeners: EventListeners = {};
  private manifestHandler: ManifestHandler;
  private communication: Communication;

  /**
   * Constructor
   *
   * @param logger
   * @param attributes Get passed along to each event handler
   */
  constructor(
    protected logger: Logger,
    protected attributes: Attributes = {},
  ) {
    this.manifestHandler = new ManifestHandler(this.attributes);
    this.communication = new Communication(this.attributes);
  }

  /**
   * @inheritDoc
   */
  public setAttributes = (attributes: Attributes): void => {
    this.attributes = attributes;
    this.manifestHandler.setAttributes(attributes);
    this.communication.setAttributes(attributes);
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
          this.manifestHandler.fetchRemoteManifest(handler)
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
   */
  public trigger = async (e: IEvent): Promise<void> => {
    if (!(e instanceof Event)) {
      throw new Error('Invalid event argument.');
    }

    const handlerNames = Object.keys(this.listeners);
    for (let y = 0; y < handlerNames.length; y++) {
      const handlerName = handlerNames[y];

      if (this.listeners[handlerName] && this.listeners[handlerName][e.name]) {
        const listeners = this.listeners[handlerName][e.name];

        for (let i = 0; i < listeners.length; i++) {
          try {
            const callback = listeners[i];
            if (callback instanceof URL) {
              const comFunc = callback.protocol === 'pubsub:' ? this.communication.pubSub : this.communication.post;
              this.logger.debug(`Dispatching to "${callback.toString()}"`, e);
              const [body, version] = await comFunc(callback, { [JsonEventKey]: e });
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
      this.manifestHandler.fetchRemoteManifest(handler.callback)
        .then((manifest) => {
          this.saveManifest(handler.callback, manifest);
        });
    }
  };
}
