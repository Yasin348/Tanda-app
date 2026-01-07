// Servicio de almacenamiento - Compatible con Web y Native
import { Platform } from 'react-native';
import { SecuritySettings } from '../types';

// Importaciones condicionales
let SecureStore: typeof import('expo-secure-store') | null = null;
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
let Crypto: typeof import('expo-crypto') | null = null;

// Solo cargar módulos nativos si no estamos en web
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
  LocalAuthentication = require('expo-local-authentication');
  Crypto = require('expo-crypto');
}

const KEYS = {
  SEED: 'tanda_seed_encrypted',
  SECURITY_SETTINGS: 'tanda_security_settings',
  USER_DATA: 'tanda_user_data',
  TANDAS: 'tanda_tandas_data',
  PIN_HASH: 'tanda_pin_hash',
  ONBOARDING_COMPLETE: 'tanda_onboarding_complete',
  KYC_STATUS: 'tanda_kyc_status',
  SIMULATED_BALANCE: 'tanda_simulated_balance',
};

// Helpers para web storage con encriptación básica
const webStorage = {
  // Encriptación simple para localStorage (en producción usar algo más robusto)
  encrypt: (data: string): string => {
    // Base64 + reverse para ofuscación básica
    // NOTA: En producción, usar Web Crypto API para encriptación real
    return btoa(data.split('').reverse().join(''));
  },
  decrypt: (data: string): string => {
    try {
      return atob(data).split('').reverse().join('');
    } catch {
      return data;
    }
  },
  setItem: (key: string, value: string, secure: boolean = false): void => {
    if (typeof localStorage !== 'undefined') {
      const data = secure ? webStorage.encrypt(value) : value;
      localStorage.setItem(key, data);
    }
  },
  getItem: (key: string, secure: boolean = false): string | null => {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(key);
      if (data && secure) {
        return webStorage.decrypt(data);
      }
      return data;
    }
    return null;
  },
  removeItem: (key: string): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
};

class SecureStorageService {
  private static instance: SecureStorageService;
  private isWeb: boolean;

