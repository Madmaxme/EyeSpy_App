import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Image } from 'react-native';
import { getFaceResults, deleteFace } from '../api/eyespyAPI';
import { base64ToUri, formatTimestamp } from '../utils/imageUtils';
import { formatBioText } from '../utils/textUtils';

const DetailScreen = ({ route, navigation }) => {
  const { faceId } = route.params;
  const [faceData, setFaceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to load the face details
  const loadFaceDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFaceResults(faceId);
      setFaceData(data);
    } catch (err) {
      console.error('Error loading face details:', err);
      setError('Failed to load face details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load face details when component mounts
  useEffect(() => {
    loadFaceDetails();
    
    // Polling removed
    return () => {};
  }, [faceId]);

  // Function to handle deleting a face
  const handleDeleteFace = () => {
    Alert.alert(
      'Delete Face',
      'Are you sure you want to delete this face and all related data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteFace(faceId);
              Alert.alert('Success', 'Face deleted successfully');
              navigation.goBack();
            } catch (err) {
              console.error('Error deleting face:', err);
              Alert.alert('Error', 'Failed to delete face. Please try again.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Function to open a URL
  const handleOpenUrl = (url) => {
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open URL: ${url}`);
      }
    });
  };

  // If still loading, show loading indicator
  if (loading && !faceData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading face details...</Text>
      </View>
    );
  }

  // If error occurred, show error message
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadFaceDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If face data is not available yet, show placeholder
  if (!faceData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No data available for this face.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Helper function to render the processing status banner
  const renderProcessingStatus = () => {
    if (!faceData.processing_details || faceData.processing_details.complete) {
      return null; // Don't show anything if processing is complete
    }
    
    // Get stage-specific color and icon
    let statusColor = '#2196F3'; // Default blue
    let statusIcon = '🔄';
    
    switch (faceData.processing_details.stage) {
      case 'uploading':
        statusColor = '#FF9800'; // Orange
        statusIcon = '📤';
        break;
      case 'searching':
        statusColor = '#03A9F4'; // Light blue
        statusIcon = '🔍';
        break;
      case 'generating':
        statusColor = '#4CAF50'; // Green
        statusIcon = '📝';
        break;
      case 'checking':
        statusColor = '#9C27B0'; // Purple
        statusIcon = '✅';
        break;
      default:
        break;
    }
    
    return (
      <View style={[styles.processingBanner, { backgroundColor: statusColor }]}>
        <Text style={styles.processingIcon}>{statusIcon}</Text>
        <Text style={styles.processingText}>{faceData.processing_details.message}</Text>
        <ActivityIndicator size="small" color="#FFFFFF" style={styles.processingSpinner} />
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Processing status banner */}
      {renderProcessingStatus()}

      {/* Original face image */}
      <View style={styles.imageSection}>
        <Image
          style={styles.faceImage}
          source={{ uri: base64ToUri(faceData.face_info.original_image_base64) }}
          resizeMode="contain"
        />
        <View style={styles.faceMetadata}>
          <Text style={styles.faceName}>
            {faceData.profile?.full_name || 'Processing...'}
          </Text>
          <Text style={styles.faceTimestamp}>
            Uploaded: {formatTimestamp(faceData.face_info.upload_timestamp)}
          </Text>
          <Text style={styles.faceId}>ID: {faceData.face_info.face_id}</Text>
        </View>
      </View>

      {/* Bio section */}
      {faceData.profile?.bio_text ? (
        <View style={styles.bioSection}>
          <Text style={styles.sectionTitle}>Identity Profile</Text>
          <ScrollView style={styles.bioContainer}>
            {formatBioText(faceData.profile.bio_text, styles)}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.bioSection}>
          <Text style={styles.sectionTitle}>Identity Profile</Text>
          <View style={styles.bioPlaceholder}>
            <Text style={styles.placeholderText}>
              No profile information available for this face.
            </Text>
          </View>
        </View>
      )}

      {/* Top matches section */}
      <View style={styles.matchesSection}>
        <Text style={styles.sectionTitle}>Top Matches</Text>
        {faceData.top_matches && faceData.top_matches.length > 0 ? (
          faceData.top_matches.map((match, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.matchItem}
              onPress={() => handleOpenUrl(match.url)}
            >
              <Image
                style={styles.matchThumbnail}
                source={{ uri: base64ToUri(match.thumbnail_base64) }}
                resizeMode="cover"
              />
              <View style={styles.matchInfo}>
                <Text style={styles.matchSource}>{match.source_type}</Text>
                <Text style={styles.matchUrl} numberOfLines={1}>{match.url}</Text>
                <Text style={styles.matchScore}>
                  Confidence: {(match.score)}%
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.noMatchesContainer}>
            <Text style={styles.noMatchesText}>
              No matches found for this face.
            </Text>
          </View>
        )}
      </View>

      {/* Delete button */}
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={handleDeleteFace}
      >
        <Text style={styles.deleteButtonText}>Delete Face</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  processingBanner: {
    backgroundColor: '#2196F3',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderRadius: 4,
  },
  processingIcon: {
    fontSize: 20,
    marginRight: 5,
  },
  processingText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  processingSpinner: {
    marginLeft: 10,
  },
  imageSection: {
    padding: 15,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  faceImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    marginBottom: 15,
  },
  faceMetadata: {
    paddingHorizontal: 5,
  },
  faceName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 5,
  },
  faceTimestamp: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 3,
  },
  faceId: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  bioSection: {
    padding: 15,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  bioContainer: {
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    maxHeight: 300,
  },
  bioParagraph: {
    marginBottom: 10,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  boldText: {
    fontWeight: 'bold',
  },
  bioPlaceholder: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
  matchesSection: {
    padding: 15,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  matchItem: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 10,
  },
  matchThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  matchInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  matchSource: {
    fontSize: 16,
    fontWeight: '500',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  matchUrl: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 4,
  },
  matchScore: {
    fontSize: 14,
    fontWeight: '500',
  },
  noMatchesContainer: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  noMatchesText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
  deleteButton: {
    margin: 15,
    backgroundColor: '#F44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DetailScreen;
