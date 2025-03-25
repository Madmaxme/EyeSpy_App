/**
 * Utility functions for handling images in the EyeSpy app
 */

// Function to convert base64 string to URI for React Native components
export const base64ToUri = (base64String) => {
  // Ensure the base64 string has the proper prefix for image rendering
  if (base64String && !base64String.startsWith('data:image')) {
    return `data:image/jpeg;base64,${base64String}`;
  }
  return base64String;
};

// Function to format timestamp for display
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  // Convert string timestamp to Date object if necessary
  const date = typeof timestamp === 'string' 
    ? new Date(timestamp) 
    : timestamp;
  
  return date.toLocaleString();
};

export default {
  base64ToUri,
  formatTimestamp,
};