  private constructor() {
    this.isWeb = Platform.OS === 'web';
  }

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  // Guardar seed de forma segura
  async saveSeed(seed: string): Promise<void> {
    if (this.isWeb) {
      webStorage.setItem(KEYS.SEED, seed, true);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(KEYS.SEED, seed, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
    }
  }

  // Obtener seed
  async getSeed(): Promise<string | null> {
    if (this.isWeb) {
      return webStorage.getItem(KEYS.SEED, true);
    } else if (SecureStore) {
      return await SecureStore.getItemAsync(KEYS.SEED);
    }
    return null;
  }

  // Eliminar seed
  async deleteSeed(): Promise<void> {
    if (this.isWeb) {
      webStorage.removeItem(KEYS.SEED);
    } else if (SecureStore) {
      await SecureStore.deleteItemAsync(KEYS.SEED);
    }
  }

  // Guardar configuración de seguridad
  async saveSecuritySettings(settings: SecuritySettings): Promise<void> {
    const data = JSON.stringify(settings);
    if (this.isWeb) {
      webStorage.setItem(KEYS.SECURITY_SETTINGS, data);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(KEYS.SECURITY_SETTINGS, data);
    }
  }

  // Obtener configuración de seguridad
  async getSecuritySettings(): Promise<SecuritySettings | null> {
    let data: string | null = null;
    if (this.isWeb) {
      data = webStorage.getItem(KEYS.SECURITY_SETTINGS);
    } else if (SecureStore) {
      data = await SecureStore.getItemAsync(KEYS.SECURITY_SETTINGS);
    }
    return data ? JSON.parse(data) : null;
  }

  // Guardar PIN hash
  async savePinHash(hash: string): Promise<void> {
    if (this.isWeb) {
      webStorage.setItem(KEYS.PIN_HASH, hash, true);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(KEYS.PIN_HASH, hash);
    }
  }

  // Obtener PIN hash
  async getPinHash(): Promise<string | null> {
    if (this.isWeb) {
      return webStorage.getItem(KEYS.PIN_HASH, true);
    } else if (SecureStore) {
      return await SecureStore.getItemAsync(KEYS.PIN_HASH);
    }
    return null;
  }

  // Verificar disponibilidad de biometría
  async checkBiometricAvailability(): Promise<{
    available: boolean;
    type: 'fingerprint' | 'faceId' | null;
  }> {
    // Web no soporta biometría nativa
    if (this.isWeb) {
      return { available: false, type: null };
    }

    if (!LocalAuthentication) {
      return { available: false, type: null };
    }

    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return { available: false, type: null };
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      return { available: false, type: null };
    }

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return { available: true, type: 'faceId' };
    }

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return { available: true, type: 'fingerprint' };
    }

    return { available: false, type: null };
  }

  // Autenticar con biometría
  async authenticateWithBiometric(): Promise<boolean> {
    // Web no soporta biometría
    if (this.isWeb) {
      return false;
    }

    if (!LocalAuthentication) {
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verifica tu identidad',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
        fallbackLabel: 'Usar PIN',
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }

  // Hash seguro para PIN usando SHA-256
  async hashPinAsync(pin: string): Promise<string> {
    if (this.isWeb) {
      // Usar Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(pin + 'tanda_salt_2024');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (Crypto) {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin + 'tanda_salt_2024'
      );
      return hash;
    }
    // Fallback
    return this.hashPin(pin);
  }

  // Hash síncrono para compatibilidad
  hashPin(pin: string): string {
    // Versión simplificada para uso síncrono
    let hash = 0;
    const salted = pin + 'tanda_salt_2024';
    for (let i = 0; i < salted.length; i++) {
      const char = salted.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Verificar PIN
  async verifyPin(pin: string): Promise<boolean> {
    const storedHash = await this.getPinHash();
    if (!storedHash) return false;
    return this.hashPin(pin) === storedHash;
  }

  // Marcar onboarding como completado
  async setOnboardingComplete(): Promise<void> {
    if (this.isWeb) {
      webStorage.setItem(KEYS.ONBOARDING_COMPLETE, 'true');
    } else if (SecureStore) {
      await SecureStore.setItemAsync(KEYS.ONBOARDING_COMPLETE, 'true');
    }
  }

  // Verificar si onboarding está completo
  async isOnboardingComplete(): Promise<boolean> {
    let value: string | null = null;
    if (this.isWeb) {
      value = webStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    } else if (SecureStore) {
      value = await SecureStore.getItemAsync(KEYS.ONBOARDING_COMPLETE);
    }
    return value === 'true';
  }

  // Guardar datos de usuario
  async saveUserData(data: any): Promise<void> {
    const jsonData = JSON.stringify(data);
    if (this.isWeb) {
      webStorage.setItem(KEYS.USER_DATA, jsonData);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(KEYS.USER_DATA, jsonData);
    }
  }

  // Obtener datos de usuario
  async getUserData(): Promise<any | null> {
    let data: string | null = null;
    if (this.isWeb) {
      data = webStorage.getItem(KEYS.USER_DATA);
    } else if (SecureStore) {
      data = await SecureStore.getItemAsync(KEYS.USER_DATA);
    }
    return data ? JSON.parse(data) : null;
  }

  // Guardar tandas localmente
  async saveTandas(tandas: any[]): Promise<void> {
    const data = JSON.stringify(tandas);
    if (this.isWeb) {
      webStorage.setItem(KEYS.TANDAS, data);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(KEYS.TANDAS, data);
    }
  }

  // Obtener tandas guardadas
  async getTandas(): Promise<any[]> {
    let data: string | null = null;
    if (this.isWeb) {
      data = webStorage.getItem(KEYS.TANDAS);
    } else if (SecureStore) {
      data = await SecureStore.getItemAsync(KEYS.TANDAS);
    }
    return data ? JSON.parse(data) : [];
  }

  // Generar key de KYC vinculada a la wallet
  private getKYCKey(walletAddress?: string): string {
    if (walletAddress) {
      // Usar los primeros 8 caracteres de la wallet para el key
      const shortAddr = walletAddress.slice(0, 8);
      return `${KEYS.KYC_STATUS}_${shortAddr}`;
    }
    return KEYS.KYC_STATUS;
  }

  // Guardar estado de KYC (vinculado a wallet)
  async saveKYCStatus(status: any, walletAddress?: string): Promise<void> {
    const key = this.getKYCKey(walletAddress);

    if (status === null) {
      // Eliminar estado
      if (this.isWeb) {
        webStorage.removeItem(key);
      } else if (SecureStore) {
        await SecureStore.deleteItemAsync(key);
      }
      return;
    }

    const data = JSON.stringify(status);
    if (this.isWeb) {
      webStorage.setItem(key, data);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(key, data);
    }
  }

  // Obtener estado de KYC (vinculado a wallet)
  async getKYCStatus(walletAddress?: string): Promise<any | null> {
    const key = this.getKYCKey(walletAddress);
    let data: string | null = null;
    if (this.isWeb) {
      data = webStorage.getItem(key);
    } else if (SecureStore) {
      data = await SecureStore.getItemAsync(key);
    }
    return data ? JSON.parse(data) : null;
  }

  // Guardar balance simulado (testnet)
  async saveSimulatedBalance(balance: number, walletAddress?: string): Promise<void> {
    const key = walletAddress
      ? `${KEYS.SIMULATED_BALANCE}_${walletAddress.slice(0, 8)}`
      : KEYS.SIMULATED_BALANCE;
    const data = JSON.stringify({ balance, updatedAt: Date.now() });
    if (this.isWeb) {
      webStorage.setItem(key, data);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(key, data);
    }
  }

  // Obtener balance simulado (testnet)
  async getSimulatedBalance(walletAddress?: string): Promise<number | null> {
    const key = walletAddress
      ? `${KEYS.SIMULATED_BALANCE}_${walletAddress.slice(0, 8)}`
      : KEYS.SIMULATED_BALANCE;
    let data: string | null = null;
    if (this.isWeb) {
      data = webStorage.getItem(key);
    } else if (SecureStore) {
      data = await SecureStore.getItemAsync(key);
    }
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.balance;
    }
    return null;
  }

  // Limpiar todos los datos (logout)
  async clearAll(): Promise<void> {
    if (this.isWeb) {
      // Limpiar todas las keys base
      Object.values(KEYS).forEach(key => webStorage.removeItem(key));
      // También limpiar cualquier key con sufijo de wallet (KYC, SIMULATED_BALANCE, etc.)
      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith(KEYS.KYC_STATUS) ||
            key.startsWith(KEYS.SIMULATED_BALANCE)
          )) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } else if (SecureStore) {
      await SecureStore.deleteItemAsync(KEYS.SEED);
      await SecureStore.deleteItemAsync(KEYS.SECURITY_SETTINGS);
      await SecureStore.deleteItemAsync(KEYS.USER_DATA);
      await SecureStore.deleteItemAsync(KEYS.TANDAS);
      await SecureStore.deleteItemAsync(KEYS.PIN_HASH);
      await SecureStore.deleteItemAsync(KEYS.ONBOARDING_COMPLETE);
      await SecureStore.deleteItemAsync(KEYS.KYC_STATUS);
      await SecureStore.deleteItemAsync(KEYS.SIMULATED_BALANCE);
      // Nota: En SecureStore no podemos iterar sobre keys con sufijo de wallet,
      // pero están vinculadas a la wallet address, así que una nueva wallet
      // no cargará datos de otra wallet
    }
  }

  // Helper para verificar si estamos en web
  isPlatformWeb(): boolean {
    return this.isWeb;
  }

  // Métodos genéricos para almacenamiento
  async get(key: string): Promise<string | null> {
    if (this.isWeb) {
      return webStorage.getItem(key, true);
    } else if (SecureStore) {
      return await SecureStore.getItemAsync(key);
    }
    return null;
  }

  async set(key: string, value: string): Promise<void> {
    if (this.isWeb) {
      webStorage.setItem(key, value, true);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    if (this.isWeb) {
      webStorage.removeItem(key);
    } else if (SecureStore) {
      await SecureStore.deleteItemAsync(key);
    }
  }
}

export const secureStorage = SecureStorageService.getInstance();
