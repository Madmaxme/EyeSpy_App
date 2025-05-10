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
import { AntDesign, MaterialIcons, Ionicons } from '@expo/vector-icons';
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
              if (item.deleting) return; // Prevent multiple delete attempts
              
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

// Constants
const FACES_BATCH_SIZE = 10; // Number of faces to load per batch

const CollectionScreen = ({ navigation }) => {
  // State for managing the list of faces
  const [faces, setFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  // Reduce initial page size for faster first load
  const [pagination, setPagination] = useState({
    limit: 10,  // Reduced from 20 to 10 for faster initial load
    offset: 0,
    totalFaces: 0,
    hasMore: true
  });
  
  // Cache for face list to avoid unnecessary rerenders
  const facesCache = useRef({});
  
  // Track faces that have reached a terminal status (complete or failed)
  // This prevents them from flickering back to previous states
  const lockedFaces = useRef({});
  
  // Ref to track the update timeout between renders
  const updateTimeoutRef = useRef(null);

  // Function to load faces from the API with optimized caching
  const loadFaces = async (offset = 0, append = false) => {
    try {
      // Set loading state for better UX feedback
      if (!append) {
        setLoading(true);
      }
      
      // Get a local copy of the locked faces for reference during this load
      const lockedFaceData = lockedFaces.current;
      
      // Check cache first to avoid unnecessary API calls
      const cacheKey = `faces_${FACES_BATCH_SIZE}_${offset}`;
      const cachedResult = facesCache.current[cacheKey];
      const cacheExpiry = 60000; // 1 minute cache expiry
      const now = Date.now();
      
      let result;
      if (cachedResult && (now - cachedResult.timestamp < cacheExpiry)) {
        console.log('Using cached face list data');
        result = cachedResult.data;
      } else {
        // Cache miss or expired, fetch from API
        console.log('Fetching face list from API');
        result = await getFaces(FACES_BATCH_SIZE, offset);
        
        // Update cache
        facesCache.current[cacheKey] = {
          data: result,
          timestamp: now
        };
      }
      
      // Create a map of faces to ensure uniqueness by face_id
      setFaces(prevFaces => {
        // Use a map to deduplicate faces by face_id
        const faceMap = new Map();
        
        // If appending, add existing faces to map first
        if (append) {
          prevFaces.forEach(face => {
            faceMap.set(face.face_id, face);
          });
        }
        
        // Add new faces, overwriting any duplicates
        result.faces.forEach(face => {
          faceMap.set(face.face_id, face);
        });
        
        // Convert map values back to array and sort by timestamp (newest first)
        return Array.from(faceMap.values()).sort((a, b) => {
          return b.timestamp - a.timestamp;
        });
      });
      
      // Update pagination state
      setPagination({
        offset: offset + result.faces.length,
        totalFaces: result.total_faces,
        hasMore: result.faces.length >= FACES_BATCH_SIZE
      });
    } catch (error) {
      console.error('Error loading faces:', error);
      // No alert - keep errors invisible
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  // Helper function to schedule a delayed refresh
  const scheduleUpdate = (delay = 1000) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      loadFaces();
      updateTimeoutRef.current = null;
    }, delay);
  };
  
  // Load initial data when component mounts and set up WebSocket connections
  useEffect(() => {
    console.log('CollectionScreen mounted - loading initial data');
    
    // Load faces with a small delay to allow the UI to render first
    const loadTimer = setTimeout(() => {
      loadFaces();
    }, 100);
    
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
    
    // Apply immediate updates directly to the UI without doing a full reload
    const updateFaceDirectly = (faceId, status, message) => {
      console.log(`Direct UI update for face ${faceId}: ${status} - ${message || 'No message'}`);      

      // If this is a terminal status (complete or failed), lock this face
      if (status === 'complete' || status === 'failed') {
        console.log(`🔒 Locking face ${faceId} to status: ${status}`);
        lockedFaces.current[faceId] = {
          status,
          message,
          timestamp: Date.now()
        };
        
        // Schedule a delayed background refresh to ensure API data is in sync
        scheduleUpdate(2000);
      }
      
      // Update the UI immediately with this new status
      setFaces(prevFaces => {
        const updatedFaces = prevFaces.map(face => {
          if (face.face_id === faceId) {
            return {
              ...face,
              processing_status: status,
              realtimeMessage: message || face.realtimeMessage
            };
          }
          return face;
        });
        
        return updatedFaces;
      });
    };
    
    // Handle socket processing updates directly
    socket.on('processing_update', (data) => {
      if (!data || !data.face_id || !data.status) return;
      
      console.log(`Socket processing_update for ${data.face_id}: ${data.status}`);
      updateFaceDirectly(data.face_id, data.status, data.message);
    });
    
    // Handle dedicated failure channel
    socket.on('processing_failed', (data) => {
      if (!data || !data.face_id) return;
      
      console.log(`🚨 CRITICAL: Failure event for ${data.face_id}`);
      updateFaceDirectly(data.face_id, 'failed', data.message || 'Processing failed');
    });
    
    // Subscribe to real-time face processing updates
    subscribeToProcessingUpdates((data) => {
      if (!data || !data.face_id) return;
      
      console.log('Received real-time update via subscribeToProcessingUpdates:', data);
      
      // Forward to our central update function
      if (data && data.face_id && data.status) {
        // Mark special failure channel messages
        if (data.fromFailureChannel) {
          console.log('🚨 Received from dedicated failure channel - guaranteed update');
        }
        
        // Use the updateFaceDirectly function to keep our update logic centralized
        updateFaceDirectly(data.face_id, data.status, data.message);
      }
    });
    
    // Clean up on unmount
    return () => {
      clearTimeout(loadTimer);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      unsubscribeFromUpdates();
    };
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Collection screen focused');
      // Force a refresh of the face list
      facesCache.current = {}; // Clear cache
      loadFaces(0, false);      
    }, [])
  );
  
  // Listen for navigation params to refresh after upload or deletion
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Check if we're returning from an upload or deletion
      const refreshParam = navigation.getParam?.('refresh') || navigation.getState?.().routes.find(r => r.name === 'Collection')?.params?.refresh;
      
      if (refreshParam) {
        console.log('Performing background refresh');
        // Perform a subtle background refresh
        backgroundRefresh();
      }
    });
    
    return unsubscribe;
  }, [navigation]);
  
  // Special background refresh function that doesn't show loading indicators
  const backgroundRefresh = async () => {
    try {
      // Don't set loading state - keep the current UI
      facesCache.current = {}; // Clear cache
      
      // Fetch fresh data
      const result = await getFaces(FACES_BATCH_SIZE, 0);
      
      // Update the cache
      facesCache.current[`faces_${FACES_BATCH_SIZE}_0`] = {
        data: result,
        timestamp: Date.now()
      };
      
      // Update faces with Map-based deduplication to prevent flashing
      setFaces(prevFaces => {
        // Create map of current faces
        const faceMap = new Map();
        
        // First, add all existing faces to preserve current state
        prevFaces.forEach(face => {
          faceMap.set(face.face_id, face);
        });
        
        // Then process new faces, but respect locked faces from real-time updates
        result.faces.forEach(face => {
          const existingFace = faceMap.get(face.face_id);
          const lockedFace = lockedFaceData[face.face_id];
          
          if (lockedFace) {
            // If this face is locked (has reached terminal status), use the locked data
            faceMap.set(face.face_id, {
              ...face,
              processing_status: lockedFace.status,
              realtimeMessage: lockedFace.message || face.realtimeMessage
            });
            console.log(`Maintaining locked status ${lockedFace.status} for ${face.face_id} during API refresh`);
          } else if (!existingFace || 
                    (existingFace.processing_status !== 'complete' && 
                     existingFace.processing_status !== 'failed')) {
            // Only update from API if not already in a terminal state locally
            faceMap.set(face.face_id, face);
          }
        });
        
        // Convert to sorted array
        return Array.from(faceMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      });
      
      // Update pagination without triggering loading indicators
      setPagination(prev => ({
        ...prev,
        offset: result.faces.length,
        totalFaces: result.total_faces,
        hasMore: result.faces.length >= FACES_BATCH_SIZE
      }));
    } catch (error) {
      console.error('Background refresh error:', error);
      // Don't show error UI for background refresh
    }
  };

  // Handler for refreshing the list (pull-to-refresh)
  const handleRefresh = () => {
    // Clear the cache to force a fresh load
    facesCache.current = {};
    setRefreshing(true);
    loadFaces(0, false);
  };

  // Handler for loading more items when reaching the end of the list
  const handleLoadMore = () => {
    if (!loading && pagination.hasMore) {
      // Show a small activity indicator at the bottom only when loading more
      loadFaces(pagination.offset, true);
    }
  };

  // Handler for pressing on a face item
  const handleFacePress = (face) => {
    navigation.navigate('Detail', { faceId: face.face_id });
  };
  
  // Loading state component shown during initial loading
  const LoadingState = () => (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color="#2196F3" />
      <Text style={styles.loadingText}>Loading faces...</Text>
    </View>
  );
  
  // Empty state component shown when no faces are found
  const EmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="search-off" size={64} color="#757575" />
      <Text style={styles.emptyStateText}>No faces found</Text>
      <TouchableOpacity 
        style={styles.emptyStateButton}
        onPress={() => navigation.navigate('Upload')}
      >
        <Text style={styles.emptyStateButtonText}>Upload a Face</Text>
      </TouchableOpacity>
    </View>
  );

  // Empty footer - no loading indicator
  const renderFooter = () => null;



  // Instructions panel component
  const InstructionsPanel = () => (
    <View style={styles.instructionsContainer}>
      <View style={styles.instructionsHeader}>
        <Text style={styles.instructionsTitle}>Welcome to EyeSpy</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => setShowInstructions(false)}>
          <AntDesign name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      <Text style={styles.instructionsSubtitle}>The facial recognition and identity search platform</Text>
      
      <View style={styles.instructionSection}>
        <View style={styles.instructionIcon}>
          <MaterialIcons name="face" size={24} color="#2196F3" />
        </View>
        <View style={styles.instructionContent}>
          <Text style={styles.instructionTitle}>What is EyeSpy?</Text>
          <Text style={styles.instructionText}>
            EyeSpy is a powerful tool that uses facial recognition technology to find identity matches online.
            Our system analyzes faces to extract information, search public records, and generate comprehensive
            biographical summaries for any face you upload.
          </Text>
        </View>
      </View>
      
      <View style={styles.instructionSection}>
        <View style={styles.instructionIcon}>
          <MaterialIcons name="security" size={24} color="#4CAF50" />
        </View>
        <View style={styles.instructionContent}>
          <Text style={styles.instructionTitle}>How it Works</Text>
          <Text style={styles.instructionText}>
            When you upload a face image, our system analyzes it using advanced AI to search for matching identities
            across the web. We then compile information from various sources to create a comprehensive profile.
          </Text>
        </View>
      </View>
      
      <View style={styles.howToUseContainer}>
        <Text style={styles.howToUseTitle}>How to Use EyeSpy:</Text>
        <Text style={styles.howToUseStep}>1. Tap the + button to upload a face image</Text>
        <Text style={styles.howToUseStep}>2. Select a photo or take a new one</Text>
        <Text style={styles.howToUseStep}>3. Wait for processing (may take several minutes)</Text>
        <Text style={styles.howToUseStep}>4. Tap on a processed face to see detailed results</Text>
      </View>
    </View>
  );
  
  return (
    <View style={styles.container}>
      {/* Toggle button for instructions */}
      {!showInstructions && (
        <TouchableOpacity 
          style={styles.instructionsButton}
          onPress={() => setShowInstructions(true)}
        >
          <Ionicons name="information-circle" size={20} color="white" />
          <Text style={styles.instructionsButtonText}>How EyeSpy Works</Text>
        </TouchableOpacity>
      )}
      
      {/* Instructions panel - always render but conditionally animate and display */}
      {showInstructions && <InstructionsPanel />}
      
      <FlatList
        data={faces}
        keyExtractor={(item) => item.face_id}
        renderItem={({ item }) => (
          <FaceItem
            item={item}
            onPress={handleFacePress}
            onDelete={handleDeleteFace}
          />
        )}
        initialNumToRender={5} 
        maxToRenderPerBatch={5} 
        windowSize={5} 
        removeClippedSubviews={true} 
        ListEmptyComponent={!loading && faces.length === 0 ? EmptyState : null}
        ListFooterComponent={pagination.hasMore && !loading ? null : (
          <ActivityIndicator style={{margin: 20}} color="#2196F3" />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5} 
        contentContainerStyle={styles.flatListContent}
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

// Optimize image rendering with default props
Image.defaultProps = {
  ...Image.defaultProps,
  fadeDuration: 200,     
  progressiveRenderingEnabled: true, 
};

const styles = StyleSheet.create({
  // Loading state styles
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  
  // Empty state styles
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyStateText: {
    marginTop: 10,
    fontSize: 18,
    color: '#555',
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  // Instructions styles
  instructionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 10,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  instructionsButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  instructionsContainer: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  instructionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  instructionsSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  instructionSection: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  instructionIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitle: {
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 2,
  },
  instructionText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 19,
  },
  howToUseContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  howToUseTitle: {
    fontWeight: '600',
    marginBottom: 6,
  },
  howToUseStep: {
    fontSize: 14,
    marginBottom: 4,
    color: '#444',
  },
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
  flatListContent: {
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
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    resizeMethod: 'resize',
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
