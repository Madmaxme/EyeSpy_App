import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadFace } from '../api/eyespyAPI';

const UploadScreen = ({ navigation }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Request permission when component mounts
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraStatus !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        }
        
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libraryStatus !== 'granted') {
          Alert.alert('Permission Required', 'Photo library permission is needed to select images.');
        }
      }
    })();
  }, []);
  
  // Handle selecting an image from the gallery
  const handleSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        setSelectedImage({
          uri: result.assets[0].uri,
          width: result.assets[0].width,
          height: result.assets[0].height,
          type: 'image/jpeg'
        });
      }
    } catch (error) {
      console.log('ImagePicker Error: ', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };
  
  // Handle taking a photo with the camera
  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        setSelectedImage({
          uri: result.assets[0].uri,
          width: result.assets[0].width,
          height: result.assets[0].height,
          type: 'image/jpeg'
        });
      }
    } catch (error) {
      console.log('Camera Error: ', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };
  
  // Handle uploading the selected image
  const handleUpload = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }
    
    try {
      setUploading(true);
      
      // Upload the face image
      const result = await uploadFace(selectedImage.uri);
      
      if (result.status === 'success') {
        // Show brief toast/alert then navigate back
        Alert.alert('Success', 'Face uploaded successfully');
        
        // Short timeout to allow user to see the alert before navigating
        setTimeout(() => {
          navigation.goBack(); // Go back to the Collection screen
        }, 1000);
      } else {
        throw new Error('Upload failed: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error uploading face:', error);
      Alert.alert('Error', 'Failed to upload face. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {selectedImage ? (
          <Image
            source={{ uri: selectedImage.uri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>
              Select or take a photo of a face
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        {!uploading ? (
          <>
            <TouchableOpacity 
              style={[styles.button, styles.galleryButton]} 
              onPress={handleSelectImage}
              disabled={uploading}
            >
              <Text style={styles.buttonText}>Select from Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.cameraButton]} 
              onPress={handleTakePhoto}
              disabled={uploading}
            >
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>
            
            {selectedImage && (
              <TouchableOpacity 
                style={[styles.button, styles.uploadButton]} 
                onPress={handleUpload}
                disabled={uploading}
              >
                <Text style={styles.buttonText}>Upload Face</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.uploadingText}>Uploading face...</Text>
          </View>
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Upload Guidelines</Text>
        <Text style={styles.infoText}>• Use a clear, well-lit photo of a face</Text>
        <Text style={styles.infoText}>• Front-facing portraits work best</Text>
        <Text style={styles.infoText}>• Avoid group photos or blurry images</Text>
        <Text style={styles.infoText}>• Processing may take several minutes</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  imageContainer: {
    flex: 3,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 18,
    color: '#757575',
    textAlign: 'center',
  },
  buttonContainer: {
    flex: 2,
    justifyContent: 'center',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  galleryButton: {
    backgroundColor: '#2196F3',
  },
  cameraButton: {
    backgroundColor: '#4CAF50',
  },
  uploadButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  uploadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  infoContainer: {
    flex: 1,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    marginTop: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 5,
  },
});

export default UploadScreen;
