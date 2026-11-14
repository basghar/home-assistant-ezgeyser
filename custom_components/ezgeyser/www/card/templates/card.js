// The whole card, top to bottom. `view` comes from buildView() in view.js.
import { html } from '../html.js';
import { footer } from './footer.js';
import { header } from './header.js';
import { temperatures } from './temperatures.js';

export const cardBody = (view) => html`${header(view)}${temperatures(view)}${footer(view)}`;
