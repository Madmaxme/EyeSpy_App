import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import CollectionScreen from '../screens/CollectionScreen';
import DetailScreen from '../screens/DetailScreen';
import UploadScreen from '../screens/UploadScreen';

// Create stack navigator
const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Collection"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#2196F3',
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
          options={{ title: 'EyeSpy' }}
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
