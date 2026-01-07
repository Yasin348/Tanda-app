// Crypto shim - Compatible con Web y React Native
// Este archivo debe importarse PRIMERO antes de cualquier otra cosa

import { Platform } from 'react-native';

// Solo importar polyfill en native (en web ya existe crypto.getRandomValues)
if (Platform.OS !== 'web') {
  require('react-native-get-random-values');
}

// En web, crypto ya está disponible globalmente
// En native, necesitamos configurar polyfills

const isWeb = Platform.OS === 'web';

if (!isWeb) {
  // Polyfill crypto.getRandomValues si es necesario
  if (typeof global.crypto === 'undefined') {
    (global as any).crypto = {};
  }

  // Mock getCiphers y otras funciones de Node.js crypto que no están disponibles en RN
  const cryptoMock = {
    getRandomValues: (array: Uint8Array) => {
      if (global.crypto && global.crypto.getRandomValues) {
        return global.crypto.getRandomValues(array);
      }
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    getCiphers: () => ['aes-256-cbc', 'aes-128-cbc', 'aes-256-gcm'],
    getHashes: () => ['sha256', 'sha512', 'sha1'],
    randomBytes: (size: number) => {
      const array = new Uint8Array(size);
      if (global.crypto && global.crypto.getRandomValues) {
        global.crypto.getRandomValues(array);
      } else {
        for (let i = 0; i < size; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
      }
      return array;
    },
    createHash: (algorithm: string) => {
      let data = '';
      return {
        update: (input: string) => {
          data += input;
          return { digest: (encoding: string) => data };
        },
      };
    },
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        // Simple implementation - en producción usar expo-crypto
        return new ArrayBuffer(32);
      },
    },
  };

  // Aplicar mock a global
  Object.assign(global.crypto, cryptoMock);

  // También manejar require('crypto') configurando resolución de módulos
  (global as any).crypto = { ...global.crypto, ...cryptoMock };
}

export {};
