/**
 * Invitation Service
 * Generates and handles invitations to join tandas via QR codes and deep links
 */

import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

const APP_SCHEME = 'tandadigital';
const WEB_BASE_URL = 'https://tanda-app.fly.dev';

export interface InvitationLink {
  deepLink: string;    // tandadigital://join/ABC123
  webLink: string;     // https://tanda-app.fly.dev/join/ABC123
  qrData: string;      // Data to generate QR code
}

export interface ParsedInvitation {
  tandaId: string;
}

class InvitationsService {
  private static instance: InvitationsService;

  private constructor() {}

  static getInstance(): InvitationsService {
    if (!InvitationsService.instance) {
      InvitationsService.instance = new InvitationsService();
    }
    return InvitationsService.instance;
  }

  /**
   * Generate invitation links for a tanda
   */
  generateInvitationLinks(tandaId: string): InvitationLink {
    const deepLink = `${APP_SCHEME}://join/${tandaId}`;
    const webLink = `${WEB_BASE_URL}/join/${tandaId}`;

    // QR points to web link which has universal links configured
    const qrData = webLink;

    return {
      deepLink,
      webLink,
      qrData,
    };
  }

  /**
   * Parse an invitation link to extract tanda ID
   */
  parseInvitationLink(url: string): ParsedInvitation | null {
    try {
      // Handle deep link: tandadigital://join/ABC123
      if (url.startsWith(APP_SCHEME)) {
        const match = url.match(/join\/([A-Za-z0-9]+)/);
        if (match) {
          return { tandaId: match[1] };
        }
      }

      // Handle web link: https://tanda-app.fly.dev/join/ABC123
      if (url.includes('/join/')) {
        const match = url.match(/join\/([A-Za-z0-9]+)/);
        if (match) {
          return { tandaId: match[1] };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Share invitation via system share dialog
   */
  async shareInvitation(tandaId: string, tandaName: string): Promise<boolean> {
    const links = this.generateInvitationLinks(tandaId);

    const message = `Unete a mi tanda "${tandaName}"!\n\n${links.webLink}`;

    try {
      if (Platform.OS === 'web') {
        // Web Share API
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({
            title: `Unete a ${tandaName}`,
            text: message,
            url: links.webLink,
          });
          return true;
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(message);
          return true;
        }
        return false;
      } else {
        // React Native Share
        const result = await Share.share({
          message,
          title: `Unete a ${tandaName}`,
        });

        return result.action === Share.sharedAction;
      }
    } catch (error) {
      console.error('[Invitations] Share error:', error);
      return false;
    }
  }

  /**
   * Copy invitation link to clipboard
   */
  async copyToClipboard(tandaId: string): Promise<boolean> {
    const links = this.generateInvitationLinks(tandaId);

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(links.webLink);
          return true;
        }
        return false;
      } else {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(links.webLink);
        return true;
      }
    } catch (error) {
      console.error('[Invitations] Copy error:', error);
      return false;
    }
  }

  /**
   * Check if the app can handle the deep link scheme
   */
  async canOpenScheme(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      return await Linking.canOpenURL(`${APP_SCHEME}://`);
    } catch {
      return false;
    }
  }

  /**
   * Get the initial URL that opened the app (for handling deep links on launch)
   */
  async getInitialURL(): Promise<string | null> {
    try {
      return await Linking.getInitialURL();
    } catch {
      return null;
    }
  }

  /**
   * Add a listener for incoming deep links
   */
  addDeepLinkListener(callback: (url: string) => void): { remove: () => void } {
    const subscription = Linking.addEventListener('url', (event) => {
      callback(event.url);
    });

    return {
      remove: () => subscription.remove(),
    };
  }

  /**
   * Generate a short code from tanda ID for easy sharing
   */
  generateShortCode(tandaId: string): string {
    // Take the last 6 characters of the ID for a short code
    const shortCode = tandaId.slice(-6).toUpperCase();
    return shortCode;
  }

  /**
   * Format invitation message for different platforms
   */
  formatInvitationMessage(tandaName: string, amount: number, webLink: string): string {
    return [
      `Unete a mi tanda "${tandaName}"!`,
      '',
      `Monto por ciclo: ${amount.toFixed(2)} EUR`,
      '',
      `Unete aqui: ${webLink}`,
      '',
      'Tanda Digital - Ahorro colaborativo seguro',
    ].join('\n');
  }
}

export const invitationsService = InvitationsService.getInstance();
