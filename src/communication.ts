import {
  HeaderWssEvent,
  HeaderWssVersion,
  HeaderWssAttrib,
  JsonReturnTopic,
} from '@basetime/wss-node-sdk';
import fetch from 'node-fetch';
import uuid4 from 'uuid4';
import { clearTimeout } from 'timers';
import {
  PubSub,
  Subscription,
  Message,
} from '@google-cloud/pubsub';
import { Attributes } from './attributes';

/**
 * Used to communicate with remote event handlers.
 */
export default class Communication {
  /**
   * Makes a POST request with the given body (which will be JSON encoded)
   *
   * @param url
   * @param body
   * @param a
   */
  public post = (url: string | URL, body: any, a: Attributes): Promise<[any, string]> => {
    let newBody: any;
    if (typeof body === 'object') {
      newBody = {};
      Object.keys(body).forEach((key) => {
        if (typeof body[key] !== 'function') {
          newBody[key] = body[key];
        }
      });
    } else {
      newBody = body;
    }

    const messageId = uuid4();
    const options = {
      method: 'POST',
      body: JSON.stringify(newBody),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        [HeaderWssEvent]: messageId,
      },
    };
    Object.keys(a).forEach((key) => {
      options.headers[`${HeaderWssAttrib}-${key}`] = `${key}:${a[key]}`;
    });

    let version: string;
    return fetch(url, options)
      .then((res) => {
        const wssEvent = res.headers.get(HeaderWssEvent);
        if (wssEvent !== messageId && wssEvent !== '__testing__') {
          throw new Error('Response did not include correct event header');
        }
        version = res.headers.get(HeaderWssVersion);
        if (!version && wssEvent !== '__testing__') {
          throw new Error('Response did not include version header');
        }

        return res.json();
      })
      .then((json) => {
        return [json, version];
      });
  };

  /**
   * Sends a message to a pubsub topic and returns the response
   *
   * @param handler
   * @param body
   * @param a
   */
  public pubSub = async (handler: URL, body: any, a: Attributes): Promise<[any, string]> => {
    let waitTimeout;
    let waitResolve;

    const pubSubPromise = new Promise((resolve, reject) => {
      const [projectId, topicName] = handler.pathname.substring(1).split('/', 2);
      const p = new PubSub({
        projectId,
        apiEndpoint: handler.host,
      });

      const messageId = uuid4();
      this.createPubSubReturnSubscription(projectId, handler.host, topicName)
        .then((subscription) => {
          subscription.on('message', (message: Message) => {
            if (message.attributes[HeaderWssEvent] === messageId) {
              subscription.close();
              const data = JSON.parse(message.data.toString());
              resolve([data, message.attributes[HeaderWssVersion]]);
            }
          });
          subscription.on('error', (error) => {
            subscription.close();
            reject(error);
          });

          const attribs = {
            [JsonReturnTopic]: `${handler.host}/${projectId}/${topicName}-return`,
            [HeaderWssEvent]: messageId,
          };
          Object.keys(a).forEach((key) => {
            attribs[`${HeaderWssAttrib}-${key}`] = a[key];
          });
          return p.topic(topicName).publishJSON(body, attribs);
        })
        .catch((error) => {
          reject(error);
        });
    });

    const timeout = handler.searchParams.get('timeout') || '10000';
    const timeoutPromise = new Promise((resolve, reject) => {
      waitResolve = resolve;
      waitTimeout = setTimeout(() => {
        waitResolve = null;
        reject(new Error('Request timed out'));
      }, parseInt(timeout, 10));
    });

    const result = await Promise.race([timeoutPromise, pubSubPromise])
      .finally(() => {
        clearTimeout(waitTimeout);
        if (waitResolve) {
          waitResolve();
        }
      });

    return result as [any, string];
  };

  /**
   * @param projectId
   * @param apiEndpoint
   * @param topicName
   */
  protected createPubSubReturnSubscription = async (
    projectId: string,
    apiEndpoint: string,
    topicName: string,
  ): Promise<Subscription> => {
    const p = new PubSub({
      projectId,
      apiEndpoint,
    });
    const [topic] = await p.topic(`${topicName}-return`).get({ autoCreate: true });
    const [subscription] = await topic.subscription(`${topicName}-return`).get({ autoCreate: true });

    return subscription;
  };
}
