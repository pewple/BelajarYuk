import { useCallback, useEffect, useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { MediaCheckScreen } from './screens/MediaCheckScreen';
import { AlphabetScreen } from './screens/AlphabetScreen';
import { PronunciationScreen } from './screens/PronunciationScreen';
import { CountingScreen } from './screens/CountingScreen';
import { useAudio } from './hooks/useAudio';
import type { LetterLang } from './hooks/useAudio';
import type { ScreenId } from './types';

const LANG_STORAGE_KEY = 'belajar-yuk:letter-lang';

/** Read the saved preference. Storage can throw (private mode, blocked site data). */
function loadLetterLang(): LetterLang {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
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

  if (mediaCheck) return <MediaCheckScreen onBack={leaveMediaCheck} />;

  switch (screen) {
    case 'huruf':
      return (
        <AlphabetScreen
          onHome={goHome}
          letterLang={letterLang}
          onLetterLangChange={changeLetterLang}
        />
      );
    case 'bicara':
      return <PronunciationScreen onHome={goHome} letterLang={letterLang} />;
    case 'hitung':
      return <CountingScreen onHome={goHome} />;
    case 'home':
    default:
      return (
        <HomeScreen
          onChoose={goTo}
          // Once their own recordings are in place the device's voices no
          // longer matter, so the note would just be noise.
          showVoiceNotice={isSpeechSupported && !hasIndonesianVoice && !hasRecordedVoice}
        />
      );
  }
}
