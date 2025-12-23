/**
 * Deep Linking Service
 * Maneja deep links y estado de la app para verificaciones KYC
 *
 * URLs soportadas:
 * - tandadigital://kyc-callback?status=success
 * - tandadigital://kyc-callback?status=pending
 * - tandadigital://kyc-callback?status=failed
 * - tandadigital://tanda/{tandaId}
 *
 * NOTA: Este servicio está deshabilitado en web para evitar problemas de compatibilidad.
 */

import { Linking, AppState, AppStateStatus, Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { useUserStore } from '../stores/userStore';

// Scheme de la app
export const APP_SCHEME = 'tandadigital';

// URLs de callback
export const DEEP_LINK_URLS = {
  kycCallback: `${APP_SCHEME}://kyc-callback`,
  kycSuccess: `${APP_SCHEME}://kyc-callback?status=success`,
  kycPending: `${APP_SCHEME}://kyc-callback?status=pending`,
  kycFailed: `${APP_SCHEME}://kyc-callback?status=failed`,
  tanda: (tandaId: string) => `${APP_SCHEME}://tanda/${tandaId}`,
};

// Parsed deep link
export interface ParsedDeepLink {
  path: string;
  params: Record<string, string>;
}

// Callbacks para eventos
type DeepLinkCallback = (link: ParsedDeepLink) => void;
type AppStateCallback = (state: AppStateStatus) => void;
type KYCCheckCallback = () => void;

class DeepLinkingService {
  private static instance: DeepLinkingService;
  private deepLinkCallbacks: DeepLinkCallback[] = [];
  private appStateCallbacks: AppStateCallback[] = [];
  private kycCheckCallbacks: KYCCheckCallback[] = [];
  private currentAppState: AppStateStatus = 'active';
  private isInitialized = false;
  private pendingKYCCheck = false;

  private constructor() {}

  static getInstance(): DeepLinkingService {
    if (!DeepLinkingService.instance) {
      DeepLinkingService.instance = new DeepLinkingService();
    }
    return DeepLinkingService.instance;
  }

  /**
   * Inicializar el servicio de deep linking
   * NOTA: Deshabilitado en web para evitar problemas de compatibilidad
   */
  initialize(): void {
    if (this.isInitialized) return;

    // No inicializar en web
    if (Platform.OS === 'web') {
      console.log('[DeepLinking] Skipping initialization on web');
      return;
    }

    console.log('[DeepLinking] Initializing...');

    // Listener para deep links entrantes
    Linking.addEventListener('url', this.handleDeepLink);

    // Listener para cambios de estado de la app
    AppState.addEventListener('change', this.handleAppStateChange);

    // Verificar si la app fue abierta desde un deep link
    this.checkInitialURL();

    this.isInitialized = true;
    console.log('[DeepLinking] Initialized');
  }

  /**
   * Cleanup al desmontar
   */
  cleanup(): void {
    // Los listeners se limpian automáticamente en React Native moderno
    this.deepLinkCallbacks = [];
    this.appStateCallbacks = [];
    this.kycCheckCallbacks = [];
    this.isInitialized = false;
  }

  /**
   * Parsear una URL de deep link
   */
  parseURL(url: string): ParsedDeepLink | null {
    try {
      const parsed = ExpoLinking.parse(url);

      // Extraer path y params
      const path = parsed.path || '';
      const params: Record<string, string> = {};

      if (parsed.queryParams) {
        Object.entries(parsed.queryParams).forEach(([key, value]) => {
          if (typeof value === 'string') {
            params[key] = value;
          } else if (Array.isArray(value) && value.length > 0) {
            params[key] = value[0];
          }
        });
      }

      return { path, params };
    } catch (error) {
      console.error('[DeepLinking] Error parsing URL:', error);
      return null;
    }
  }

  /**
   * Handler para deep links entrantes
   */
  private handleDeepLink = ({ url }: { url: string }): void => {
    console.log('[DeepLinking] Received URL:', url);

    const parsed = this.parseURL(url);
    if (!parsed) return;

    // Notificar a todos los callbacks registrados
    this.deepLinkCallbacks.forEach(callback => {
      try {
        callback(parsed);
      } catch (error) {
        console.error('[DeepLinking] Error in callback:', error);
      }
    });

    // Manejar rutas conocidas
    this.handleKnownRoutes(parsed);
  };

  /**
   * Handler para cambios de estado de la app
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    const previousState = this.currentAppState;

    // Detectar cuando la app vuelve a primer plano
    if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[DeepLinking] App came to foreground');

      // Si hay una verificación KYC pendiente, verificar estado
      if (this.pendingKYCCheck) {
        console.log('[DeepLinking] Checking KYC status after returning to app...');
        this.checkKYCStatus();
      }
    }

    this.currentAppState = nextAppState;

    // Notificar a callbacks de app state
    this.appStateCallbacks.forEach(callback => {
      try {
        callback(nextAppState);
      } catch (error) {
        console.error('[DeepLinking] Error in app state callback:', error);
      }
    });
  };

  /**
   * Manejar rutas conocidas
   */
  private handleKnownRoutes(link: ParsedDeepLink): void {
    const { path, params } = link;

    // KYC Callback
    if (path === 'kyc-callback' || path.startsWith('kyc')) {
      console.log('[DeepLinking] KYC callback received:', params);
      this.handleKYCCallback(params);
      return;
    }

    // Tanda deep link
    if (path.startsWith('tanda/')) {
      const tandaId = path.replace('tanda/', '');
      console.log('[DeepLinking] Tanda deep link:', tandaId);
      // Navegar a tanda - esto se maneja en el navigation
      return;
    }
  }

  /**
   * Manejar callback de KYC
   */
  private async handleKYCCallback(params: Record<string, string>): Promise<void> {
    const status = params.status || 'unknown';
    console.log('[DeepLinking] KYC callback status:', status);

    // Verificar estado real del KYC
    await this.checkKYCStatus();

    // Notificar a callbacks de KYC
    this.kycCheckCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[DeepLinking] Error in KYC callback:', error);
      }
    });
  }

  /**
   * Verificar estado de KYC desde el backend
   */
  async checkKYCStatus(): Promise<void> {
    try {
      const { loadKYCStatus } = useUserStore.getState();
      await loadKYCStatus();
      this.pendingKYCCheck = false;
      console.log('[DeepLinking] KYC status checked');
    } catch (error) {
      console.error('[DeepLinking] Error checking KYC status:', error);
    }
  }

  /**
   * Verificar si la app fue abierta desde un deep link
   */
  private async checkInitialURL(): Promise<void> {
    try {
      const url = await Linking.getInitialURL();
      if (url) {
        console.log('[DeepLinking] Initial URL:', url);
        this.handleDeepLink({ url });
      }
    } catch (error) {
      console.error('[DeepLinking] Error getting initial URL:', error);
    }
  }

  /**
   * Marcar que hay una verificación KYC pendiente
   * Cuando la app vuelva a primer plano, verificará el estado
   */
  setPendingKYCCheck(pending: boolean): void {
    this.pendingKYCCheck = pending;
    console.log('[DeepLinking] Pending KYC check:', pending);
  }

  /**
   * Registrar callback para deep links
   */
  onDeepLink(callback: DeepLinkCallback): () => void {
    this.deepLinkCallbacks.push(callback);
    return () => {
      this.deepLinkCallbacks = this.deepLinkCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Registrar callback para cambios de estado de la app
   */
  onAppStateChange(callback: AppStateCallback): () => void {
    this.appStateCallbacks.push(callback);
    return () => {
      this.appStateCallbacks = this.appStateCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Registrar callback para verificaciones de KYC
   */
  onKYCCheck(callback: KYCCheckCallback): () => void {
    this.kycCheckCallbacks.push(callback);
    return () => {
      this.kycCheckCallbacks = this.kycCheckCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Obtener la URL de callback para KYC
   * Nota: Esta funcion se mantiene por compatibilidad,
   * pero KYC ahora es manejado por Mykobo
   */
  getKYCCallbackURL(): string {
    // Para web, usar URL absoluta si está disponible
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const baseURL = window.location.origin;
      return `${baseURL}/kyc-callback`;
    }
    // Para native, usar el scheme
    return DEEP_LINK_URLS.kycCallback;
  }

  /**
   * Crear URL de deep link
   */
  createURL(path: string, params?: Record<string, string>): string {
    return ExpoLinking.createURL(path, { queryParams: params });
  }
}

// Exportar instancia singleton
export const deepLinkingService = DeepLinkingService.getInstance();

// Exportar hook para usar en componentes
export function useDeepLinking() {
  return deepLinkingService;
}
