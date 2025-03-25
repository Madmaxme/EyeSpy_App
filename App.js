import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import our main navigator
import AppNavigator from './src/navigation/AppNavigator';

// Ignore specific warnings that might be caused by dependencies
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested', // Ignore this warning for now as it's common with nested scrollviews
  'Possible Unhandled Promise Rejection', // We handle promise rejections in try/catch blocks
]);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#2196F3" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
