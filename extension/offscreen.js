// Offscreen document: the only place in the extension with a DOM, so it does the
// actual getUserMedia + canvas grab from a desktopCapture stream id.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'grab') return;
  grab(msg.streamId)
    .then((res) => sendResponse(res))
    .catch((e) => sendResponse({ error: e.message || String(e) }));
  return true; // async
});

async function grab(streamId) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // Legacy mandatory constraints are how a desktopCapture streamId is consumed.
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId,
        },
      },
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // One frame is enough; give the stream a beat to deliver dimensions.
    await new Promise((r) => setTimeout(r, 120));

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error('empty-frame');

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, width: w, height: h };
  } finally {
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }
}
