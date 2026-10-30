# INPUT_AUDIT.md — input limits vs the API (wizard-fixes)

Measured against the running backend's request DTOs (`nocteon-backend`,
`product/dto/request/ProductTranslationRequest.java`,
`product/dto/request/ProductMediaRequest.java`). "UI" is what the Add product
wizard now enforces; "API" is what the server accepts.

| Field | UI rule (this branch) | API rule | Match? | Fallback shipped |
|---|---|---|---|---|
| Story (`translations[].story`) | **2000 characters of TEXT**, tags stripped, hard validator + live counter | `@Size(max = 20000)` on the **raw HTML string** | **No** | The UI keeps 2000 and blocks the step; the counter says `n/2000`. See "Needs backend". |
| SEO title (`metaTitle`) | `maxlength=60`, counter `0/60` | `@Size(max = 200)` | Stricter UI (intentional) | The field clamps at 60; the server would accept more. |
| SEO description (`metaDescription`) | `maxlength=160`, counter `0/160` | `@Size(max = 500)` | Stricter UI (intentional) | The field clamps at 160. |
| Description (`description`) | no max | `@Size(max = 5000)` | UI is looser | Nothing blocks earlier than the server. |
| Short description | `maxlength=160` | `@Size(max = 500)` | Stricter UI | Field clamps at 160. |
| Media alt text | one text field | one `altText` string per media | Yes (single language) | A single field; no en/ar pair exists to render. |
| Media file size | 10 MB | 10 MB (`MAX_BYTES` in the media step) | Yes | `formatFileSize()` prints it as "10 MB". |
| Variant image size | 5 MB | 5 MB | Yes | Printed as "5 MB". |

## Needs backend

1. **Story length unit mismatch.** `ProductTranslationRequest.story` is
   `@Size(max = 20000)` over the HTML string, while the product page's reading
   limit is 2000 characters of text. The editor's counter and validator count
   what a reader sees (tags stripped), so a story can pass the UI at
   `2000/2000` and still be accepted, or an HTML-heavy story under 20000 raw
   could fail at 2000 text. Requested: a server-side maximum expressed in TEXT
   characters (or a documented `storyTextMax` in the product response) so the
   two rules cannot disagree. **Safe fallback shipped:** the UI limit is 2000
   text characters; the server remains the last word and its 400 is shown by
   the existing error toast.
2. **SEO limits differ from the API.** The UI clamps at 60/160 because that is
   what search results show, while the columns allow 200/500. Not a defect —
   recorded so the difference is not mistaken for a bug. If the backend ever
   enforces SEO limits, it should use 60/160 too.
3. **Alt text is not per language.** `ProductMediaRequest.altText` is a single
   string, so the popover edits one description for both storefront languages.
   If the storefront needs `altTextEn` / `altTextAr`, the API must expose both
   fields; the UI would then show two inputs.
