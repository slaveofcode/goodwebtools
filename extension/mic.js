// Asks once for microphone access for the extension, so recordings can include
// your voice. (The offscreen document that records can't show the prompt itself.)
import { pickLang } from './lib/menus.js';

const T = {
  en: { title: 'Microphone for recordings', text: 'Allow the microphone so your recordings can include your voice. It is only used while you record, and nothing is uploaded.', grant: 'Allow microphone', ok: 'Microphone allowed — you can close this tab.', no: 'Microphone was blocked. You can allow it later from the site settings of this extension.' },
  id: { title: 'Mikrofon untuk rekaman', text: 'Izinkan mikrofon agar rekaman Anda bisa menyertakan suara Anda. Hanya dipakai saat merekam, dan tidak ada yang diunggah.', grant: 'Izinkan mikrofon', ok: 'Mikrofon diizinkan — Anda bisa menutup tab ini.', no: 'Mikrofon diblokir. Anda bisa mengizinkannya nanti dari pengaturan situs ekstensi ini.' },
};
const $ = (id) => document.getElementById(id);
const { gwtLang } = await chrome.storage.local.get('gwtLang');
const t = T[pickLang(gwtLang, chrome.i18n.getUILanguage())];
$('title').textContent = t.title;
$('text').textContent = t.text;
$('grant').textContent = t.grant;
$('grant').addEventListener('click', async () => {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((tr) => tr.stop());
    $('status').textContent = t.ok;
    await chrome.storage.local.set({ recMic: true });
    setTimeout(() => window.close(), 1500);
  } catch {
    $('status').textContent = t.no;
    await chrome.storage.local.set({ recMic: false });
  }
});
