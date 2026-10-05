import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterNote, INNOEditorFooterStart, INNOPage, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOTableWrap, INNOToolbarSpacer } from '@inno/ui';
import { createAssetQrLabel, getAssets } from '../api/client';
import type { AssetListItem, AssetQrLabel } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

type LabelSize = '50x30' | '40x25' | '60x40';

const labelSizes: Record<LabelSize, { labelKey: string; width: number; height: number }> = {
  '50x30': { labelKey: 'assets.step45n.assetQrLabels.n5030Mm', width: 50, height: 30 },
  '40x25': { labelKey: 'assets.step45n.assetQrLabels.n4025Mm', width: 40, height: 25 },
  '60x40': { labelKey: 'assets.step45n.assetQrLabels.n6040Mm', width: 60, height: 40 },
};

function QrImage({ value, assetTag }: { value: string; assetTag: string }) {
  const { t: t45n } = useStep45NI18n();
  const [source, setSource] = useState('');

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    }).then((url) => {
      if (active) setSource(url);
    });
    return () => { active = false; };
  }, [value]);

  return source
    ? <img className="asset-qr-code" src={source} alt={'QR code for ' + assetTag} />
    : <div className="asset-qr-code-placeholder" aria-label={t45n('assets.step45n.assetQrLabels.preparingQrCodeFor') + ' ' + assetTag} />;
}

function PrintLabel({
  label,
  size,
  showAssetTag,
  showModel,
  showSerial,
  showCompany,
}: {
  label: AssetQrLabel;
  size: LabelSize;
  showAssetTag: boolean;
  showModel: boolean;
  showSerial: boolean;
  showCompany: boolean;
}) {
  const { t: t45n } = useStep45NI18n();
  const dimensions = labelSizes[size];
  return (
    <article
      className="asset-qr-print-label"
      style={{ '--qr-label-width': dimensions.width + 'mm', '--qr-label-height': dimensions.height + 'mm' } as React.CSSProperties}
    >
      <QrImage value={label.qrValue} assetTag={label.assetTag} />
      <div className="asset-qr-label-copy">
        {showCompany ? <strong>{t45n('assets.step45n.assetQrLabels.innoOneAsset')}</strong> : null}
        {showAssetTag ? <b>{label.assetTag}</b> : null}
        {showModel ? <span>{label.brandModel || label.assetName}</span> : null}
        {showSerial && label.serialNumber ? <small>{label.serialNumber}</small> : null}
        <em>{t45n('assets.step45n.assetQrLabels.secureQr')}</em>
      </div>
    </article>
  );
}

