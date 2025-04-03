import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  ScrollView
} from 'react-native';
import { Image } from 'react-native';
import { getFaces, deleteFace } from '../api/eyespyAPI';
import { base64ToUri, formatTimestamp } from '../utils/imageUtils';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import { 
  initializeSocket, 
  subscribeToProcessingUpdates, 
  unsubscribeFromUpdates,
  subscribeToFaceLogs,
  getSocket,
  joinFaceRoom
} from '../utils/socketUtils';

const FaceItem = ({ item, onPress, onDelete }) => {
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  // Removed expanded state - we no longer show logs
  // Removed processingLogs state - we no longer need to store logs
  const swipeableRef = useRef(null);
  
  // Explicitly log the item status to help with debugging
  useEffect(() => {
    console.log(`FaceItem ${item.face_id} status: ${item.processing_status}, message: ${item.realtimeMessage || 'none'}`);
  }, [item.processing_status, item.realtimeMessage]);
  
  // Subscribe to real-time status updates only
  useEffect(() => {
    if (isProcessing || isFailed) {
      console.log(`Setting up status listeners for face ${item.face_id}`);
      
      // Create direct listeners for status updates
      const socket = getSocket();
      
      // Explicitly join the face room
      socket.emit('join', { face_id: item.face_id });
      console.log(`Joined room for face: ${item.face_id}`);
      
      // Listen for processing updates to update status
      socket.on('processing_update', (data) => {
        if (data.face_id === item.face_id) {
          // Update status message
          setStatusMessage(data.message);
          console.log(`Updated status for ${item.face_id}:`, data.message);
        }
      });

      // Clean up subscription on unmount
      return () => {
        socket.off('processing_update');
        console.log(`Cleaned up listeners for face: ${item.face_id}`);
      };
    }
  }, [item.face_id, isProcessing, isFailed]);
  
  // Check if processing is complete
  const isProcessing = item.processing_status !== 'processed' && item.processing_status !== 'complete' && item.processing_status !== 'failed';
  // Check if item failed
  const isFailed = item.processing_status === 'failed';
  
  // Get status color based on processing stage
  const getStatusColor = () => {
    switch(item.processing_status) {
      case 'uploading': return '#FF9800'; // Orange
      case 'searching': return '#2196F3'; // Blue
      case 'generating': return '#9C27B0'; // Purple
      case 'checking': return '#FFC107'; // Amber
      case 'processed':
      case 'complete': return '#4CAF50'; // Green for completed
      case 'failed': return '#F44336'; // Red for failed
      default: return '#757575'; // Gray for unknown status
    }
  };
  
  // Get status message for display
  const getStatusMessage = () => {
    // If we have a real-time status message, use it for both processing and failed states
    if (statusMessage && (isProcessing || isFailed)) {
      return statusMessage;
    }
    
    // Otherwise fall back to the database status
    switch(item.processing_status) {
      case 'uploading': return 'Uploading & Analyzing';
      case 'analyzing': return 'Analyzing face';
      case 'searching': return 'Searching for matches';
      case 'generating': return 'Generating profile';
      case 'checking': return 'Checking records';
      case 'processed':
      case 'complete': return 'Complete';
      case 'failed': return 'Processing Failed';
      default: return 'Processing';
    }
  };
  
  // Removed toggle expanded function - we no longer show logs
  
  // Removed log icon and style helper functions
  
  // Update status message when it changes
  useEffect(() => {
    if (item.realtimeMessage) {
      setStatusMessage(item.realtimeMessage);
    }
  }, [item.realtimeMessage]);

  // Create right swipe action with animated width
  const renderRightActions = (progress) => {
    // Create a nice animation for the delete button
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });
    
    return (
      <View style={styles.deleteActionContainer}>
        <Animated.View style={[
          styles.deleteAction,
          {
            transform: [{ translateX: trans }],
          }
        ]}>
          <TouchableOpacity
            style={styles.deleteActionButton}
            onPress={() => {
              // Confirm deletion
              Alert.alert(
                "Delete Face",
                "Are you sure you want to delete this face and all related data?",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => onDelete(item.face_id) }
                ]
              );
            }}
          >
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };
  
  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      enabled={!isProcessing} // Disable swipe for processing items
    >
      <TouchableOpacity 
        style={[styles.faceItem, isProcessing && styles.processingItem, isFailed && styles.failedItem]} 
        onPress={() => !isProcessing && !isFailed && onPress(item)}
        disabled={isProcessing || isFailed}
      >
        <View style={styles.faceContainer}>
          <Image
            style={[styles.faceThumbnail, isProcessing && styles.processingImage]}
            source={{ uri: base64ToUri(item.thumbnail_base64) }}
            resizeMode="cover"
          />
          <View 
            style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} 
          />
        </View>
        <View style={styles.faceInfo}>
          <Text style={styles.faceId} numberOfLines={1}>{item.face_id}</Text>
          <Text style={styles.faceTimestamp}>
            {formatTimestamp(item.upload_timestamp)}
          </Text>
          {isProcessing && (
            <View style={styles.processingStatus}>
              <ActivityIndicator size="small" color={getStatusColor()} style={styles.processingSpinner} />
              <Text style={[styles.processingText, {color: getStatusColor()}]}>{getStatusMessage()}</Text>
            </View>
          )}
          {isFailed && (
            <View style={styles.processingStatus}>
              <Text style={[styles.processingText, {color: '#F44336'}]}>
                {statusMessage || 'Processing failed'}
              </Text>
            </View>
          )}
          {item.deleting && (
            <View style={styles.processingStatus}>
              <ActivityIndicator size="small" color="#F44336" style={styles.processingSpinner} />
              <Text style={[styles.processingText, {color: '#F44336'}]}>Deleting...</Text>
            </View>
          )}
          
          {/* Removed logs toggle button */}
          
          {/* Removed logs section */}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const CollectionScreen = ({ navigation }) => {
  const [faces, setFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    totalFaces: 0,
    hasMore: true
  });

  // Function to load faces from the API
  const loadFaces = async (offset = 0, append = false) => {
    try {
      // Don't set loading state - keep it invisible
      const result = await getFaces(pagination.limit, offset);
      
      // Update state with new data
      setFaces(prev => append ? [...prev, ...result.faces] : result.faces);
      setPagination({
        ...pagination,
        offset: offset + result.faces.length,
        totalFaces: result.total_faces,
        hasMore: result.faces.length >= pagination.limit
      });
    } catch (error) {
      console.error('Error loading faces:', error);
      // No alert - keep errors invisible
    }
  };

  // Function to handle face deletion
  const handleDeleteFace = async (faceId) => {
    try {
      // Find the face item component by its ref and update its state to show deleting
      const faceItem = faces.find(face => face.face_id === faceId);
      if (faceItem) {
        faceItem.deleting = true;
        // Force a re-render to show the deleting state
        setFaces([...faces]);
      }
      
      // Call the API to delete the face
      await deleteFace(faceId);
      
      // Remove the face from local state
      setFaces(prev => prev.filter(face => face.face_id !== faceId));
      
      // Update total count
      setPagination(prev => ({
        ...prev,
        totalFaces: prev.totalFaces - 1
      }));
    } catch (error) {
      console.error('Error deleting face:', error);
      Alert.alert('Error', 'Failed to delete face. Please try again.');
      
      // Reset the deleting state on error
      const faceItem = faces.find(face => face.face_id === faceId);
      if (faceItem) {
        faceItem.deleting = false;
        setFaces([...faces]);
      }
    }
  };

  // Load initial data when component mounts and set up WebSocket connections
  useEffect(() => {
    console.log('CollectionScreen mounted - loading initial data');
    loadFaces();
    
    // Initialize socket connection for real-time updates
    const socket = initializeSocket();
    setSocketConnected(socket.connected);
    
    // Set up event listeners for connection status
    socket.on('connect', () => {
      console.log('Socket connected in CollectionScreen');
      setSocketConnected(true);
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected in CollectionScreen');
      setSocketConnected(false);
    });
    
    // Directly attach event listener for 'failed' updates
    // This ensures we catch failure events directly without any middleware
    socket.on('processing_update', (data) => {
      console.log('Direct socket event in CollectionScreen:', data);
      if (data.status === 'failed') {
        console.log('FAILURE EVENT DETECTED - updating UI directly');
        // Direct API call to refresh data when a failure happens
        loadFaces();
      }
    });
    
    // Subscribe to real-time face processing updates
    subscribeToProcessingUpdates((data) => {
      if (!data || !data.face_id) return;
      
      console.log('Received real-time update via subscribeToProcessingUpdates:', data);
      
      // Special handling for failed status to ensure it gets through
      if (data.status === 'failed' || data.fromFailureChannel) {
        console.log('CRITICAL: Failure status received, forcing UI update');
        
        // Check if this is from our dedicated failure channel
        if (data.fromFailureChannel) {
          console.log('🚨 Received from dedicated failure channel - guaranteed update');
        }
        
        // First update state immediately
        setFaces(prevFaces => prevFaces.map(face => {
          if (face.face_id === data.face_id) {
            return {
              ...face,
              processing_status: 'failed',
              realtimeMessage: data.message || 'Processing failed'
            };
          }
          return face;
        }));
        
        // Then reload faces from server to ensure we get complete latest status
        setTimeout(() => loadFaces(), 300);
        return;
      }
      
      // For other statuses, update the local state
      setFaces(prevFaces => {
        // Find the face to update
        const faceToUpdate = prevFaces.find(face => face.face_id === data.face_id);
        
        if (!faceToUpdate) {
          console.log(`Face ${data.face_id} not found in current faces list`);  
          return prevFaces; // No changes
        }
        
        console.log(`Updating face ${data.face_id} from ${faceToUpdate.processing_status} to ${data.status}`);
        
        // Create a new array with all faces, replacing the updated one
        return prevFaces.map(face => 
          face.face_id === data.face_id 
            ? { 
                ...face, 
                processing_status: data.status, 
                realtimeMessage: data.message 
              } 
            : face
        );
      });
    });
    
    // Clean up on unmount
    return () => {
      unsubscribeFromUpdates();
    };
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadFaces(0, false);
    }, [])
  );

  // Handler for refreshing the list (pull-to-refresh)
  const handleRefresh = () => {
    // Don't show refreshing state
    loadFaces(0, false);
  };

  // Handler for loading more items when reaching the end of the list
  const handleLoadMore = () => {
    if (!loading && pagination.hasMore) {
      loadFaces(pagination.offset, true);
    }
  };

  // Handler for pressing on a face item
  const handleFacePress = (face) => {
    navigation.navigate('Detail', { faceId: face.face_id });
  };

  // Empty footer - no loading indicator
  const renderFooter = () => null;

  return (
    <View style={styles.container}>
      {/* Removed the top-right spinner for a cleaner UI */}
      <FlatList
        data={faces}
        renderItem={({ item }) => (
          <FaceItem 
            item={item} 
            onPress={handleFacePress}
            onDelete={handleDeleteFace}
          />
        )}
        keyExtractor={item => item.face_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            colors={['#2196F3']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No faces found. Upload a face to get started.
            </Text>
          </View>
        }
      />
      
      <TouchableOpacity 
        style={styles.uploadButton}
        onPress={() => navigation.navigate('Upload')}
      >
        <Text style={styles.uploadButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Log UI styles
  logsSection: {
    padding: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 4,
    marginTop: 8,
  },
  logsList: {
    maxHeight: 200,
  },
  logItem: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  logIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  logContent: {
    flex: 1,
  },
  logTimestamp: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 12,
    color: '#333',
  },
  emptyLogsText: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    padding: 10,
  },
  logToggleButton: {
    backgroundColor: '#E0E0E0',
    padding: 6,
    borderRadius: 4,
    marginTop: 8,
    alignItems: 'center',
  },
  logToggleText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
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
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#0288D1', // Darker blue border
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  listContent: {
    padding: 10,
  },
  faceItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  processingItem: {
    opacity: 0.9,
    backgroundColor: '#FAFAFA',
  },
  failedItem: {
    opacity: 0.9,
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  faceContainer: {
    position: 'relative',
  },
  faceThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  processingImage: {
    opacity: 0.8,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  faceInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  processingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  processingSpinner: {
    marginRight: 6,
  },
  processingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  faceId: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  faceTimestamp: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  faceStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerLoader: {
    padding: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  uploadButton: {
    position: 'absolute',
    right: 25,
    bottom: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  uploadButtonText: {
    fontSize: 30,
    color: 'white',
    fontWeight: '300',
  },
  deleteActionContainer: {
    width: 80,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionButton: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 8,
  },
  deleteActionText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default CollectionScreen;
