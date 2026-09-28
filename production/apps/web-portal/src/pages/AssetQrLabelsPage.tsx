import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOEditorFooter, INNOPage, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOTableWrap, INNOToolbarSpacer } from '@inno/ui';
import { createAssetQrLabel, getAssets } from '../api/client';
import type { AssetListItem, AssetQrLabel } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';

type LabelSize = '50x30' | '40x25' | '60x40';

const labelSizes: Record<LabelSize, { label: string; width: number; height: number }> = {
  '50x30': { label: '50 × 30 mm', width: 50, height: 30 },
  '40x25': { label: '40 × 25 mm', width: 40, height: 25 },
  '60x40': { label: '60 × 40 mm', width: 60, height: 40 },
};

function QrImage({ value, assetTag }: { value: string; assetTag: string }) {
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
    : <div className="asset-qr-code-placeholder" aria-label={'Preparing QR code for ' + assetTag} />;
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
  const dimensions = labelSizes[size];
  return (
    <article
      className="asset-qr-print-label"
      style={{ '--qr-label-width': dimensions.width + 'mm', '--qr-label-height': dimensions.height + 'mm' } as React.CSSProperties}
    >
      <QrImage value={label.qrValue} assetTag={label.assetTag} />
      <div className="asset-qr-label-copy">
        {showCompany ? <strong>INNO.One Asset</strong> : null}
        {showAssetTag ? <b>{label.assetTag}</b> : null}
        {showModel ? <span>{label.brandModel || label.assetName}</span> : null}
        {showSerial && label.serialNumber ? <small>{label.serialNumber}</small> : null}
        <em>Secure QR</em>
      </div>
    </article>
  );
}

export function AssetQrLabelsPage() {
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
      eyebrow="Assets · Management"
      title="QR Labels"
      description="Select assets, define the physical label, generate secure opaque QR values and print."
    >

      <div className="qr-flow-strip" aria-label="QR label workflow">
        {[
          ['1', 'Select assets', 'Choose labels to generate'],
          ['2', 'Label setup', 'Size, copies and content'],
          ['3', 'Preview', 'Verify generated labels'],
          ['4', 'Print', 'Attach to equipment'],
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
          title="1 · Select assets"
          description="Choose equipment that needs a physical QR label."
          meta={<INNOStatus>{selected.size} selected</INNOStatus>}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search assets for QR labels" value={search} onChange={setSearch} placeholder="Search asset tag, name, serial, model…" />
          <INNOSelectField label="Category filter" value={category} onChange={setCategory}>
            <option value="all">Category: All</option>
            <option>Computer</option>
            <option>Notebook</option>
            <option>Monitor</option>
            <option>Printer</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOButton variant="secondary" disabled={assets.length === 0} onClick={toggleAllVisible}>
            {assets.length > 0 && assets.every((asset) => selected.has(asset.id)) ? 'Clear visible' : 'Select visible'}
          </INNOButton>
        </INNOCollectionToolbar>
        {assetsQuery.isPending ? (
          <div className="collection-state"><LoadingState label="Loading assets…" /></div>
        ) : assetsQuery.isError ? (
          <div className="collection-state"><ErrorState error={assetsQuery.error} retry={() => void assetsQuery.refetch()} /></div>
        ) : assets.length === 0 ? (
          <div className="collection-state">
            <INNOState
              title="No assets found"
              description="Try another search or clear the category filter."
              action={<INNOButton variant="secondary" onClick={() => { setSearch(''); setCategory('all'); }}>Clear filters</INNOButton>}
            />
          </div>
        ) : (
          <INNOTableWrap width="xwide">
            <table className="qr-asset-table">
              <thead>
                <tr>
                  <th className="select-column"><span className="sr-only">Select</span></th>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Brand / Model</th>
                  <th>Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="select-column">
                      <input
                        type="checkbox"
                        checked={selected.has(asset.id)}
                        aria-label={'Select ' + asset.assetTag}
                        onChange={() => toggleAsset(asset.id)}
                      />
                    </td>
                    <td><b>{asset.assetTag}</b><div className="table-meta">{asset.serialNumber ?? asset.name}</div></td>
                    <td>{asset.category}</td>
                    <td>{asset.brandModel || '—'}</td>
                    <td>{asset.owner ?? 'Unassigned'}</td>
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
          <div><h3>2 · Label setup</h3><p>These settings affect the printed label only. They are never embedded in the QR token.</p></div>
        </div>
        <div className="editor-form">
          <div className="editor-grid">
            <label className="field-block">
              <span>Label size</span>
              <select value={labelSize} onChange={(event) => setLabelSize(event.target.value as LabelSize)}>
                {Object.entries(labelSizes).map(([value, size]) => <option key={value} value={value}>{size.label}</option>)}
              </select>
            </label>
            <label className="field-block">
              <span>Copies per asset</span>
              <select value={copies} onChange={(event) => setCopies(Number(event.target.value))}>
                <option value={1}>1 copy</option>
                <option value={2}>2 copies</option>
                <option value={3}>3 copies</option>
              </select>
            </label>
          </div>
          <fieldset className="qr-content-options">
            <legend>Visible label content</legend>
            <label className="check-row"><input type="checkbox" checked={showAssetTag} onChange={(event) => setShowAssetTag(event.target.checked)} /><span>Asset No.</span></label>
            <label className="check-row"><input type="checkbox" checked={showModel} onChange={(event) => setShowModel(event.target.checked)} /><span>Model</span></label>
            <label className="check-row"><input type="checkbox" checked={showSerial} onChange={(event) => setShowSerial(event.target.checked)} /><span>Serial No.</span></label>
            <label className="check-row"><input type="checkbox" checked={showCompany} onChange={(event) => setShowCompany(event.target.checked)} /><span>Company name</span></label>
          </fieldset>
        </div>
      </section>
      <section className="prod-panel qr-preview-section">
        <div className="prod-panel-head">
          <div>
            <h3>3 · Print preview</h3>
            <p>Generated QR codes contain only a secure opaque token. Asset data is loaded after authenticated lookup.</p>
          </div>
          <INNOStatus tone={generatedForSelection.length > 0 ? 'success' : 'neutral'}>{generatedForSelection.length} ready</INNOStatus>
        </div>

        {generatedForSelection.length === 0 ? (
          <div className="compact-empty qr-preview-empty">
            Select assets, then generate the secure preview.
          </div>
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
          <div><b>Opaque token</b><span>No owner, serial or mutable Asset JSON is encoded in the QR value.</span></div>
          <div><b>Authenticated lookup</b><span>The scanner must sign in and pass Assets scope checks before data is returned.</span></div>
          <div><b>Audited scan</b><span>Successful resolutions create restricted scan history and audit records.</span></div>
        </div>
      </section>

      <INNOEditorFooter className="standalone-editor-footer qr-action-footer">
        <span className="editor-footer-note">
          Regenerating replaces each selected Asset’s previous active QR label.
        </span>
        <INNOButton
          variant="secondary"
          busy={generateMutation.isPending}
          disabled={selected.size === 0}
          onClick={() => generateMutation.mutate()}
        >
          {generatedForSelection.length > 0 ? 'Regenerate Preview' : 'Generate Preview'}
        </INNOButton>
        <INNOButton disabled={!canPrint || generateMutation.isPending} onClick={() => window.print()}>
          Print Selected
        </INNOButton>
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
