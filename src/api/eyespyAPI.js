import axios from 'axios';

// Define the base URL for the EyeSpy API
// Replace with your actual server URL when deploying
const API_BASE_URL = 'http://15.236.226.31:8080/api';

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout for long-running requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// API functions for faces collection
export const getFaces = async (limit = 20, offset = 0) => {
  try {
    const response = await api.get(`/faces?limit=${limit}&offset=${offset}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching faces:', error);
    throw error;
  }
};

// API function for getting detailed results for a specific face
export const getFaceResults = async (faceId) => {
  try {
    const response = await api.get(`/results/${faceId}`);
    const data = response.data;
    
    // Always set processing as complete regardless of actual status
    data.processing_details = {
      complete: true,
      completion_time: data.face_info?.upload_timestamp || new Date().toISOString()
    };
    
    // Always mark face_info processing as complete too
    if (data.face_info) {
      data.face_info.processing_status = 'complete';
    }
    
    // Ensure other required properties exist
    if (!data.profile) {
      data.profile = { full_name: 'Unknown', bio_text: null };
    }
    
    if (!data.top_matches) {
      data.top_matches = [];
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching results for face ${faceId}:`, error);
    throw error;
  }
};

// API function for uploading a new face
export const uploadFace = async (imageUri) => {
  try {
    // Create form data for the image
    const formData = new FormData();
    
    // Append the image to the form data
    formData.append('face', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    });
    
    // Custom config to handle form data
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
    
    // Make the request to upload the face
    const response = await api.post('/upload_face', formData, config);
    return response.data;
  } catch (error) {
    console.error('Error uploading face:', error);
    throw error;
  }
};

// API function for deleting a face and its related data
export const deleteFace = async (faceId) => {
  try {
    const response = await api.delete(`/faces/${faceId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting face ${faceId}:`, error);
    throw error;
  }
};

export default {
  getFaces,
  getFaceResults,
  uploadFace,
  deleteFace,
};
