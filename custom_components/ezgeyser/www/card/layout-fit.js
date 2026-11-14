// The adaptive steps, from natural widths measured with every text at full length (see `_fitLayout` in the card). Text
// never shrinks or wraps. The row stacks by the Android app's rule, whatever the card shows: iff the fixed worst case of
// SAMPLE does not fit side by side, so cards of the same width always share a layout and height. The footer wraps by
// the same kind of rule: the end group takes its own line iff SAMPLE's footer line does not fit, and the mode pill too
// iff its start does not. The mode chips lose their words if the card's own row does not fit; the footer's first line
// drops the mode pill's word, then the timer's text, then truncates the state text, stopping at the first step that fits.

const ROW_GAP = 10;

export const FIT_NONE = { chipsIcons: false, stacked: false, footerLines: 1, footerStep: 0 };

export function fitLayout(m) {
  const stacked = m.sampleLeft + ROW_GAP + m.sampleRight > m.width;
  const chipsIcons = (stacked ? 0 : m.left + ROW_GAP) + m.right > m.width;
  const footerLines = m.sampleFooter > m.width ? (m.sampleStart > m.width ? 3 : 2) : 1;

  // On its own line the mode pill always drops its word (see `fitClasses`), which saves nothing on the first line.
  let footer = m.footer - (footerLines > 1 ? m.status : 0) - (footerLines > 2 ? m.mode : 0);
  let footerStep = 0;
  for (const saving of [footerLines > 2 ? 0 : m.modeWord, m.timerText, m.activity]) {
    if (footer <= m.width) break;
    footer -= saving;
    footerStep += 1;
  }
  return { chipsIcons, stacked, footerLines, footerStep };
}

export function fitClasses(fit) {
  return [
    fit.chipsIcons && 'chips-icons',
    fit.stacked && 'stacked',
    fit.footerLines >= 2 && 'wrap-status',
    fit.footerLines >= 3 && 'wrap-mode',
    (fit.footerStep >= 1 || fit.footerLines >= 3) && 'no-mode-word',
    fit.footerStep >= 2 && 'no-timer-text',
    fit.footerStep >= 3 && 'truncate-state',
  ]
    .filter(Boolean)
    .join(' ');
}

const width = (element) => element?.getBoundingClientRect().width || 0;

// The worst case's widths, from the hidden sample (templates/sample.js); null until it has been laid out.
export function measureSample(sample) {
  const size = {
    sampleLeft: width(sample.querySelector('.left')),
    sampleRight: width(sample.querySelector('.right')),
    sampleFooter: width(sample.querySelector('.footer')),
    sampleStart: width(sample.querySelector('.footer .start')),
  };
  return size.sampleLeft ? size : null;
}

// The card's own widths, and what each footer step would save. The card must carry the `measure` class.
export function measureCard(card) {
  const rect = (selector) => card.querySelector(selector)?.getBoundingClientRect();
  const widthOf = (selector) => rect(selector)?.width || 0;
  const leftOf = (selector) => rect(selector)?.left || 0;
  const rightOf = (selector) => rect(selector)?.right || 0;
  return {
    left: widthOf('.left'),
    right: widthOf('.right'),
    footer: widthOf('.footer'),
    // The mode word's saving includes its divider and the space after it: where the value starts, less where it starts.
    modeWord: leftOf('.mode-word + span') - leftOf('.mode-word'),
    timerText: widthOf('.timer') - widthOf('.timer .icon'),
    activity: widthOf('.activity'),
    // What wrapping takes off the first line, each with the gap before it: the end group, and the whole mode pill.
    status: rightOf('.footer') - rightOf('.start'),
    mode: rightOf('.mode') - rightOf('.start > :nth-last-child(2)'),
  };
}
