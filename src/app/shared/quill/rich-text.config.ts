/**
 * The one rich-text toolbar.
 *
 * <p>Shared by the journal body and the product story so the two editors cannot drift, and so
 * every button maps to something the server allowlist keeps (FE-01/FE-06).
 */
export const RICH_TEXT_TOOLBAR = [
  ['bold', 'italic', 'underline'],
  [{ header: [1, 2, 3, 4, false] }],
  ['link', 'image', 'video', 'blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['clean'],
];

export const RICH_TEXT_QUILL_CONFIG = {
  modules: {
    toolbar: RICH_TEXT_TOOLBAR,
  },
};

/**
 * The product story's toolbar (W5).
 *
 * <p>Deliberately narrower than the journal's: undo/redo are added as real
 * buttons by the step, then bold, italic, underline, one heading select (H2,
 * H3, normal), both list styles, quote, link, image and clear formatting.
 * Font, size, colour, script, code, table, video and indent are gone from the
 * CONTROL; existing content that uses them still renders, because the modules
 * describe the toolbar only and Quill's formats stay registered.
 *
 * <p>It is bound through the editor's `[modules]` input rather than
 * `QUILL_CONFIG_TOKEN`: `QuillService` is root-provided, so a component-level
 * provider of the token is ignored and the editor fell back to ngx-quill's
 * default full toolbar.
 */
export const PRODUCT_STORY_TOOLBAR = [
  ['bold', 'italic', 'underline'],
  [{ header: [2, 3, false] }],
  [{ list: 'bullet' }, { list: 'ordered' }],
  ['blockquote', 'link', 'image'],
  ['clean'],
];

export const PRODUCT_STORY_QUILL_MODULES = {
  toolbar: PRODUCT_STORY_TOOLBAR,
};

