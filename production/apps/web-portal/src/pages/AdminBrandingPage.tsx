import { useEffect, useState } from 'react';
import {
  INNOCollection,
  INNOCollectionHeader,
  INNOPage,
  INNOPurposeNote,
  INNOStatus,
} from '@inno/ui';
import {
  BRAND_FONT_TOKEN,
  BRAND_TOKEN_DEFINITIONS,
  PRODUCT_BRAND,
  readBrandCssVariable,
} from '../app/branding';

type EffectiveToken = {
  id: string;
  label: string;
  cssVariable: string;
  value: string;
};

export function AdminBrandingPage() {
  const [tokens, setTokens] = useState<EffectiveToken[]>([]);
  const [fontValue, setFontValue] = useState('');

  useEffect(() => {
    setTokens(BRAND_TOKEN_DEFINITIONS.map((token) => ({
      ...token,
      value: readBrandCssVariable(token.cssVariable),
    })));
    setFontValue(readBrandCssVariable(BRAND_FONT_TOKEN.cssVariable));
  }, []);

  return (
    <INNOPage
      eyebrow="Admin Center · Platform"
      title="Branding"
      description="Inspect the effective INNO.One product identity and frozen design-system brand tokens from one source of truth."
    >
      <INNOPurposeNote
        title="Brand customization is not editable yet"
        description="The current contracts reserve admin.branding.manage but do not define a persisted branding resource, logo upload contract, color override model, or audited update API. This page therefore previews only the effective product brand already used by the Web Portal."
      />

      <div className="branding-foundation-layout">
        <INNOCollection>
          <INNOCollectionHeader
            title="Effective Product Identity"
            description="These values now drive the production shell instead of being duplicated inside navigation markup."
            meta={<INNOStatus tone="success" dot>Active</INNOStatus>}
          />

          <div className="branding-preview-stage">
            <div className="branding-shell-preview" aria-label="Current INNO.One header brand preview">
              <span className="prod-logo-mark branding-preview-mark">
                {PRODUCT_BRAND.compactMark}
              </span>
              <span className="prod-brand-name branding-preview-name">
                {PRODUCT_BRAND.productNamePrefix}
                <b>{PRODUCT_BRAND.productNameEmphasis}</b>
              </span>
            </div>
          </div>

          <dl className="branding-fact-list">
            <div>
              <dt>Product name</dt>
              <dd>{PRODUCT_BRAND.productName}</dd>
            </div>
            <div>
              <dt>Compact mark</dt>
              <dd>{PRODUCT_BRAND.compactMark}</dd>
            </div>
            <div>
              <dt>Browser title</dt>
              <dd>{PRODUCT_BRAND.browserTitle}</dd>
            </div>
            <div>
              <dt>Brand scope</dt>
              <dd>Global Web Portal shell</dd>
            </div>
          </dl>
        </INNOCollection>

        <INNOCollection>
          <INNOCollectionHeader
            title="Frozen Brand Tokens"
            description="Values are read from the effective CSS custom properties in Design System V1.26."
          />

          <div className="branding-token-grid">
            {tokens.map((token) => (
              <div className="branding-token-card" key={token.id}>
                <span
                  className="branding-token-swatch"
                  style={{ background: 'var(' + token.cssVariable + ')' }}
                  aria-hidden="true"
                />
                <div>
                  <b>{token.label}</b>
                  <code>{token.cssVariable}</code>
                  <span>{token.value || 'Unavailable'}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="branding-font-row">
            <b>{BRAND_FONT_TOKEN.label}</b>
            <code>{BRAND_FONT_TOKEN.cssVariable}</code>
            <span>{fontValue || 'Unavailable'}</span>
          </div>
        </INNOCollection>
      </div>

      <INNOPurposeNote
        title="Future customization boundary"
        description="Before logo upload, product-name overrides, organization colors, or login-page branding become editable, define the branding resource schema, allowed asset formats, token constraints, ETag concurrency behavior, and privileged audit events."
      />
    </INNOPage>
  );
}
