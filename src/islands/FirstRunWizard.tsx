import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PermissionStatus {
  screenRecording: boolean;
  microphone: boolean;
  ffmpegAvailable: boolean;
  firstRun: boolean;
}

type Step = 'welcome' | 'screen-recording' | 'microphone' | 'ffmpeg' | 'done';

const STEPS: Step[] = ['welcome', 'screen-recording', 'microphone', 'ffmpeg', 'done'];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex gap-2 justify-center mt-6">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`w-2 h-2 rounded-full transition-colors ${
            i <= idx ? 'bg-blue-500' : 'bg-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="text-green-400 text-xl">✓</span>
  ) : (
    <span className="text-red-400 text-xl">✗</span>
  );
}

export default function FirstRunWizard() {
  const [perms, setPerms] = useState<PermissionStatus | null>(null);
  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);

  const loadPerms = async () => {
    try {
      const status = await invoke<PermissionStatus>('check_permissions');
      setPerms(status);
    } catch (e) {
      console.error('check_permissions failed', e);
    }
  };

  useEffect(() => {
    loadPerms();
  }, []);

  const openPrefs = async (section: string) => {
    try {
      await invoke('open_system_preferences', { section });
    } catch (e) {
      console.error(e);
    }
  };

  const recheck = async () => {
    setLoading(true);
    await loadPerms();
    setLoading(false);
  };

  const finish = async () => {
    await invoke('mark_first_run_complete');
    window.location.href = '/';
  };

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const allGranted = perms
    ? perms.screenRecording && perms.microphone && perms.ffmpegAvailable
    : false;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8">
        {step === 'welcome' && (
          <>
            <h1 className="text-2xl font-bold mb-3">Welcome to GoodWebTools</h1>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              Before you start, let's make sure the app has the permissions it needs
              to capture your screen and record audio. This wizard only runs once.
            </p>
            <button
              onClick={next}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              Get Started
            </button>
          </>
        )}

        {step === 'screen-recording' && (
          <>
            <h2 className="text-xl font-semibold mb-2">Screen Recording</h2>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              GoodWebTools needs Screen Recording permission to capture screenshots
              and record your screen. Open System Preferences and grant access.
            </p>
            <div className="flex items-center gap-3 bg-gray-700 rounded-lg p-3 mb-4">
              {perms ? <CheckIcon ok={perms.screenRecording} /> : '…'}
              <span className="text-sm">
                {perms?.screenRecording ? 'Permission granted' : 'Permission not granted'}
              </span>
            </div>
            {perms && !perms.screenRecording && (
              <button
                onClick={() => openPrefs('screen-recording')}
                className="w-full bg-gray-600 hover:bg-gray-500 text-white text-sm py-2 rounded-lg mb-3 transition-colors"
              >
                Open System Preferences →
              </button>
            )}
            <div className="flex gap-3">
              <button
                onClick={recheck}
                disabled={loading}
                className="flex-1 border border-gray-600 hover:border-gray-400 text-gray-300 text-sm py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Checking…' : 'Re-check'}
              </button>
              <button
                onClick={next}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 rounded-lg transition-colors"
              >
                {perms?.screenRecording ? 'Continue' : 'Skip for now'}
              </button>
            </div>
          </>
        )}

        {step === 'microphone' && (
          <>
            <h2 className="text-xl font-semibold mb-2">Microphone Access</h2>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              Optional: grant Microphone access to record audio alongside screen
              recordings. You can skip this and enable it later in Settings.
            </p>
            <div className="flex items-center gap-3 bg-gray-700 rounded-lg p-3 mb-4">
              {perms ? <CheckIcon ok={perms.microphone} /> : '…'}
              <span className="text-sm">
                {perms?.microphone ? 'Microphone accessible' : 'Microphone not accessible'}
              </span>
            </div>
            {perms && !perms.microphone && (
              <button
                onClick={() => openPrefs('microphone')}
                className="w-full bg-gray-600 hover:bg-gray-500 text-white text-sm py-2 rounded-lg mb-3 transition-colors"
              >
                Open System Preferences →
              </button>
            )}
            <div className="flex gap-3">
              <button
                onClick={recheck}
                disabled={loading}
                className="flex-1 border border-gray-600 hover:border-gray-400 text-gray-300 text-sm py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Checking…' : 'Re-check'}
              </button>
              <button
                onClick={next}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'ffmpeg' && (
          <>
            <h2 className="text-xl font-semibold mb-2">FFmpeg</h2>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              Screen recording requires FFmpeg for audio encoding and video muxing.
              {perms?.ffmpegAvailable
                ? ' FFmpeg was detected — you\'re all set.'
                : ' FFmpeg was not found. Install it or run npm run download:ffmpeg to bundle it.'}
            </p>
            <div className="flex items-center gap-3 bg-gray-700 rounded-lg p-3 mb-4">
              {perms ? <CheckIcon ok={perms.ffmpegAvailable} /> : '…'}
              <span className="text-sm">
                {perms?.ffmpegAvailable ? 'FFmpeg available' : 'FFmpeg not found'}
              </span>
            </div>
            {perms && !perms.ffmpegAvailable && (
              <div className="bg-gray-700 rounded-lg p-3 mb-4 text-xs text-gray-400 font-mono">
                brew install ffmpeg
                <br />
                # or: npm run download:ffmpeg
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={recheck}
                disabled={loading}
                className="flex-1 border border-gray-600 hover:border-gray-400 text-gray-300 text-sm py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Checking…' : 'Re-check'}
              </button>
              <button
                onClick={next}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 rounded-lg transition-colors"
              >
                {perms?.ffmpegAvailable ? 'Continue' : 'Skip for now'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="text-center">
              <div className="text-5xl mb-4">{allGranted ? '🎉' : '⚠️'}</div>
              <h2 className="text-xl font-semibold mb-3">
                {allGranted ? 'All set!' : 'Setup incomplete'}
              </h2>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                {allGranted
                  ? 'GoodWebTools is ready to use. Enjoy capturing and recording!'
                  : 'Some permissions are missing. Features that need them will show a prompt when used. You can revisit this in Settings.'}
              </p>
              {perms && (
                <div className="text-left bg-gray-700 rounded-lg p-4 mb-6 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Screen Recording</span>
                    <CheckIcon ok={perms.screenRecording} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Microphone</span>
                    <CheckIcon ok={perms.microphone} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">FFmpeg</span>
                    <CheckIcon ok={perms.ffmpegAvailable} />
                  </div>
                </div>
              )}
              <button
                onClick={finish}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                Launch GoodWebTools
              </button>
            </div>
          </>
        )}

        <StepDots current={step} />
      </div>
    </div>
  );
}
