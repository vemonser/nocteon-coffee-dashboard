export interface Breadcrumb {
  label: string;
  /** Absent for section crumbs (e.g. "Catalog") — rendered as plain text, not a link. */
  url?: string;
}