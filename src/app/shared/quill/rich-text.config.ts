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
