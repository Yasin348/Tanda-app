/**
 * Price Service
 * Gets XLM price in EUR for gas calculations
 */

interface PriceCache {
  xlmEur: number;
  timestamp: number;
}

// Cache duration: 1 minute for fresh data, 1 hour for stale fallback
const CACHE_DURATION_MS = 1 * 60 * 1000;
const STALE_CACHE_DURATION_MS = 60 * 60 * 1000;

// Fallback price (updated Dec 2024) - only used if ALL APIs fail AND no cache
const DEFAULT_XLM_EUR = 0.40;

class PriceService {
  private cache: PriceCache | null = null;
  private lastSource: string = 'none';

  /**
   * Get XLM price in EUR
   */
  async getXlmPriceInEur(): Promise<number> {
    // Check fresh cache
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_DURATION_MS) {
      return this.cache.xlmEur;
    }

    // Try Binance API first (more accurate spot price)
    const binancePrice = await this.fetchFromBinance();
    if (binancePrice) {
      return binancePrice;
    }

    // Try CoinGecko as fallback
    const coingeckoPrice = await this.fetchFromCoinGecko();
    if (coingeckoPrice) {
      return coingeckoPrice;
    }

    // Use stale cache if available (up to 1 hour old)
    if (this.cache && Date.now() - this.cache.timestamp < STALE_CACHE_DURATION_MS) {
      console.warn(`[Price] Using stale cache (${Math.round((Date.now() - this.cache.timestamp) / 60000)}min old)`);
      return this.cache.xlmEur;
    }

    // Last resort: default value
    console.error('[Price] All APIs failed and no cache, using default €' + DEFAULT_XLM_EUR);
    return DEFAULT_XLM_EUR;
  }

  /**
   * Fetch from CoinGecko
   */
  private async fetchFromCoinGecko(): Promise<number | null> {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=eur',
        { signal: AbortSignal.timeout(5000) }
      );

      if (response.ok) {
        const data = await response.json() as { stellar?: { eur?: number } };
        const price = data.stellar?.eur;

        if (price && typeof price === 'number' && price > 0) {
          this.cache = { xlmEur: price, timestamp: Date.now() };
          this.lastSource = 'CoinGecko';
          console.log(`[Price] CoinGecko: XLM = €${price.toFixed(4)}`);
          return price;
        }
      }
    } catch (error) {
      console.warn('[Price] CoinGecko failed');
    }
    return null;
  }

  /**
   * Fetch from Binance (XLM/EUR)
   */
  private async fetchFromBinance(): Promise<number | null> {
    try {
      const response = await fetch(
        'https://api.binance.com/api/v3/ticker/price?symbol=XLMEUR',
        { signal: AbortSignal.timeout(5000) }
      );

      if (response.ok) {
        const data = await response.json() as { price?: string };
        const price = parseFloat(data.price || '0');

        if (price > 0) {
          this.cache = { xlmEur: price, timestamp: Date.now() };
          this.lastSource = 'Binance';
          console.log(`[Price] Binance: XLM = €${price.toFixed(4)}`);
          return price;
        }
      }
    } catch (error) {
      console.warn('[Price] Binance failed');
    }
    return null;
  }

  /**
   * Convert EUR to XLM
   */
  async eurToXlm(eurAmount: number): Promise<number> {
    const xlmPrice = await this.getXlmPriceInEur();
    return eurAmount / xlmPrice;
  }

  /**
   * Convert XLM to EUR
   */
  async xlmToEur(xlmAmount: number): Promise<number> {
    const xlmPrice = await this.getXlmPriceInEur();
    return xlmAmount * xlmPrice;
  }

  /**
   * Get price info for display
   */
  async getPriceInfo(): Promise<{
    xlmPriceEur: number;
    isCached: boolean;
    cacheAge: number;
    source: string;
  }> {
    const xlmPriceEur = await this.getXlmPriceInEur();
    const isCached = this.cache !== null;
    const cacheAge = this.cache ? Date.now() - this.cache.timestamp : 0;

    return {
      xlmPriceEur,
      isCached,
      cacheAge,
      source: this.lastSource,
    };
  }

  /**
   * Force refresh price (bypass cache)
   */
  async forceRefresh(): Promise<number> {
    this.cache = null;
    return this.getXlmPriceInEur();
  }
}

export const priceService = new PriceService();
