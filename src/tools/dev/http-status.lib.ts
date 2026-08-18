/**
 * HTTP status code reference + lookup. Pure and framework-free.
 * Descriptions are short, developer-facing paraphrases of the RFC meanings.
 */

export type StatusClass = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

export interface HttpStatus {
  code: number;
  name: string;
  category: StatusClass;
  description: string;
}

const S = (code: number, name: string, description: string): HttpStatus => ({
  code,
  name,
  category: `${Math.floor(code / 100)}xx` as StatusClass,
  description,
});

export const HTTP_STATUSES: HttpStatus[] = [
  // 1xx — informational
  S(100, 'Continue', 'The client should continue the request or ignore this response if already finished.'),
  S(101, 'Switching Protocols', 'The server is switching protocols as requested by the client (e.g. to WebSocket).'),
  S(102, 'Processing', 'The server has received and is processing the request, but no response is available yet (WebDAV).'),
  S(103, 'Early Hints', 'Used to return some response headers (e.g. preload links) before the final response.'),

  // 2xx — success
  S(200, 'OK', 'The request succeeded. The meaning depends on the HTTP method used.'),
  S(201, 'Created', 'The request succeeded and a new resource was created as a result.'),
  S(202, 'Accepted', 'The request has been received but not yet acted upon — processing is asynchronous.'),
  S(203, 'Non-Authoritative Information', 'The returned metadata is from a copy or a third party, not the origin server.'),
  S(204, 'No Content', 'The request succeeded but there is no content to send in the response body.'),
  S(205, 'Reset Content', 'Tells the client to reset the document that sent the request (e.g. clear a form).'),
  S(206, 'Partial Content', 'The server is delivering only part of the resource in response to a Range header.'),
  S(207, 'Multi-Status', 'Conveys information about multiple resources for WebDAV requests.'),
  S(208, 'Already Reported', 'Members of a WebDAV binding have already been enumerated and are not included again.'),
  S(226, 'IM Used', 'The server fulfilled a GET request; the response represents one or more instance-manipulations.'),

  // 3xx — redirection
  S(300, 'Multiple Choices', 'The request has more than one possible response; the client should choose one.'),
  S(301, 'Moved Permanently', 'The resource has a new permanent URL, given by the Location header.'),
  S(302, 'Found', 'The resource is temporarily at a different URL; keep using the original URL for future requests.'),
  S(303, 'See Other', 'The client should GET the resource at another URL, typically after a POST.'),
  S(304, 'Not Modified', 'The cached version is still valid; the client can reuse it (conditional GET).'),
  S(307, 'Temporary Redirect', 'Like 302, but the method and body must not change when redirecting.'),
  S(308, 'Permanent Redirect', 'Like 301, but the method and body must not change when redirecting.'),

  // 4xx — client errors
  S(400, 'Bad Request', 'The server cannot process the request due to a client error (malformed syntax, invalid framing).'),
  S(401, 'Unauthorized', 'Authentication is required and has failed or not yet been provided.'),
  S(402, 'Payment Required', 'Reserved for future use; sometimes used by APIs for billing/quota limits.'),
  S(403, 'Forbidden', 'The server understood the request but refuses to authorize it.'),
  S(404, 'Not Found', 'The server cannot find the requested resource. The URL is unrecognised.'),
  S(405, 'Method Not Allowed', 'The request method is known but not supported by the target resource.'),
  S(406, 'Not Acceptable', 'The resource cannot produce a response matching the Accept headers.'),
  S(407, 'Proxy Authentication Required', 'Authentication with a proxy is required before the request can proceed.'),
  S(408, 'Request Timeout', 'The server timed out waiting for the request. The client may repeat it.'),
  S(409, 'Conflict', 'The request conflicts with the current state of the resource (e.g. edit conflict).'),
  S(410, 'Gone', 'The resource is permanently gone with no forwarding address.'),
  S(411, 'Length Required', 'The server requires a Content-Length header, which was not provided.'),
  S(412, 'Precondition Failed', 'A precondition in the request headers (e.g. If-Match) was not met.'),
  S(413, 'Payload Too Large', 'The request body is larger than the server is willing or able to process.'),
  S(414, 'URI Too Long', 'The request URI is longer than the server is willing to interpret.'),
  S(415, 'Unsupported Media Type', 'The request body is in a format the server does not support.'),
  S(416, 'Range Not Satisfiable', 'The Range specified cannot be fulfilled — it may lie outside the resource size.'),
  S(417, 'Expectation Failed', 'The expectation in the Expect request header could not be met.'),
  S(418, "I'm a teapot", 'An April Fools joke from RFC 2324 — the server refuses to brew coffee in a teapot.'),
  S(421, 'Misdirected Request', 'The request was directed at a server unable to produce a response for it.'),
  S(422, 'Unprocessable Entity', 'The request was well-formed but has semantic errors and cannot be processed (common for validation).'),
  S(423, 'Locked', 'The resource being accessed is locked (WebDAV).'),
  S(424, 'Failed Dependency', 'The request failed because it depended on another request that failed (WebDAV).'),
  S(425, 'Too Early', 'The server is unwilling to process a request that might be replayed.'),
  S(426, 'Upgrade Required', 'The client should switch to a different protocol given in the Upgrade header.'),
  S(428, 'Precondition Required', 'The origin server requires the request to be conditional to avoid lost updates.'),
  S(429, 'Too Many Requests', 'The client has sent too many requests in a given time (rate limiting).'),
  S(431, 'Request Header Fields Too Large', 'The header fields are too large for the server to process.'),
  S(451, 'Unavailable For Legal Reasons', 'The resource is unavailable due to legal demands (e.g. censorship).'),

  // 5xx — server errors
  S(500, 'Internal Server Error', 'The server hit an unexpected condition that prevented it from fulfilling the request.'),
  S(501, 'Not Implemented', 'The server does not support the functionality required to fulfil the request.'),
  S(502, 'Bad Gateway', 'The server, acting as a gateway, got an invalid response from the upstream server.'),
  S(503, 'Service Unavailable', 'The server is not ready — it may be overloaded or down for maintenance.'),
  S(504, 'Gateway Timeout', 'The server, acting as a gateway, did not get a timely response from the upstream server.'),
  S(505, 'HTTP Version Not Supported', 'The HTTP version used in the request is not supported by the server.'),
  S(506, 'Variant Also Negotiates', 'A content-negotiation configuration error on the server.'),
  S(507, 'Insufficient Storage', 'The server cannot store the representation needed to complete the request (WebDAV).'),
  S(508, 'Loop Detected', 'The server detected an infinite loop while processing the request (WebDAV).'),
  S(510, 'Not Extended', 'Further extensions to the request are required for the server to fulfil it.'),
  S(511, 'Network Authentication Required', 'The client needs to authenticate to gain network access (e.g. a captive portal).'),
];

export const CLASS_LABELS: Record<StatusClass, string> = {
  '1xx': 'Informational',
  '2xx': 'Success',
  '3xx': 'Redirection',
  '4xx': 'Client Error',
  '5xx': 'Server Error',
};

/** Find one status by exact code. */
export function statusByCode(code: number): HttpStatus | undefined {
  return HTTP_STATUSES.find((s) => s.code === code);
}

/**
 * Filter statuses by a free-text query: an exact/partial code, a class like
 * "4xx", or a word from the name/description. Empty query returns everything.
 */
export function searchStatuses(query: string): HttpStatus[] {
  const q = query.trim().toLowerCase();
  if (!q) return HTTP_STATUSES;
  if (/^[1-5]xx$/.test(q)) return HTTP_STATUSES.filter((s) => s.category === q);
  return HTTP_STATUSES.filter(
    (s) =>
      String(s.code).includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q),
  );
}
