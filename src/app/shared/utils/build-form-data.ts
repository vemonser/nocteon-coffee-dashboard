export function buildFormData(data: unknown, image?: File): FormData {
  const formData = new FormData();

  formData.append(
    'data',
    new Blob([JSON.stringify(data)], {
      type: 'application/json',
    }),
  );

  if (image) {
    formData.append('image', image);
  }

  return formData;
}
