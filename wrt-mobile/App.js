// ============================================
// WRT Garage — React Native Main Entry Point
// Honda PGM-FI AI Diagnostic Tool v2.0
// ============================================
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme/colors';
import { bluetoothService } from './src/services/bluetooth';

export default function App() {
  useEffect(() => {
    // Initialize Bluetooth permissions
    bluetoothService.init();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <AppNavigator />
    </NavigationContainer>
  );
}
