// Show the current hotkey and let the user fire a capture from the popup.

chrome.commands.getAll((cmds) => {
  const cmd = cmds.find((c) => c.name === 'capture-screenshot');
  document.getElementById('hotkey').textContent = cmd?.shortcut || 'unset';
});

document.getElementById('capture').addEventListener('click', async () => {
  // Reuse the hotkey path in the service worker by dispatching the command flow.
  // We can't call chrome.commands programmatically, so trigger capture directly.
  const res = await chrome.runtime.sendMessage({ type: 'capture' });
  if (res?.ok) {
    await chrome.storage.session.set({ pendingCapture: res });
    await chrome.tabs.create({ url: chrome.runtime.getURL('select.html') });
    window.close();
  }
});

document.getElementById('shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
