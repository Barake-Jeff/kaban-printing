export interface PricingConfig {
  bwPerPage: number;
  colorPerPage: number;
  doubleSidedMultiplier: number;
  deliveryFee: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  bwPerPage: 5,
  colorPerPage: 20,
  doubleSidedMultiplier: 1.8,
  deliveryFee: 50,
};

interface SettingModelLike {
  findOne(options: { where: { key: string }; raw?: boolean }): Promise<{ value: string } | null>;
}

/**
 * Reads the admin-configured `pricing` row, falling back to DEFAULT_PRICING when
 * unset or malformed. Shared by JobsService (prices a job at creation time) and
 * AdminService (settings screen) so the two can never drift out of sync.
 */
export async function getPricing(settingModel: SettingModelLike): Promise<PricingConfig> {
  const row = await settingModel.findOne({ where: { key: 'pricing' }, raw: true });
  if (!row) return DEFAULT_PRICING;
  try {
    return { ...DEFAULT_PRICING, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_PRICING;
  }
}
