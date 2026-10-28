import Quill from 'quill';

/**
 * A horizontal rule as a Quill block embed.
 *
 * <p>Quill has no `hr` format; without this blot `insertEmbed(..., 'divider')` throws. Registered
 * once, from a shared module so both the journal and the product story get it.
 */
const BlockEmbed = (Quill as any).import('blots/block/embed');

export class DividerBlot extends BlockEmbed {
  static blotName = 'divider';
  static tagName = 'hr';
}

try {
  (Quill as any).import('formats/divider');
} catch {
  Quill.register(DividerBlot, true);
}
