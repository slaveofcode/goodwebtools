// Bridge between the GoodWebTools web app and the extension.
//
// The web page can't call chrome.* APIs and doesn't know our extension id, so it
// talks to us with window.postMessage and we relay to the service worker. This
// keeps the bridge working for unpacked / self-hosted builds where the id varies.
//
// Page → us:   { source: 'gwt-page', type: 'ping' | 'capture', id }
// Us → page:   { source: 'gwt-ext',  type: 'pong' | 'capture-result', id, ... }

const PAGE = 'gwt-page';
const EXT = 'gwt-ext';

function post(msg) {
  window.postMessage({ source: EXT, ...msg }, window.location.origin);
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== PAGE) return;

  if (data.type === 'ping') {
    post({ type: 'pong', id: data.id, version: chrome.runtime.getManifest().version });
    return;
  }

  if (data.type === 'capture') {
    chrome.runtime.sendMessage({ type: 'capture' }, (res) => {
      if (chrome.runtime.lastError) {
        post({ type: 'capture-result', id: data.id, ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      post({ type: 'capture-result', id: data.id, ...res });
    });
  }
});

// Announce presence so a tool mounted after us can detect the extension without polling.
post({ type: 'pong', id: 'hello', version: chrome.runtime.getManifest().version });
