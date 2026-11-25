import {BUILD} from './build-version.mjs';

// Each recording was spoken by this character in this language, including
// the punctuation. Never insert an acknowledgement the character didn't say.
const recordings = {
  lumi: {
    en: [['Oh,', 'oh-comma'], ['Got it.', 'got-it-period']],
    ko: [['네,', 'ne-comma'], ['맞아,', 'maja-comma']],
    zh: [['哇，', 'wa-comma'], ['嗯，', 'en-comma']],
  },
  mori: {
    en: [['Mm,', 'mm-comma'], ['Mm.', 'mm-period']],
    ko: [['음,', 'eum-comma'], ['응,', 'eung-comma']],
    zh: [['嗯，', 'en-comma'], ['好，', 'hao-comma']],
  },
  bori: {
    en: [['Oh,', 'oh-comma'], ['Thanks', 'thanks']],
    ko: [['알겠어,', 'algesseo-comma'], ['응,', 'eung-comma']],
    zh: [['好，', 'hao-comma'], ['嗯，', 'en-comma']],
  },
};

export const FAST_OPENINGS = Object.entries(recordings).flatMap(([soul, languages]) =>
  Object.entries(languages).flatMap(([language, phrases]) => phrases.map(([text, name]) => ({
    soul, language, text, path: `/audio/fast-openings/${soul}-${language}-${name}.wav`,
  })))
);

export function getFastOpeningSource(text, {soul, language} = {}) {
  const recording = FAST_OPENINGS.find(clip => clip.soul === soul && clip.language === language && clip.text === text);
  return recording ? `${recording.path}?v=${BUILD}` : undefined;
}