export function AssetQrLabelsPage() {
  const { t: t45n } = useStep45NI18n();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [labelSize, setLabelSize] = useState<LabelSize>('50x30');
  const [copies, setCopies] = useState(1);
  const [showAssetTag, setShowAssetTag] = useState(true);
  const [showModel, setShowModel] = useState(true);
  const [showSerial, setShowSerial] = useState(true);
  const [showCompany, setShowCompany] = useState(true);
  const [labels, setLabels] = useState<Record<string, AssetQrLabel>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const assetsQuery = useQuery({
    queryKey: ['assets', 'qr-labels', deferredSearch, category],
    queryFn: () => getAssets({
      page: 1,
      pageSize: 100,
      search: deferredSearch,
      category,
    }),
  });

  const assets = assetsQuery.data?.items ?? [];
  const assetById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  );
  const selectedAssets = useMemo(
    () => [...selected].map((id) => assetById.get(id)).filter((asset): asset is AssetListItem => Boolean(asset)),
    [assetById, selected],
  );
  const generatedForSelection = selectedAssets.filter((asset) => labels[asset.id]);
  const canPrint = selectedAssets.length > 0
    && generatedForSelection.length === selectedAssets.length;
  const generateMutation = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      if (ids.length === 0) return { success: [] as AssetQrLabel[], failed: 0 };
      const results = await Promise.allSettled(ids.map((id) => createAssetQrLabel(id)));
      return {
        success: results
          .filter((result): result is PromiseFulfilledResult<AssetQrLabel> => result.status === 'fulfilled')
          .map((result) => result.value),
        failed: results.filter((result) => result.status === 'rejected').length,
      };
    },
    onSuccess: ({ success, failed }) => {
      setLabels((current) => {
        const next = { ...current };
        success.forEach((label) => { next[label.assetId] = label; });
        return next;
      });
      if (failed > 0) {
        setMessage('');
        setError(success.length
          ? success.length + ' labels generated; ' + failed + ' failed. Retry to regenerate the current selection.'
          : 'QR label generation failed. Try again.');
      } else {
        setError('');
        setMessage(success.length + ' secure QR labels generated. Previous active labels were revoked.');
      }
    },
    onError: (mutationError: Error) => {
      setMessage('');
      setError(mutationError.message);
    },
  });

  function toggleAsset(id: string) {
    setMessage('');
    setError('');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const ids = assets.map((asset) => asset.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  const printLabels = selectedAssets.flatMap((asset) => {
    const label = labels[asset.id];
    if (!label) return [];
    return Array.from({ length: copies }, (_, index) => ({
      key: label.id + ':' + index,
      label,
    }));
  });

  return (
    <INNOPage
      eyebrow={t45n('assets.step45n.assetCustomFields.assetsManagement')}
      title={t45n('navigation.qrLabels')}
      description={t45n('assets.step45n.assetQrLabels.selectAssetsDefineThePhysicalLabelGenerateSecure')}
    >

      <div className="qr-flow-strip" aria-label={t45n('assets.step45n.assetQrLabels.qrLabelWorkflow')}>
        {[
          ['1', t45n('assets.step45n.assetQrLabels.flow.selectTitle'), t45n('assets.step45n.assetQrLabels.flow.selectDescription')],
          ['2', t45n('assets.step45n.assetQrLabels.flow.setupTitle'), t45n('assets.step45n.assetQrLabels.flow.setupDescription')],
          ['3', t45n('assets.step45n.assetQrLabels.flow.previewTitle'), t45n('assets.step45n.assetQrLabels.flow.previewDescription')],
          ['4', t45n('assets.step45n.assetQrLabels.flow.printTitle'), t45n('assets.step45n.assetQrLabels.flow.printDescription')],
        ].map(([step, title, description]) => (
          <div key={step}>
            <span>{step}</span>
            <b>{title}</b>
            <small>{description}</small>
          </div>
        ))}
      </div>

      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {message ? <div className="form-success" role="status">{message}</div> : null}

      <INNOCollection className="qr-select-section">
        <INNOCollectionHeader
          title={t45n('assets.step45n.assetQrLabels.n1SelectAssets')}
          description={t45n('assets.step45n.assetQrLabels.chooseEquipmentThatNeedsAPhysicalQrLabel')}
          meta={<INNOStatus>{selected.size} {t45n('assets.step45n.assetQrLabels.selected')}</INNOStatus>}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('assets.step45n.assetQrLabels.searchAssetsForQrLabels')} value={search} onChange={setSearch} placeholder={t45n('assets.step45n.assetQrLabels.searchAssetTagNameSerialModel')} />
          <INNOSelectField label={t45n('assets.step45n.assetInventory.categoryFilter')} value={category} onChange={setCategory}>
            <option value="all">{t45n('assets.step45n.assetInventory.categoryAll')}</option>
            <option>{t45n('assets.step45n.assetEdit.computer')}</option>
            <option>{t45n('devices.shared.deviceType.notebook')}</option>
            <option>{t45n('assets.step45n.assetEdit.monitor')}</option>
            <option>{t45n('assets.step45n.assetEdit.printer')}</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOButton variant="secondary" disabled={assets.length === 0} onClick={toggleAllVisible}>
            {assets.length > 0 && assets.every((asset) => selected.has(asset.id)) ? t45n('assets.step45n.assetQrLabels.clearVisible') : t45n('assets.step45n.assetQrLabels.selectVisible')}
          </INNOButton>
        </INNOCollectionToolbar>
        {assetsQuery.isPending ? (
          <div className="collection-state"><LoadingState label={t45n('assets.step45n.assetInventory.loadingAssets')} /></div>
        ) : assetsQuery.isError ? (
          <div className="collection-state"><ErrorState error={assetsQuery.error} retry={() => void assetsQuery.refetch()} /></div>
        ) : assets.length === 0 ? (
          <div className="collection-state">
            <INNOState
              title={t45n('assets.step45n.assetInventory.noAssetsFound')}
              description={t45n('assets.step45n.assetQrLabels.tryAnotherSearchOrClearTheCategoryFilter')}
              action={<INNOButton variant="secondary" onClick={() => { setSearch(''); setCategory('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>}
            />
          </div>
        ) : (
          <INNOTableWrap width="xwide">
            <table className="qr-asset-table">
              <thead>
                <tr>
                  <th className="select-column"><span className="sr-only">{t45n('assets.step45n.assetQrLabels.select')}</span></th>
                  <th>{t45n('reports.column.name')}</th>
                  <th>{t45n('reports.column.category')}</th>
                  <th>{t45n('assets.step45n.assetInventory.brandModel')}</th>
                  <th>{t45n('reports.column.owner')}</th>
                  <th>{t45n('reports.runs.status')}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="select-column">
                      <input
                        type="checkbox"
                        checked={selected.has(asset.id)}
                        aria-label={t45n('assets.step45n.assetQrLabels.select') + ' ' + asset.assetTag}
                        onChange={() => toggleAsset(asset.id)}
                      />
                    </td>
                    <td><b>{asset.assetTag}</b><div className="table-meta">{asset.serialNumber ?? asset.name}</div></td>
                    <td>{asset.category}</td>
                    <td>{asset.brandModel || '—'}</td>
                    <td>{asset.owner ?? t45n('assets.automation.editor.owner.unassigned')}</td>
                    <td><INNOStatus>{asset.status.replaceAll('_', ' ')}</INNOStatus></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>

      <section className="prod-panel qr-setup-section">
        <div className="prod-panel-head">
          <div><h3>{t45n('assets.step45n.assetQrLabels.n2LabelSetup')}</h3><p>{t45n('assets.step45n.assetQrLabels.theseSettingsAffectThePrintedLabelOnlyThey')}</p></div>
        </div>
        <div className="editor-form">
          <div className="editor-grid">
            <label className="field-block">
              <span>{t45n('assets.step45n.assetQrLabels.labelSize')}</span>
              <select value={labelSize} onChange={(event) => setLabelSize(event.target.value as LabelSize)}>
                {Object.entries(labelSizes).map(([value, size]) => <option key={value} value={value}>{t45n(size.labelKey)}</option>)}
              </select>
            </label>
            <label className="field-block">
              <span>{t45n('assets.step45n.assetQrLabels.copiesPerAsset')}</span>
              <select value={copies} onChange={(event) => setCopies(Number(event.target.value))}>
                <option value={1}>{t45n('assets.step45n.assetQrLabels.n1Copy')}</option>
                <option value={2}>{t45n('assets.step45n.assetQrLabels.n2Copies')}</option>
                <option value={3}>{t45n('assets.step45n.assetQrLabels.n3Copies')}</option>
              </select>
            </label>
          </div>
          <fieldset className="qr-content-options">
            <legend>{t45n('assets.step45n.assetQrLabels.visibleLabelContent')}</legend>
            <label className="check-row"><input type="checkbox" checked={showAssetTag} onChange={(event) => setShowAssetTag(event.target.checked)} /><span>{t45n('assets.step45n.assetQrLabels.assetNo')}</span></label>
            <label className="check-row"><input type="checkbox" checked={showModel} onChange={(event) => setShowModel(event.target.checked)} /><span>{t45n('reports.column.model')}</span></label>
            <label className="check-row"><input type="checkbox" checked={showSerial} onChange={(event) => setShowSerial(event.target.checked)} /><span>{t45n('assets.step45n.assetQrLabels.serialNo')}</span></label>
            <label className="check-row"><input type="checkbox" checked={showCompany} onChange={(event) => setShowCompany(event.target.checked)} /><span>{t45n('assets.step45n.assetQrLabels.companyName')}</span></label>
          </fieldset>
        </div>
      </section>
      <section className="prod-panel qr-preview-section">
        <div className="prod-panel-head">
          <div>
            <h3>{t45n('assets.step45n.assetQrLabels.n3PrintPreview')}</h3>
            <p>{t45n('assets.step45n.assetQrLabels.generatedQrCodesContainOnlyASecureOpaque')}</p>
          </div>
          <INNOStatus tone={generatedForSelection.length > 0 ? 'success' : 'neutral'}>{generatedForSelection.length} {t45n('assets.step45n.assetQrLabels.ready')}</INNOStatus>
        </div>

        {generatedForSelection.length === 0 ? (
          <div className="compact-empty qr-preview-empty">
            {t45n('assets.step45n.assetQrLabels.selectAssetsThenGenerateTheSecurePreview')}</div>
        ) : (
          <div className="asset-qr-preview-grid">
            {generatedForSelection.map((asset) => (
              <PrintLabel
                key={asset.id}
                label={labels[asset.id]}
                size={labelSize}
                showAssetTag={showAssetTag}
                showModel={showModel}
                showSerial={showSerial}
                showCompany={showCompany}
              />
            ))}
          </div>
        )}

        <div className="qr-security-grid">
          <div><b>{t45n('assets.step45n.assetQrLabels.opaqueToken')}</b><span>{t45n('assets.step45n.assetQrLabels.noOwnerSerialOrMutableAssetJsonIs')}</span></div>
          <div><b>{t45n('assets.step45n.assetQrLabels.authenticatedLookup')}</b><span>{t45n('assets.step45n.assetQrLabels.theScannerMustSignInAndPassAssets')}</span></div>
          <div><b>{t45n('assets.step45n.assetQrLabels.auditedScan')}</b><span>{t45n('assets.step45n.assetQrLabels.successfulResolutionsCreateRestrictedScanHistoryAndAudit')}</span></div>
        </div>
      </section>

      <INNOEditorFooter>
        <INNOEditorFooterStart>
          <INNOEditorFooterNote>
            {t45n('assets.step45n.assetQrLabels.regeneratingReplacesEachSelectedAssetSPreviousActive')}</INNOEditorFooterNote>
        </INNOEditorFooterStart>
        <INNOEditorFooterEnd>
          <INNOButton
            variant="secondary"
            busy={generateMutation.isPending}
            disabled={selected.size === 0}
            onClick={() => generateMutation.mutate()}
          >
            {generatedForSelection.length > 0 ? t45n('assets.step45n.assetQrLabels.regeneratePreview') : t45n('assets.step45n.assetQrLabels.generatePreview')}
          </INNOButton>
          <INNOButton disabled={!canPrint || generateMutation.isPending} onClick={() => window.print()}>
            {t45n('assets.step45n.assetQrLabels.printSelected')}</INNOButton>
        </INNOEditorFooterEnd>
      </INNOEditorFooter>

      <div className="qr-print-area" aria-hidden="true">
        {printLabels.map(({ key, label }) => (
          <PrintLabel
            key={key}
            label={label}
            size={labelSize}
            showAssetTag={showAssetTag}
            showModel={showModel}
            showSerial={showSerial}
            showCompany={showCompany}
          />
        ))}
      </div>
    </INNOPage>
  );
}
