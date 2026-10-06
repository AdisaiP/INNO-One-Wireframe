import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOPage, INNOPagination, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { getRemoteConsentHistory } from '../api/client';
import { useI18n } from '@inno/i18n';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useState } from 'react';

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function RemoteConsentPage() {
  const { locale } = useI18n();
  const th = locale === 'th-TH';
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['devices', 'remote-consent-history', page],
    queryFn: () => getRemoteConsentHistory(page, 25),
    refetchInterval: 5000,
  });

  return (
    <INNOPage
      eyebrow="Devices · Remote"
      title="Remote Consent"
      description={th ? 'ตรวจสอบประวัติ Remote Access และรายการ Consent เดิม' : 'Review remote-access audit markers and legacy consent records.'}
    >
      <INNOState
        banner
        kind="partial"
        title={th ? 'Remote Session ใหม่ไม่ต้องรอ Consent' : 'New remote sessions do not require endpoint consent'}
        description={th
          ? 'INNO.One เริ่ม Remote หลังตรวจ permission, scope, online state และ MeshCentral mapping แล้วทันที หน้านี้เก็บรายการเดิมและ not_required เพื่อ Audit'
          : 'INNO.One starts remote access immediately after permission, scope, online-state, and MeshCentral-mapping checks. This page retains legacy and not_required audit records.'}
      />

      {query.isPending ? (
        <LoadingState label={th ? 'กำลังโหลดประวัติ Consent…' : 'Loading consent history…'} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <INNOCollectionState
          kind="empty"
          title={th ? 'ยังไม่มีคำขอ Consent' : 'No consent requests yet'}
          description={th ? 'คำขอจะปรากฏเมื่อเจ้าหน้าที่เริ่ม Remote Session' : 'Requests appear when an operator starts a remote session.'}
        />
      ) : (
        <INNOCollection>
          <INNOCollectionHeader
            title={th ? 'Consent History' : 'Consent History'}
            description={th ? 'Audit-facing history ของการขออนุญาต Remote' : 'Audit-facing remote consent history.'}
          />
          <INNOTableWrap width="wide">
            <table>
              <thead>
                <tr>
                  <th>{th ? 'อุปกรณ์' : 'Device'}</th>
                  <th>{th ? 'ผู้ดำเนินการ' : 'Operator'}</th>
                  <th>{th ? 'โหมด' : 'Mode'}</th>
                  <th>{th ? 'สถานะ' : 'Status'}</th>
                  <th>{th ? 'ขอเมื่อ' : 'Requested'}</th>
                  <th>{th ? 'ตัดสินใจเมื่อ' : 'Decided'}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td><Link to={'/devices/' + item.deviceId}><b>{item.deviceName}</b></Link></td>
                    <td>{item.operatorName}<div className="table-meta">{item.operatorRole ?? '—'}</div></td>
                    <td>{item.mode === 'view_only' ? 'View only' : 'Control'}</td>
                    <td><INNOStatus tone={item.status === 'approved' ? 'success' : item.status === 'pending' ? 'warning' : item.status === 'declined' || item.status === 'expired' ? 'danger' : 'neutral'}>{item.status}</INNOStatus></td>
                    <td>{formatDate(item.requestedAt, locale)}</td>
                    <td>{formatDate(item.decidedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
          <INNOPagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalItems={query.data.totalItems}
            pageSize={query.data.pageSize}
            onPageChange={setPage}
          />
        </INNOCollection>
      )}
    </INNOPage>
  );
}
