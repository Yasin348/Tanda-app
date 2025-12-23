// Polyfills para web - deben ir PRIMERO antes de cualquier otra importación
import { Buffer } from 'buffer';
import process from 'process';

// Configurar globals para web
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = process;
  (window as any).global = window;

  // Polyfill para crypto.getRandomValues si no existe
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.getRandomValues) {
    // Fallback básico - en producción usar una librería más robusta
    (window.crypto as any).getRandomValues = (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    };
  }
}

import { Platform } from 'react-native';

// Solo importar polyfills nativos si no estamos en web
if (Platform.OS !== 'web') {
  require('react-native-get-random-values');
}

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
