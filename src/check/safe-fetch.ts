import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { pipeline, type Readable, type Transform } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "ClearPathReview/1.0 (ad compliance checker)";

const internal = new BlockList();
const loopback = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  internal.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  internal.addSubnet(network, prefix, "ipv6");
}
loopback.addSubnet("127.0.0.0", 8, "ipv4");
loopback.addAddress("::1", "ipv6");

// Lets `npm run dev` scan the demo affiliate pages the app serves on localhost.
const allowLoopback = process.env.NODE_ENV === "development";

function isRefusedAddress(address: string): boolean {
  const type = isIP(address) === 6 ? "ipv6" : "ipv4";
  if (loopback.check(address, type)) return !allowLoopback;
  return internal.check(address, type);
}

class RefusedAddressError extends Error {}
class TooLargeError extends Error {}
class UnknownEncodingError extends Error {}

// Checks the address a site name points to at the moment of connecting, so the site can't switch to an internal address between a check and the fetch.
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "");
    if (addresses.some((entry) => isRefusedAddress(entry.address))) return callback(new RefusedAddressError(), "");
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

export type SafeFetchResult = { ok: true; body: Buffer; contentType: string } | { ok: false; reason: string };

// Fetches a web page a visitor typed in, refusing internal addresses, following at most 3 redirects, within 5 seconds and 2 MB, HTML only.
export async function safeFetch(address: string): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return { ok: false, reason: "not a valid web address" };
  }

  for (let redirects = 0; ; redirects++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, reason: "only http and https links can be checked" };
    }
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && isRefusedAddress(host)) return { ok: false, reason: "address is on a private network" };

    let response: http.IncomingMessage;
    try {
      response = await get(url, signal);
    } catch (error) {
      return { ok: false, reason: describeError(error, signal) };
    }

    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if (status >= 300 && status < 400 && location) {
      response.resume();
      if (redirects === MAX_REDIRECTS) return { ok: false, reason: "too many redirects" };
      try {
        url = new URL(location, url);
      } catch {
        return { ok: false, reason: "redirected to an invalid address" };
      }
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      return { ok: false, reason: describeStatus(status) };
    }
    const contentType = response.headers["content-type"] ?? "";
    if (!/^\s*(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
      response.resume();
      return { ok: false, reason: "not an HTML page" };
    }

    try {
      return { ok: true, body: await readBody(response), contentType };
    } catch (error) {
      return { ok: false, reason: describeError(error, signal) };
    }
  }
}

function get(url: URL, signal: AbortSignal): Promise<http.IncomingMessage> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    client
      .get(
        url,
        {
          lookup: publicOnlyLookup,
          signal,
          headers: {
            "user-agent": USER_AGENT,
            accept: "text/html,application/xhtml+xml",
            "accept-encoding": "gzip, deflate, br",
          },
        },
        resolve,
      )
      .on("error", reject);
  });
}

// Counts bytes after decompressing, so a small compressed page can't expand past the limit.
async function readBody(response: http.IncomingMessage): Promise<Buffer> {
  if (Number(response.headers["content-length"]) > MAX_BYTES) {
    response.destroy();
    throw new TooLargeError();
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of decode(response)) {
    size += chunk.length;
    if (size > MAX_BYTES) {
      response.destroy();
      throw new TooLargeError();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const DECOMPRESSORS: Record<string, () => Transform> = {
  gzip: createGunzip,
  "x-gzip": createGunzip,
  deflate: createInflate,
  br: createBrotliDecompress,
};

function decode(response: http.IncomingMessage): Readable {
  const encoding = (response.headers["content-encoding"] ?? "identity").trim().toLowerCase();
  if (encoding === "identity") return response;
  const decompress = DECOMPRESSORS[encoding];
  if (!decompress) {
    response.destroy();
    throw new UnknownEncodingError();
  }
  return pipeline(response, decompress(), () => {});
}

function describeStatus(status: number): string {
  if (status === 404 || status === 410) return `page not found (${status})`;
  if (status === 401 || status === 403) return `blocked by the site (${status})`;
  if (status === 429) return "the site is limiting requests (429)";
  if (status >= 500) return `the site had an error (${status})`;
  return `the site answered with status ${status}`;
}

function describeError(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return "timed out after 5 seconds";
  if (error instanceof RefusedAddressError) return "address is on a private network";
  if (error instanceof TooLargeError) return "page is larger than 2 MB";
  if (error instanceof UnknownEncodingError) return "the page uses a compression format we can't read";
  const code = (error as NodeJS.ErrnoException).code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "site not found";
  if (code === "ECONNREFUSED") return "the site refused the connection";
  if (/CERT|SSL|TLS/.test(code)) return "the site's security certificate isn't valid";
  return "couldn't connect to the site";
}
