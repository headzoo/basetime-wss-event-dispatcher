export type Attributes = Record<string, any>;

/**
 * Represents a class which for which attributes may be set.
 */
export interface Attributable {
  setAttributes: (attributes: Attributes) => void;
}
