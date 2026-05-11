import { Platform } from 'react-native';

/**
 * SG Finance Flow Mobile Configuration
 */

// Auto-detect backend URL based on environment
// 10.0.2.2 is the magic IP for Android Emulator to hit host localhost
// 127.0.0.1 works for iOS Simulator
// const LOCAL_IP = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const LOCAL_IP = '192.168.50.76';
// For real device testing, you should replace this with your computer's local IP
// Example: '192.168.1.5'
export const API_CONFIG = {
  BASE_URL: `http://${LOCAL_IP}:8000/api/v1`,
};
