/**
 * Formats an ISO date string (YYYY-MM-DD) to a display format (DD-MM-YYYY).
 * @param isoDate - The ISO date string to format.
 * @returns The formatted date string in DD-MM-YYYY format, or the original string if invalid.
 */
export const formatDisplayDate = (isoDate: string | undefined): string => {
  if (!isoDate) return '';
  
  // Handle cases where the date might already contain time info or split by 'T'
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-');
  
  if (parts.length !== 3) return isoDate;
  
  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
};

/**
 * Formats an ISO datetime string to a localized time string.
 * @param isoDateTime - The datetime string to format.
 * @returns Formatted time string.
 */
export const formatDisplayTime = (isoDateTime: string | undefined): string => {
  if (!isoDateTime) return '';
  try {
    return new Date(isoDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoDateTime;
  }
};
