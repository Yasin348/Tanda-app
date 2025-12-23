/**
 * KYCGate Component - Simplified for Mykobo Integration
 *
 * All KYC verification is handled by Mykobo during deposit/withdrawal flow.
 * This component now just passes through children since KYC is no longer
 * a separate requirement checked at the app level.
 *
 * Previously this blocked access until KYC was completed separately.
 * Now we let users through and Mykobo handles KYC during their first deposit.
 */

import React from 'react';

interface KYCGateProps {
  children: React.ReactNode;
  onKYCRequired?: () => void;
}

/**
 * KYCGate - Now just a pass-through component
 *
 * Mykobo handles all KYC during the deposit flow, so we don't need
 * to block users at the app level anymore.
 */
export const KYCGate: React.FC<KYCGateProps> = ({ children }) => {
  // Simply render children - KYC is handled by Mykobo during deposit
  return <>{children}</>;
};
