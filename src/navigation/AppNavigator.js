import React from 'react';
import { Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import CollectionScreen from '../screens/CollectionScreen';
import DetailScreen from '../screens/DetailScreen';
import UploadScreen from '../screens/UploadScreen';

// Import logo from assets folder
const headerLogo = require('../assets/logo.png');

// Create stack navigator
const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Collection"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#000000',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        <Stack.Screen
          name="Collection"
          component={CollectionScreen}
          options={{
            headerTitle: () => (
              <Image 
                source={headerLogo}
                style={{ width: 120, height: 30, resizeMode: 'contain' }}
              />
            )
          }}
        />
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={{ title: 'Face Details' }}
        />
        <Stack.Screen
          name="Upload"
          component={UploadScreen}
          options={{ title: 'Upload Face' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
