/**
 * Copyright reminders embedded in files the app writes (Copyright & IP
 * Notice §5.2(e) at learn.ruc.edu.kg/copyright). One wording for every writer:
 * PDF/PPTX/DOCX document properties, video container tags, PNG text chunks,
 * and the COPYRIGHT.txt placed in archives.
 *
 * English only on purpose: the strings become bytes inside files that travel
 * on their own, so they must not depend on the UI language. The long form for
 * the slide-export cover page lives in the locales (`pdfmaker.coverCopyright`).
 *
 * These are reminders; they grant no licence and do not change who owns the
 * content.
 */

export const COPYRIGHT_URL = 'https://learn.ruc.edu.kg/copyright';

/** One line, for metadata fields (PDF Subject, PPTX subject, MP4 copyright, PNG Copyright). */
export const COPYRIGHT_SHORT =
  'This file may contain copyrighted material. All rights remain with their respective holders. ' +
  'For personal study only; redistribution or commercial use is prohibited.';

/** A few sentences, for description/comment fields and the PNG Disclaimer chunk. */
export const COPYRIGHT_LONG =
  'This file may contain copyrighted material extracted from a lecture recording or course platform ' +
  'at the direction of the user, solely for personal study and non-commercial educational use. All ' +
  'rights remain with the original authors, the institution, or other rights holders. Redistribution, ' +
  'public posting, sale, or other commercial use without authorisation from the rights holder is ' +
  'prohibited and may result in civil or criminal liability. AutoSlides is an automated tool, claims ' +
  'no ownership of the content, and is not affiliated with Beijing Institute of Technology. ' +
  `See ${COPYRIGHT_URL}`;

/** Keywords for PDF/PPTX document properties. */
export const COPYRIGHT_KEYWORDS = 'copyrighted material; personal study only; do not redistribute';

function noticeBody(container: string): string[] {
  return [
    `This ${container} may contain copyrighted material.`,
    '',
    'The lecture video, slides, images, and other course materials in it remain the',
    'property of their original authors, the institution, or other rights holders.',
    'They were obtained at the direction of the user, under the user\'s own access',
    'rights, solely for personal study and non-commercial educational use.',
    '',
    'Do not redistribute, post publicly, sell, or otherwise use this material',
    'commercially without authorisation from the rights holder. Doing so may result',
    'in civil or criminal liability, which the person redistributing it bears alone.',
    'Do not remove this notice when copying these files.',
    '',
    'AutoSlides is an automated processing tool. It claims no ownership of the',
    'content and is not affiliated with Beijing Institute of Technology.',
    '',
    `See ${COPYRIGHT_URL}`,
    '',
  ];
}

/** COPYRIGHT.txt placed inside every archive the app writes. */
export const COPYRIGHT_TXT = ['COPYRIGHT NOTICE', '', ...noticeBody('archive')].join('\n');

/**
 * First line of the COPYRIGHT.txt AutoSlides keeps at the root of the output
 * folder. A COPYRIGHT.txt that does not start with it is the user's own and is
 * never touched.
 */
export const OUTPUT_DIR_NOTICE_MARKER = 'AutoSlides copyright notice';

export const OUTPUT_DIR_COPYRIGHT_TXT = [
  OUTPUT_DIR_NOTICE_MARKER,
  '',
  'COPYRIGHT NOTICE',
  '',
  ...noticeBody('folder'),
  'AutoSlides keeps this file in its output folder and creates it again if it is',
  'deleted.',
  '',
].join('\n');
