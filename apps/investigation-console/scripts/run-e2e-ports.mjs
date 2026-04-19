import net from 'node:net';

export const DEFAULT_CONSOLE_BFF_PORT = 4318;
export const DEFAULT_CONSOLE_WEB_PORT = 4173;

const AUTO_PORT_SCAN_LIMIT = 20;

export async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close((error) => {
        resolve(!error);
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

export async function resolvePortPlan(options) {
  const reservedPorts = new Set();
  const checkPort = async (port) => !reservedPorts.has(port) && await options.isPortAvailable(port);
  const webPort = await resolveRequestedPort({
    requestedPort: options.requestedWebPort,
    explicit: options.explicitWebPort,
    label: 'Console web',
    isPortAvailable: checkPort
  });
  reservedPorts.add(webPort);

  const bffPort = await resolveRequestedPort({
    requestedPort: options.requestedBffPort,
    explicit: options.explicitBffPort,
    label: 'Console BFF',
    isPortAvailable: checkPort
  });

  return {
    webPort,
    bffPort
  };
}

async function resolveRequestedPort(options) {
  const { requestedPort, explicit, label, isPortAvailable } = options;

  if (await isPortAvailable(requestedPort)) {
    return requestedPort;
  }

  if (explicit) {
    throw new Error(`${label} port ${requestedPort} is already in use. Stop the existing process and retry.`);
  }

  for (let port = requestedPort + 1; port < requestedPort + 1 + AUTO_PORT_SCAN_LIMIT; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No free ${label} port was found in ${requestedPort}-${requestedPort + AUTO_PORT_SCAN_LIMIT}.`);
}