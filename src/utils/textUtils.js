// Utility functions for handling text formatting
import React from 'react';
import { Text, View } from 'react-native';

/**
 * Formats text by converting markdown-style bold syntax (**text**) to React Native Text components
 * 
 * @param {string} text - The text to format
 * @param {object} baseStyle - The base style for all text
 * @param {object} boldStyle - The style to apply to bold text segments
 * @returns {array} Array of Text components and strings
 */
export const formatText = (text, baseStyle, boldStyle) => {
  if (!text) return null;
  
  // Split the text by the bold markers
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  // Map each part to either plain text or bold text
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Extract the text between the ** markers
      const boldText = part.substring(2, part.length - 2);
      return (
        <Text key={index} style={[baseStyle, boldStyle]}>
          {boldText}
        </Text>
      );
    } else {
      return <Text key={index} style={baseStyle}>{part}</Text>;
    }
  });
};

/**
 * Breaks down a bio text with sections and formats it with proper styling
 * 
 * @param {string} bioText - The biography text to format
 * @param {object} styles - Styles for different text elements
 * @returns {JSX.Element} Formatted JSX element with the bio content
 */
export const formatBioText = (bioText, styles) => {
  if (!bioText) return null;
  
  // Split the text into paragraphs
  const paragraphs = bioText.split('\n\n');
  
  return paragraphs.map((paragraph, index) => {
    // Process each paragraph for bold formatting
    const formattedText = formatText(
      paragraph,
      styles.bioText,
      styles.boldText
    );
    
    return (
      <View key={index} style={styles.bioParagraph}>
        {formattedText}
      </View>
    );
  });
};
