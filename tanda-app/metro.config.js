const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Polyfills para web
config.resolver.extraNodeModules = {
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
};

// Configuración para web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirigir módulos problemáticos en web
  if (platform === 'web') {
    // react-native-quick-crypto no funciona en web, usar crypto-browserify
    if (moduleName === 'react-native-quick-crypto') {
      return context.resolveRequest(context, 'crypto-browserify', platform);
    }
    // Polyfills de Node.js para web
    if (moduleName === 'crypto') {
      return context.resolveRequest(context, 'crypto-browserify', platform);
    }
    if (moduleName === 'stream') {
      return context.resolveRequest(context, 'stream-browserify', platform);
    }
  }

  // Usar resolución por defecto para todo lo demás
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
