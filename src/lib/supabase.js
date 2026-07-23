// Lightweight lazy facade for the cookie-based Supabase browser client.
//
// Most call sites already await a Supabase query or attach .then(), so this
// proxy can preserve that public shape while keeping @supabase/* out of the
// synchronous app shell. APIs that must return synchronously (auth listeners
// and Realtime channels) use getSupabase() before subscribing.

let clientPromise;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import('./supabaseClient')
      .then((module) => module.supabase)
      .catch((error) => {
        clientPromise = undefined;
        throw error;
      });
  }
  return clientPromise;
}

function replay(client, operations) {
  let value = client;
  let receiver;

  for (const operation of operations) {
    if (operation.type === 'get') {
      receiver = value;
      value = Reflect.get(value, operation.property);
    } else {
      value = Reflect.apply(value, receiver, operation.args);
      receiver = undefined;
    }
  }

  return value;
}

function lazyPath(operations = []) {
  return new Proxy(() => {}, {
    get(_target, property) {
      if (property === 'then' || property === 'catch' || property === 'finally') {
        const promise = getSupabase().then((client) => replay(client, operations));
        return promise[property].bind(promise);
      }
      return lazyPath([...operations, { type: 'get', property }]);
    },
    apply(_target, _thisArg, args) {
      return lazyPath([...operations, { type: 'call', args }]);
    },
  });
}

export const supabase = lazyPath();
