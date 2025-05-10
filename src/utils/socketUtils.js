import io from 'socket.io-client';

// Define the WebSocket URL directly
// Using the same base URL as the API but without the /api suffix
// For React Native, we need to use a fixed IP address since window.location isn't available
const SOCKET_URL = 'http://localhost:8080';  

console.log('WebSocket connection URL:', SOCKET_URL);

// Create and configure the socket
let socket = null;
let isConnected = false;

// Initialize the socket connection
export const initializeSocket = () => {
  if (!socket) {
    console.log('Creating new socket connection to', SOCKET_URL);
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],  // Try both transports
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 20000
    });
    
    // Set up global debugging for all events
    const originalOn = socket.on;
    socket.on = function(eventName, callback) {
      return originalOn.call(this, eventName, (...args) => {
        if (eventName !== 'connect' && eventName !== 'disconnect') {
          console.log(`Socket received event '${eventName}':`, args[0]);
        }
        return callback(...args);
      });
    };
    
    // Log connection events
    socket.on('connect', () => {
      console.log('Socket connected successfully');
      isConnected = true;
      // Join the global updates room
      socket.emit('join', { room: 'all_faces' });
      console.log('Joined global updates room');
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      isConnected = false;
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      isConnected = false;
    });
  }
  return socket;
};

// Get the socket instance (creating it if needed)
export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

// Join a specific face room to receive updates for that face
export const joinFaceRoom = (faceId) => {
  const socket = getSocket();
  
  // Only attempt to join if the socket is connected
  if (socket.connected) {
    socket.emit('join', { face_id: faceId });
    console.log(`Joined room for face: ${faceId}`);
  } else {
    console.log(`Socket not connected, will join room for face ${faceId} once connected`);
    // Set up an event to join the room once connected
    socket.once('connect', () => {
      socket.emit('join', { face_id: faceId });
      console.log(`Now joined room for face ${faceId} after connection`);
    });
  }
};

// Subscribe to real-time processing updates (globally)
export const subscribeToProcessingUpdates = (callback) => {
  const socket = getSocket();
  
  console.log('Subscribing to global_processing_update events');
  
  // Remove any existing listeners to avoid duplicates
  socket.off('global_processing_update');
  
  socket.on('global_processing_update', (data) => {
    console.log('Received global_processing_update:', data);
    callback(data);
  });
  
  // Also subscribe to 'processing_update' events as a fallback
  socket.off('processing_update');
  socket.on('processing_update', (data) => {
    console.log('Received processing_update:', data);
    callback(data);
  });
  
  // Special dedicated listener for failure events
  socket.off('processing_failed');
  socket.on('processing_failed', (data) => {
    console.log('🚨 CRITICAL: Received dedicated failure event:', data);
    // Add a special flag to indicate this came from the dedicated failure channel
    callback({...data, fromFailureChannel: true});
  });
};

// Subscribe to real-time processing updates for a specific face
export const subscribeToFaceUpdates = (faceId, callback) => {
  const socket = getSocket();
  joinFaceRoom(faceId);
  socket.on('processing_update', (data) => {
    if (data.face_id === faceId) {
      callback(data);
    }
  });
};

// Subscribe to real-time processing logs for a specific face
export const subscribeToFaceLogs = (faceId, callback) => {
  const socket = getSocket();
  
  // Extra logging for debugging
  console.log(`Setting up log listeners for face ${faceId}`);
  
  // First remove any existing listeners to avoid duplicates
  socket.off('processing_log');
  socket.off('global_processing_log');
  
  // Create the event handler functions
  const processingLogHandler = (data) => {
    console.log(`Processing log event received:`, data);
    // Check for exact match or null face_id (global message)
    if (data.face_id === faceId || !data.face_id) {
      console.log(`Matched face ID ${faceId}:`, data);
      // Add face_id if it's missing
      if (!data.face_id) {
        data.face_id = faceId;
      }
      callback(data);
    }
  };
  
  const globalLogHandler = (data) => {
    console.log(`Global processing log event received:`, data);
    // Check for exact match or null face_id (global message)
    if (data.face_id === faceId || !data.face_id) {
      console.log(`Matched face ID in global log ${faceId}:`, data);
      // Add face_id if it's missing
      if (!data.face_id) {
        data.face_id = faceId;
      }
      callback(data);
    }
  };
  
  // Register the handlers
  socket.on('processing_log', processingLogHandler);
  socket.on('global_processing_log', globalLogHandler);
  
  // Join the face room after setting up handlers
  joinFaceRoom(faceId);
  
  // If socket disconnects and reconnects, trigger a join again
  socket.on('connect', () => {
    console.log(`Socket reconnected, rejoining room for ${faceId}`);
    joinFaceRoom(faceId);
  });
  
  // Also listen to processing_update events and convert them to logs
  socket.on('processing_update', (data) => {
    if (data.face_id === faceId) {
      const logData = {
        face_id: faceId,
        message: data.message || `Status changed to ${data.status}`,
        type: 'status',
        status: data.status,
        timestamp: data.timestamp || Date.now() / 1000
      };
      callback(logData);
    }
  });
  
  // Extra debugging - send a test log if we don't see logs after 5 seconds
  setTimeout(() => {
    if (socket.connected) {
      // Force a join of the face room again
      socket.emit('join', { face_id: faceId });
      console.log(`Re-joined room for face ${faceId} after timeout`);
      
      // Create a client-side log if we haven't seen any server logs yet
      callback({
        face_id: faceId,
        message: 'Still listening for logs from server...',
        type: 'info',
        timestamp: Date.now() / 1000
      });
    } else {
      console.log(`Socket not connected after 5 seconds, cannot join room`);
      callback({
        face_id: faceId,
        message: 'Socket connection issue. Trying to reconnect...',
        type: 'warning',
        timestamp: Date.now() / 1000
      });
      socket.connect(); // Force reconnection attempt
    }
  }, 5000);
  
  return () => {
    // Return a cleanup function that removes these specific handlers
    socket.off('processing_log', processingLogHandler);
    socket.off('global_processing_log', globalLogHandler);
    socket.off('processing_update');
  };
};

// Clean up subscriptions when component unmounts
export const unsubscribeFromUpdates = () => {
  if (socket) {
    socket.off('global_processing_update');
    socket.off('processing_update');
    socket.off('processing_log');
  }
};

// Clean up face-specific subscriptions
export const unsubscribeFromFaceUpdates = (faceId) => {
  if (socket) {
    socket.off('processing_update');
    socket.off('processing_log');
    socket.off('global_processing_log');
    socket.off('processing_failed');
    // Leave the face room
    socket.emit('leave', { face_id: faceId });
    console.log(`Left room and unsubscribed from updates for face: ${faceId}`);
  }
};
