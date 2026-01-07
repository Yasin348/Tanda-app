/**
 * Invitations Service Tests
 */

import { invitationsService } from '../../src/services/invitations';

describe('InvitationsService', () => {
  describe('generateInvitationLinks', () => {
    it('should generate valid deep link', () => {
      const links = invitationsService.generateInvitationLinks('00000001');
      expect(links.deepLink).toBe('tandadigital://join/00000001');
    });

    it('should generate valid web link', () => {
      const links = invitationsService.generateInvitationLinks('00000001');
      expect(links.webLink).toBe('https://tanda-app.fly.dev/join/00000001');
    });

    it('should use web link for QR data', () => {
      const links = invitationsService.generateInvitationLinks('00000001');
      expect(links.qrData).toBe(links.webLink);
    });

    it('should handle different tanda IDs', () => {
      const links = invitationsService.generateInvitationLinks('ABC123');
      expect(links.deepLink).toContain('ABC123');
      expect(links.webLink).toContain('ABC123');
    });
  });

  describe('parseInvitationLink', () => {
    it('should parse deep link correctly', () => {
      const result = invitationsService.parseInvitationLink('tandadigital://join/00000001');
      expect(result).not.toBeNull();
      expect(result?.tandaId).toBe('00000001');
    });

    it('should parse web link correctly', () => {
      const result = invitationsService.parseInvitationLink('https://tanda-app.fly.dev/join/00000001');
      expect(result).not.toBeNull();
      expect(result?.tandaId).toBe('00000001');
    });

    it('should handle alphanumeric tanda IDs', () => {
      const result = invitationsService.parseInvitationLink('tandadigital://join/ABC123');
      expect(result).not.toBeNull();
      expect(result?.tandaId).toBe('ABC123');
    });

    it('should return null for invalid URLs', () => {
      const result = invitationsService.parseInvitationLink('invalid-url');
      expect(result).toBeNull();
    });

    it('should return null for URLs without join path', () => {
      const result = invitationsService.parseInvitationLink('https://tanda-app.fly.dev/other/00000001');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = invitationsService.parseInvitationLink('');
      expect(result).toBeNull();
    });
  });

  describe('generateShortCode', () => {
    it('should generate 6 character short code', () => {
      const code = invitationsService.generateShortCode('00000001');
      expect(code.length).toBe(6);
    });

    it('should return uppercase', () => {
      const code = invitationsService.generateShortCode('abcdef01');
      expect(code).toBe(code.toUpperCase());
    });

    it('should use last 6 characters', () => {
      const code = invitationsService.generateShortCode('12345678');
      expect(code).toBe('345678');
    });
  });

  describe('formatInvitationMessage', () => {
    it('should include tanda name', () => {
      const message = invitationsService.formatInvitationMessage(
        'Vacation Fund',
        100,
        'https://example.com'
      );
      expect(message).toContain('Vacation Fund');
    });

    it('should include amount', () => {
      const message = invitationsService.formatInvitationMessage(
        'Test',
        100.50,
        'https://example.com'
      );
      expect(message).toContain('100.50');
    });

    it('should include link', () => {
      const message = invitationsService.formatInvitationMessage(
        'Test',
        100,
        'https://example.com/join/123'
      );
      expect(message).toContain('https://example.com/join/123');
    });
  });
});
