# EyeSpy Mobile App

A React Native application for the EyeSpy face recognition and identity analysis system. This app allows you to upload face images, track processing status, and view detailed analysis results on your iOS device.

## Features

- **Face Collection View**: Browse and monitor all processed faces with auto-refreshing status
- **Detail View**: Comprehensive display of identity match results and biographical information
- **Upload Interface**: Submit new face images using your device camera or photo library
- **Real-time Updates**: Automatic refreshing of processing status

## Prerequisites

- Node.js (14.x or newer)
- Xcode (for iOS development)
- CocoaPods
- Expo CLI

## Getting Started

### Installation

1. Install project dependencies:

```bash
cd /Users/maximillianludwick/Desktop/EyeSpy/EyeSpy_App
npm install
```

2. Configure the API endpoint:

Edit `src/api/eyespyAPI.js` and update the `API_BASE_URL` to point to your running EyeSpy backend server.

### Running the App

For iOS simulator:

```bash
npm run ios
```

For physical iOS device debugging, you'll need to:
1. Open the project in Xcode
2. Sign the app with your Apple Developer account
3. Connect your device and select it as the target

## Project Structure

```
/EyeSpy_App
├── App.js                  # Main application entry point
├── package.json            # Project dependencies
└── src/
    ├── api/
    │   └── eyespyAPI.js    # API integration with EyeSpy backend
    ├── components/         # Reusable UI components
    ├── navigation/
    │   └── AppNavigator.js # App navigation configuration
    ├── screens/
    │   ├── CollectionScreen.js # Main face collection view
    │   ├── DetailScreen.js     # Face detail view
    │   └── UploadScreen.js     # Face upload interface
    └── utils/
        └── imageUtils.js   # Utility functions for image handling
```

## Connecting to the Backend

This app connects to the EyeSpy backend server through RESTful API calls. The backend provides endpoints for:

- `GET /api/faces` - List all processed faces
- `GET /api/results/{face_id}` - Get detailed results for a specific face
- `POST /api/upload_face` - Upload a new face for processing
- `DELETE /api/faces/{face_id}` - Delete a face and related data

Make sure your backend server is running and accessible from your device.

## Adding New Features

To extend the app with new features:

1. Create new screen components in the `src/screens` directory
2. Add new API functions in `src/api/eyespyAPI.js`
3. Update the navigation in `src/navigation/AppNavigator.js`
# EyeSpy_App
