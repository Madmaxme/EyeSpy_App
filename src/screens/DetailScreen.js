import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Linking,
  FlatList
} from 'react-native';
import { Image } from 'react-native';
import { getFaceResults, deleteFace } from '../api/eyespyAPI';
import { base64ToUri, formatTimestamp } from '../utils/imageUtils';
import { formatBioText } from '../utils/textUtils';
import { 
  initializeSocket, 
  subscribeToFaceUpdates, 
  subscribeToFaceLogs,
  unsubscribeFromFaceUpdates
} from '../utils/socketUtils';

const DetailScreen = ({ route, navigation }) => {
  const { faceId } = route.params;
  const [faceData, setFaceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentLog, setCurrentLog] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState(null);
  const logsListRef = useRef(null);

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
    
    // Initialize socket connection for real-time updates
    const socket = initializeSocket();
    setSocketConnected(socket.connected);
    
    // Set up socket event listeners
    socket.on('connect', () => {
      console.log('Socket connected in DetailScreen');
      setSocketConnected(true);
      
      // CRITICAL FIX: Explicitly join the face room whenever socket connects
      socket.emit('join', { face_id: faceId });
      console.log(`EXPLICITLY joined room for face: ${faceId} after connect`);
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected in DetailScreen');
      setSocketConnected(false);
    });
    
    // Subscribe to real-time updates for this specific face
    subscribeToFaceUpdates(faceId, (data) => {
      console.log('Received face update:', data);
      setRealtimeStatus({
        status: data.status,
        message: data.message,
        timestamp: data.timestamp
      });
      
      // Update the current status with special highlighting for OpenAI LLM usage
      const isNameExtraction = data.message && (
        data.message.includes('OpenAI') || 
        data.message.includes('LLM') || 
        data.message.includes('extract') || 
        data.message.includes('name')
      );
      
      setCurrentLog({
        id: `status-${Date.now()}-${Math.random()}`,
        type: isNameExtraction ? 'llm-extraction' : 'status',
        status: data.status,
        message: data.message,
        timestamp: data.timestamp
      });
    });
    
    // ADDITIONAL FIX: Add direct listeners for all log events to debug issues
    socket.on('processing_log', (data) => {
      console.log(`DIRECT LISTENER received processing_log:`, data);
    });
    
    socket.on('global_processing_log', (data) => {
      console.log(`DIRECT LISTENER received global_processing_log:`, data);
    });
    
    // Subscribe to processing logs for this face
    subscribeToFaceLogs(faceId, (data) => {
      console.log('Received face log via subscription:', data);
      
      // Use the log type from the server (like 'info', 'warning', 'error', 'success', 'step')
      // This is especially important for displaying OpenAI LLM-based name extraction logs
      const logType = data.type || 'info';
      
      // Update the current status log
      setCurrentLog({
        id: `log-${Date.now()}-${Math.random()}`,
        type: logType,
        message: data.message,
        timestamp: data.timestamp
      });
      
      // Log for debugging
      console.log(`Updated status: ${data.message} (type: ${logType})`);
      
      // FOR CRITICAL LLM LOGS: Also update the main status message for visibility
      if (logType === 'llm-extraction' || data.message.includes('OpenAI') || data.message.includes('LLM')) {
        setRealtimeStatus(prev => ({
          ...prev,
          message: `OpenAI Processing: ${data.message}`,
        }));
      }
    });
    
    // Clean up on unmount
    return () => {
      unsubscribeFromFaceUpdates(faceId);
    };
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
    // If we have real-time status, show that instead of database status
    if (realtimeStatus && (!faceData?.processing_details?.complete)) {
      // Get stage-specific color and icon for real-time status
      let statusColor = '#2196F3'; // Default blue
      let statusIcon = '🔄';
      
      switch (realtimeStatus.status) {
        case 'uploading':
          statusColor = '#FF9800'; // Orange
          statusIcon = '📤';
          break;
        case 'analyzing':
          statusColor = '#FF9800'; // Orange
          statusIcon = '🔍';
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
        case 'complete':
          return null; // Don't show banner for completed faces
        case 'failed':
          statusColor = '#F44336'; // Red
          statusIcon = '❌';
          break;
        default:
          break;
      }
      
      return (
        <View style={[styles.processingBanner, { backgroundColor: statusColor }]}>
          <Text style={styles.processingIcon}>{statusIcon}</Text>
          <Text style={styles.processingText}>{realtimeStatus.message}</Text>
          {realtimeStatus.status !== 'failed' && (
            <ActivityIndicator size="small" color="#FFFFFF" style={styles.processingSpinner} />
          )}
        </View>
      );
    }
    
    // Fall back to database status if no real-time status
    if (!faceData?.processing_details || faceData.processing_details.complete) {
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
  
  // Helper function to get log icon based on type
  const getLogIcon = (type, status) => {
    if (type === 'status') {
      // For status updates, use status-specific icons
      switch (status) {
        case 'uploading': return '📤';
        case 'analyzing': return '🔍';
        case 'searching': return '🔎';
        case 'checking': return '📋';
        case 'generating': return '📝';
        case 'complete': return '✅';
        case 'failed': return '❌';
        default: return '🔄';
      }
    } else if (type === 'llm-extraction') {
      // Special icon for OpenAI LLM name extraction
      return '🤖'; // Robot face emoji for AI processing
    } else {
      // For regular logs, use type-specific icons
      switch (type) {
        case 'info': return 'ℹ️';
        case 'warning': return '⚠️';
        case 'error': return '❌';
        case 'success': return '✅';
        case 'step': return '➡️';
        default: return '📋';
      }
    }
  };
  
  // Helper function to get log style based on type
  const getLogStyle = (type) => {
    switch (type) {
      case 'status': return styles.statusLogItem;
      case 'info': return styles.infoLogItem;
      case 'warning': return styles.warningLogItem;
      case 'error': return styles.errorLogItem;
      case 'success': return styles.successLogItem;
      case 'step': return styles.stepLogItem;
      case 'llm-extraction': return styles.llmExtractionLogItem; // Special style for LLM extraction
      default: return styles.detailLogItem;
    }
  };
  
  // Helper function to render the current processing status
  const renderCurrentStatus = () => {
    if (!currentLog) {
      return (
        <View style={styles.statusSection}>
          <Text style={styles.emptyStatusText}>Waiting for processing to begin...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.statusSection}>
        <View style={[styles.statusItem, getLogStyle(currentLog.type)]}>
          <Text style={styles.logIcon}>{getLogIcon(currentLog.type, currentLog.status)}</Text>
          <Text style={styles.statusMessage}>{currentLog.message}</Text>
        </View>
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
            {faceData.profile?.full_name || 'Unknown Person'}
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

      {/* Real-time status */}
      {renderCurrentStatus()}

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
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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
  // Current status styles
  statusSection: {
    padding: 15,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  statusItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  statusMessage: {
    fontSize: 15,
    flex: 1,
    color: '#333',
    fontWeight: '500',
  },
  logIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  logContent: {
    flex: 1,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 14,
    color: '#333',
  },
  // Log type specific styles
  statusLogItem: {
    backgroundColor: '#E3F2FD',
  },
  infoLogItem: {
    backgroundColor: '#F5F5F5',
  },
  warningLogItem: {
    backgroundColor: '#FFF3E0',
  },
  errorLogItem: {
    backgroundColor: '#FFEBEE',
  },
  successLogItem: {
    backgroundColor: '#E8F5E9',
  },
  stepLogItem: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  // Special style for OpenAI LLM extraction logs
  llmExtractionLogItem: {
    backgroundColor: '#E1F5FE', // Light blue background
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#0288D1', // Darker blue border
  },
  emptyStatusText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    padding: 20,
  },
});

export default DetailScreen;
