// A small html`` tag, so the card's templates read as markup.
//
// - Every value is escaped, unless it is markup that html`` made itself (or that raw() marks as trusted).
// - Arrays are joined; null, undefined and false render nothing, so `${condition && html`…`}` works.
// - A line break and the indentation after it are dropped next to a tag (or next to a value), and become one space
//   anywhere else, such as between attributes. Templates can be laid out over many lines without adding whitespace
//   between the card's inline elements, where it would show as gaps.

// A string that html`` trusts. It is still a string, so it can be compared, matched or assigned to innerHTML.
class Markup extends String {}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

export const raw = (text) => new Markup(text);

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof Markup) return String(value);
  if (Array.isArray(value)) return value.map(render).join('');
  return escape(value);
}

// Each template's static parts, with their layout whitespace removed, worked out once per template.
const layouts = new WeakMap();
function layout(strings) {
  if (!layouts.has(strings)) {
    const parts = strings.map((part) =>
      part.replace(/\n\s*/g, (gap, at) => {
        const before = part[at - 1];
        const after = part[at + gap.length];
        const besideTag = before === '>' || after === '<' || after === '>';
        return before === undefined || after === undefined || besideTag ? '' : ' ';
      }),
    );
    layouts.set(strings, parts);
  }
  return layouts.get(strings);
}

export function html(strings, ...values) {
  const parts = layout(strings);
  let text = parts[0];
  values.forEach((value, i) => {
    text += render(value) + parts[i + 1];
  });
  return new Markup(text);
}
