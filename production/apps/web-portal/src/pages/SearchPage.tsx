import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionToolbar,
  INNOPage,
  INNOSearchField,
  INNOState,
  INNOStatus,
  INNOToolbarSpacer,
} from '@inno/ui';
import { getGlobalSearch } from '../api/client';
import type { GlobalSearchResult } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function typeLabel(type: string) {
  if (type === 'device') return 'Device';
  if (type === 'asset') return 'Asset';
  if (type === 'ticket') return 'Ticket';
  return type;
}

function typeMark(type: string) {
  if (type === 'device') return 'D';
  if (type === 'asset') return 'A';
  if (type === 'ticket') return 'H';
  return 'R';
}

function typeTone(type: string): 'neutral' | 'success' | 'warning' {
  if (type === 'asset') return 'success';
  if (type === 'ticket') return 'warning';
  return 'neutral';
}

export function SearchPage() {
  const { t: t45n } = useStep45NI18n();
  const [params, setParams] = useSearchParams();
  const queryText = (params.get('q') ?? '').trim();
  const [draft, setDraft] = useState(queryText);

  useEffect(() => {
    setDraft(queryText);
  }, [queryText]);

  const query = useQuery({
    queryKey: ['platform', 'search', queryText],
    queryFn: () => getGlobalSearch(queryText),
    enabled: queryText.length > 0,
    refetchOnWindowFocus: false,
  });

  const counts = useMemo(() => {
    const next = new Map<string, number>();
    for (const item of query.data?.items ?? []) {
      next.set(item.type, (next.get(item.type) ?? 0) + 1);
    }
    return next;
  }, [query.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) {
      setParams({});
      return;
    }
    setParams({ q: value });
  }

  return (
    <INNOPage
      eyebrow={t45n('navigation.workspace')}
      title={t45n('navigation.search')}
      description={t45n('common.step45n.search.searchAuthorizedResourcesAcrossEnabledInnoOneModules')}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('common.step45n.search.globalSearch')}
          description={t45n('common.step45n.search.resultsAreFilteredByEachDestinationModuleBefore')}
          meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('devices.step45n.discovery.results')}</INNOStatus> : null}
        />
        <form onSubmit={submit}>
          <INNOCollectionToolbar>
            <INNOSearchField
              label={t45n('navigation.searchAria')}
              value={draft}
              onChange={setDraft}
              placeholder={t45n('navigation.searchPlaceholder')}
            />
            <INNOToolbarSpacer />
            <INNOButton type="submit">{t45n('navigation.search')}</INNOButton>
          </INNOCollectionToolbar>
        </form>

        {!queryText ? (
          <INNOState
            title={t45n('common.step45n.search.searchAcrossYourWorkspace')}
            description={t45n('common.step45n.search.enterADeviceNameAssetTagSerialNumber')}
          />
        ) : null}

        {query.isPending && queryText ? <LoadingState label={t45n('common.step45n.search.searchingInnoOne')} /> : null}
        {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

        {query.data && query.data.items.length === 0 ? (
          <INNOState
            title={t45n('common.step45n.search.noResults')}
            description={t45n('common.step45n.search.noAuthorizedResourcesMatched', { query: query.data.query })}
          />
        ) : null}

        {query.data && query.data.items.length > 0 ? (
          <div className="global-search-results" aria-label={t45n('common.step45n.search.globalSearchResults')}>
            <div className="global-search-summary" aria-label={t45n('common.step45n.search.resultSummary')}>
              {['device', 'asset', 'ticket'].map((type) => (
                <span key={type}>
                  <b>{counts.get(type) ?? 0}</b>
                  {typeLabel(type)}
                </span>
              ))}
            </div>

            {query.data.items.map((item: GlobalSearchResult) => (
              <Link className="global-search-result" to={item.route} key={item.type + ':' + item.id}>
                <span className={'global-search-mark type-' + item.type} aria-hidden="true">
                  {typeMark(item.type)}
                </span>
                <span className="global-search-result-copy">
                  <b>{item.title}</b>
                  <span>{item.subtitle}</span>
                </span>
                <INNOStatus tone={typeTone(item.type)}>{typeLabel(item.type)}</INNOStatus>
                <span className="global-search-open" aria-hidden="true">{t45n('common.step45n.search.open')}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </INNOCollection>

    </INNOPage>
  );
}
