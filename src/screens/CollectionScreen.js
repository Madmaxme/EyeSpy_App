import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Alert 
} from 'react-native';
import { Image } from 'react-native';
import { getFaces } from '../api/eyespyAPI';
import { base64ToUri, formatTimestamp } from '../utils/imageUtils';
import { useFocusEffect } from '@react-navigation/native';

const FaceItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.faceItem} 
      onPress={() => onPress(item)}
    >
      <View style={styles.faceContainer}>
        <Image
          style={styles.faceThumbnail}
          source={{ uri: base64ToUri(item.thumbnail_base64) }}
          resizeMode="cover"
        />
      </View>
      <View style={styles.faceInfo}>
        <Text style={styles.faceId} numberOfLines={1}>{item.face_id}</Text>
        <Text style={styles.faceTimestamp}>
          {formatTimestamp(item.upload_timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const CollectionScreen = ({ navigation }) => {
  const [faces, setFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // Load initial data when component mounts
  useEffect(() => {
    loadFaces();
    
    // Set up polling interval for auto-refresh
    const interval = setInterval(() => {
      loadFaces(0, false);
    }, 5000); // Refresh every 5 seconds
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
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
      <FlatList
        data={faces}
        renderItem={({ item }) => (
          <FaceItem 
            item={item} 
            onPress={handleFacePress} 
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
  faceContainer: {
    position: 'relative',
  },
  faceThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
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
});

export default CollectionScreen;
