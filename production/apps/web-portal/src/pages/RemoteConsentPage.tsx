import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOIcon, INNOPagination, INNOResourceHeader, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
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
    <main className="inno-page">
      <INNOResourceHeader
        icon={<INNOIcon token="section.security" size={20} />}
        title={th ? 'Remote Consent' : 'Remote Consent'}
        meta={<span>{th ? 'ตรวจสอบคำขอความยินยอมสำหรับ Remote Session' : 'Review consent requests associated with remote sessions.'}</span>}
      />
      <INNOState
        banner
        kind="partial"
        title={th ? 'Endpoint Agent เป็นจุดรับ Consent จริง' : 'Endpoint Agent is the real consent surface'}
        description={th
          ? 'Web Portal แสดงสถานะและประวัติเท่านั้น การอนุมัติหรือปฏิเสธเกิดบนเครื่องผู้ใช้ก่อน MeshCentral share ถูกสร้าง'
          : 'The Web Portal shows status and history only. Approval or decline happens on the user endpoint before any MeshCentral share is created.'}
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
    </main>
  );
}
