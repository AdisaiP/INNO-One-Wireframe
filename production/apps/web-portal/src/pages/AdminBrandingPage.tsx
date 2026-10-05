import { useEffect, useState } from 'react';
import {
  INNOCollection,
  INNOCollectionHeader,
  INNOPage,
  INNOStatus,
} from '@inno/ui';
import {
  BRAND_FONT_TOKEN,
  BRAND_TOKEN_DEFINITIONS,
  PRODUCT_BRAND,
  readBrandCssVariable,
} from '../app/branding';
import { useI18n as useStep45NI18n } from '@inno/i18n';

type EffectiveToken = {
  id: string;
  label: string;
  cssVariable: string;
  value: string;
};

export function AdminBrandingPage() {
  const { t: t45n } = useStep45NI18n();
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
      eyebrow={t45n('admin.settings.eyebrow')}
      title={t45n('navigation.branding')}
      description={t45n('admin.step45n.adminBranding.inspectTheEffectiveInnoOneProductIdentityAnd')}
    >
      <div className="branding-foundation-layout">
        <INNOCollection>
          <INNOCollectionHeader
            title={t45n('admin.step45n.adminBranding.effectiveProductIdentity')}
            description={t45n('admin.step45n.adminBranding.theseValuesNowDriveTheProductionShellInstead')}
            meta={<INNOStatus tone="success" dot>{t45n('reports.status.active')}</INNOStatus>}
          />

          <div className="branding-preview-stage">
            <div className="branding-shell-preview" aria-label={t45n('admin.step45n.adminBranding.currentInnoOneHeaderBrandPreview')}>
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
              <dt>{t45n('admin.step45n.adminBranding.productName')}</dt>
              <dd>{PRODUCT_BRAND.productName}</dd>
            </div>
            <div>
              <dt>{t45n('admin.step45n.adminBranding.compactMark')}</dt>
              <dd>{PRODUCT_BRAND.compactMark}</dd>
            </div>
            <div>
              <dt>{t45n('admin.step45n.adminBranding.browserTitle')}</dt>
              <dd>{PRODUCT_BRAND.browserTitle}</dd>
            </div>
            <div>
              <dt>{t45n('admin.step45n.adminBranding.brandScope')}</dt>
              <dd>{t45n('admin.step45n.adminBranding.globalWebPortalShell')}</dd>
            </div>
          </dl>
        </INNOCollection>

        <INNOCollection>
          <INNOCollectionHeader
            title={t45n('admin.step45n.adminBranding.frozenBrandTokens')}
            description={t45n('admin.step45n.adminBranding.valuesAreReadFromTheEffectiveCssCustom')}
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
                  <span>{token.value || t45n('admin.step45n.adminBranding.unavailable')}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="branding-font-row">
            <b>{BRAND_FONT_TOKEN.label}</b>
            <code>{BRAND_FONT_TOKEN.cssVariable}</code>
            <span>{fontValue || t45n('admin.step45n.adminBranding.unavailable')}</span>
          </div>
        </INNOCollection>
      </div>

    </INNOPage>
  );
}
