import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { MediaCheckScreen } from './screens/MediaCheckScreen';
import { AlphabetScreen } from './screens/AlphabetScreen';
import { PronunciationScreen } from './screens/PronunciationScreen';
import { CountingScreen } from './screens/CountingScreen';
import { KasirScreen } from './screens/KasirScreen';
import { LabirinScreen } from './screens/LabirinScreen';
import { PolaScreen } from './screens/PolaScreen';
import { RestBreak } from './components/RestBreak';
import { useAudio } from './hooks/useAudio';
import { useRestBreak } from './hooks/useRestBreak';
import { PlayProvider } from './state/play';
import type { LetterLang } from './hooks/useAudio';
import type { Script } from './data/scripts';
import type { ScreenId } from './types';

const LANG_STORAGE_KEY = 'belajar-yuk:letter-lang';
const SCRIPT_STORAGE_KEY = 'belajar-yuk:script';

/** Read the saved preference. Storage can throw (private mode, blocked site data). */
function loadLetterLang(): LetterLang {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

/** Latin unless Arabic was chosen on a previous visit. */
function loadScript(): Script {
  try {
    return window.localStorage.getItem(SCRIPT_STORAGE_KEY) === 'arab' ? 'arab' : 'latin';
  } catch {
    return 'latin';
  }
}

const MEDIA_CHECK_HASH = '#media';

function wantsMediaCheck(): boolean {
  return typeof window !== 'undefined' && window.location.hash === MEDIA_CHECK_HASH;
}

/**
 * Screen switching is deliberately a single piece of state rather than a
 * router: there is no deep linking to offer a three-year-old, and keeping
 * the whole navigation model in one place keeps every exit predictable.
 *
 * The one exception is the parent-only media check at `index.html#media`. It
 * has no link anywhere in the UI, so it cannot be reached by tapping around.
 */
export default function App() {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [mediaCheck, setMediaCheck] = useState(wantsMediaCheck);

  useEffect(() => {
    const sync = () => setMediaCheck(wantsMediaCheck());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const leaveMediaCheck = useCallback(() => {
    // Keeps the URL tidy and avoids leaving a history entry that would trap
    // the browser's Back button on this page.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setMediaCheck(false);
  }, []);

  const [letterLang, setLetterLang] = useState<LetterLang>(loadLetterLang);
  const [script, setScript] = useState<Script>(loadScript);
  const { primeAudio, playTap, stopSpeaking, hasIndonesianVoice, isSpeechSupported, hasRecordedVoice } =
    useAudio();

  const goTo = useCallback(
    (next: ScreenId) => {
      // Browsers only allow audio to start from a user gesture; this is one.
      primeAudio();
      playTap();
      stopSpeaking();
      setScreen(next);
    },
    [playTap, primeAudio, stopSpeaking],
  );

  const goHome = useCallback(() => goTo('home'), [goTo]);

  // A quarter hour of play ends in a rest screen. It waits for a natural pause:
  // a finished game, or the menu.
  const rest = useRestBreak();
  const { due: restDue, notePause } = rest;
  useEffect(() => {
    if (screen === 'home' && restDue) notePause();
  }, [screen, restDue, notePause]);

  const finishRest = useCallback(() => {
    rest.dismiss();
    goHome();
  }, [goHome, rest]);

  // The choice lives above the screens so it survives navigation, and in
  // localStorage so a parent sets it once rather than every session.
  const changeLetterLang = useCallback((next: LetterLang) => {
    setLetterLang(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* A lost preference is not worth breaking the lesson over. */
    }
  }, []);

  // Same idea as the letter language: above the screens so it survives
  // navigation, and remembered so a parent sets it once.
  const changeScript = useCallback((next: Script) => {
    setScript(next);
    try {
      window.localStorage.setItem(SCRIPT_STORAGE_KEY, next);
    } catch {
      /* A lost preference is not worth breaking the lesson over. */
    }
  }, []);

  if (mediaCheck) return <MediaCheckScreen onBack={leaveMediaCheck} />;

  let content: ReactNode;
  switch (screen) {
    case 'huruf':
      content = (
        <AlphabetScreen
          onHome={goHome}
          letterLang={letterLang}
          onLetterLangChange={changeLetterLang}
          script={script}
          onScriptChange={changeScript}
        />
      );
      break;
    case 'bicara':
      content = (
        <PronunciationScreen
          onHome={goHome}
          letterLang={letterLang}
          script={script}
          onScriptChange={changeScript}
        />
      );
      break;
    case 'hitung':
      content = <CountingScreen onHome={goHome} script={script} onScriptChange={changeScript} />;
      break;
    case 'pola':
      content = <PolaScreen onHome={goHome} />;
      break;
    case 'labirin':
      content = (
        <LabirinScreen
          onHome={goHome}
          letterLang={letterLang}
          script={script}
          onScriptChange={changeScript}
        />
      );
      break;
    case 'kasir':
      content = <KasirScreen onHome={goHome} />;
      break;
    case 'home':
    default:
      content = (
        <HomeScreen
          onChoose={goTo}
          // Once their own recordings are in place the device's voices no
          // longer matter, so the note would just be noise.
          showVoiceNotice={isSpeechSupported && !hasIndonesianVoice && !hasRecordedVoice}
        />
      );
  }

  // The play count restarts with every module, and a finished game is a
  // natural moment for the rest screen to appear if one is due.
  return (
    <PlayProvider resetKey={screen} onGame={notePause}>
      {content}
      {rest.resting && <RestBreak onDone={finishRest} />}
    </PlayProvider>
  );
}
