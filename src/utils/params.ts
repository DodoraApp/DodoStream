export const parseBooleanParam = (value?: string): boolean => {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
};