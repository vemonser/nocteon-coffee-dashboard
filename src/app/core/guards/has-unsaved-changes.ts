export interface HasUnsavedChanges {
  isDirty(): boolean;
  saveAll?(): Promise<{ ok: boolean; firstInvalidTab?: string }>;
}