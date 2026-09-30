import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { MediaCheckScreen } from '../screens/MediaCheckScreen';
import { buildSlots, slotIds } from '../media/slots';
import { ALPHABET, COUNTING_SETS, MAX_COUNT, WORD_CARDS } from '../data/curriculum';
import { HOME_CHOICES } from '../data/navigation';
import { setMediaManifest } from './setup';

describe('the customisable slots', () => {
  const catalogue = buildSlots();
  const audioIds = [...slotIds(catalogue.audio)];
  const imageIds = [...slotIds(catalogue.images)];

  it('gives every slot a unique id, so no two files can collide', () => {
    const all = catalogue.audio.flatMap((g) => g.slots.map((s) => s.id));

    expect(new Set(all).size).toBe(all.length);
  });

  it('covers every letter in both languages', () => {
    for (const letter of ALPHABET) {
      expect(audioIds).toContain(`letters/id/${letter.toLowerCase()}`);
      expect(audioIds).toContain(`letters/en/${letter.toLowerCase()}`);
    }
  });

  it('covers every word, count and home card that the app can show', () => {
    expect(audioIds.filter((id) => id.startsWith('words/'))).toHaveLength(WORD_CARDS.length);
    expect(audioIds.filter((id) => id.startsWith('numbers/'))).toHaveLength(MAX_COUNT);
    expect(imageIds.filter((id) => id.startsWith('words/'))).toHaveLength(WORD_CARDS.length);
    expect(imageIds.filter((id) => id.startsWith('counting/'))).toHaveLength(COUNTING_SETS.length);
    expect(imageIds.filter((id) => id.startsWith('home/'))).toHaveLength(HOME_CHOICES.length);
  });

  it('includes the greeting, the counting prompt and the three effects', () => {
    expect(audioIds).toEqual(
      expect.arrayContaining([
        'phrases/greeting',
        'phrases/ayo-hitung',
        'ui/pop',
        'ui/tap',
        'ui/chime',
      ]),
    );
  });

  it('tells the recorder what to say for every spoken slot', () => {
    const spoken = catalogue.audio
      .flatMap((g) => g.slots)
      .filter((s) => !s.id.startsWith('ui/'));

    expect(spoken.filter((s) => !s.say)).toEqual([]);
  });
});

describe('media check page', () => {
  it('is reached by #media and has no link from the toddler UI', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Nothing on the home screen leads there.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/cek media/i)).not.toBeInTheDocument();

    // ...but a parent who types #media gets it.
    window.location.hash = '#media';
    expect(await screen.findByRole('heading', { name: 'Cek media' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kembali ke menu utama' }));
    expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('opens straight onto the page when the address already has #media', () => {
    window.location.hash = '#media';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Cek media' })).toBeInTheDocument();
  });

  it('warns loudly when manifest.js never loaded', () => {
    setMediaManifest(undefined);
    render(<MediaCheckScreen onBack={() => {}} />);

    expect(screen.getByRole('alert')).toHaveTextContent('manifest.js');
  });

  it('explains what to do when nothing has been added yet', () => {
    setMediaManifest({ audio: [], images: [] });
    render(<MediaCheckScreen onBack={() => {}} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Belum ada berkas terdaftar/)).toBeInTheDocument();
    expect(screen.getByText(/Perbarui-Media\.bat/)).toBeInTheDocument();
  });

  it('shows how many slots each group has covered', () => {
    setMediaManifest({
      audio: ['words/apel.mp3', 'words/es-krim.mp3', 'phrases/greeting.wav'],
      images: ['words/apel.png'],
    });
    render(<MediaCheckScreen onBack={() => {}} />);

    const wordsAudio = screen.getByText('Kata di Belajar Bicara').closest('summary')!;
    expect(wordsAudio).toHaveTextContent(`2 / ${WORD_CARDS.length}`);

    const sentences = screen.getByText('Kalimat').closest('summary')!;
    expect(sentences).toHaveTextContent('1 / 2');

    const wordsImages = screen.getByText('Kartu kata di Belajar Bicara').closest('summary')!;
    expect(wordsImages).toHaveTextContent(`1 / ${WORD_CARDS.length}`);

    expect(screen.getByText(/3 suara . 1 gambar terdaftar/)).toBeInTheDocument();
  });

  it('flags a misspelt filename - the failure that otherwise happens silently', () => {
    setMediaManifest({ audio: ['words/aple.mp3', 'words/apel.mp3'], images: ['words/apple.png'] });
    render(<MediaCheckScreen onBack={() => {}} />);

    const problems = screen.getByRole('region', { name: 'Berkas bermasalah' });
    expect(within(problems).getByText('suara: words/aple')).toBeInTheDocument();
    expect(within(problems).getByText('gambar: words/apple')).toBeInTheDocument();
    // The correctly-named file must not be accused.
    expect(within(problems).queryByText('suara: words/apel')).not.toBeInTheDocument();
  });

  it('reports unsupported formats with the reason', () => {
    setMediaManifest({ audio: ['words/apel.flac'], images: [] });
    render(<MediaCheckScreen onBack={() => {}} />);

    const problems = screen.getByRole('region', { name: 'Berkas bermasalah' });
    expect(problems).toHaveTextContent('words/apel.flac (format tidak didukung)');
  });

  it('never flags praise takes, whatever they are called', () => {
    setMediaManifest({ audio: ['praise/hebat.mp3', 'praise/bagus sekali.wav', 'praise/x.ogg'], images: [] });
    render(<MediaCheckScreen onBack={() => {}} />);

    expect(screen.queryByRole('region', { name: 'Berkas bermasalah' })).not.toBeInTheDocument();
    expect(screen.getByText('3 berkas')).toBeInTheDocument();
  });

  it('offers a play button only for slots that have a recording', () => {
    setMediaManifest({ audio: ['words/apel.mp3'], images: [] });
    render(<MediaCheckScreen onBack={() => {}} />);

    expect(screen.getAllByRole('button', { name: /^Putar / })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Putar Apel' })).toBeInTheDocument();
  });
});
