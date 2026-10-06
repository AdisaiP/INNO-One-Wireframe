import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOPage, INNOPagination, INNOStatus, INNOTableWrap } from '@inno/ui';
import { disconnectRemoteSession, getRemoteSessions } from '../api/client';
import { useI18n } from '@inno/i18n';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { RemoteSession } from '../api/types';
import { useState } from 'react';

function statusTone(status: RemoteSession['status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'failed' || status === 'declined' || status === 'expired') return 'danger' as const;
  if (status === 'awaiting_consent' || status === 'launching') return 'warning' as const;
  return 'neutral' as const;
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function RemoteOperationsPage() {
  const { locale } = useI18n();
  const th = locale === 'th-TH';
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['devices', 'remote-sessions', page],
    queryFn: () => getRemoteSessions(page, 25),
    refetchInterval: (state) => state.state.data?.items.some((item) =>
      item.status === 'launching') ? 2000 : false,
  });
  const disconnect = useMutation({
    mutationFn: (sessionId: string) => disconnectRemoteSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices', 'remote-sessions'] });
    },
  });

  return (
    <INNOPage
      eyebrow="Devices · Remote"
      title="Remote Operations"
      description={th ? 'การเชื่อมต่อระยะไกลแบบไม่ต้องรอ Consent โดยยังบังคับสิทธิ์ ขอบเขต และ Audit' : 'Unattended remote sessions with INNO.One permission, scope, and audit enforcement.'}
      actions={<Link to="/devices"><INNOButton variant="primary">{th ? 'เลือกอุปกรณ์เพื่อเริ่ม Remote' : 'Choose device to start remote'}</INNOButton></Link>}
    >
      {query.isPending ? (
        <LoadingState label={th ? 'กำลังโหลด Remote Sessions…' : 'Loading remote sessions…'} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <INNOCollectionState
          kind="empty"
          title={th ? 'ยังไม่มี Remote Session' : 'No remote sessions yet'}
          description={th ? 'เปิดอุปกรณ์ที่ต้องการ แล้วกด Start Remote Session' : 'Open a device and choose Start Remote Session.'}
        />
      ) : (
        <INNOCollection>
          <INNOCollectionHeader
            title={th ? 'Remote Sessions' : 'Remote Sessions'}
            description={th ? 'ประวัติและสถานะการเชื่อมต่อระยะไกล' : 'Remote connection status and history.'}
          />
          <INNOTableWrap width="wide">
            <table>
              <thead>
                <tr>
                  <th>{th ? 'อุปกรณ์' : 'Device'}</th>
                  <th>{th ? 'ผู้ดำเนินการ' : 'Operator'}</th>
                  <th>{th ? 'โหมด' : 'Mode'}</th>
                  <th>{th ? 'สถานะ' : 'Status'}</th>
                  <th>{th ? 'เริ่มคำขอ' : 'Requested'}</th>
                  <th>{th ? 'การทำงาน' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td><Link to={'/devices/' + item.deviceId}><b>{item.deviceName}</b></Link></td>
                    <td>{item.operatorName}</td>
                    <td>{item.mode === 'view_only' ? 'View only' : 'Control'}</td>
                    <td>
                      <INNOStatus tone={statusTone(item.status)}>{item.status}</INNOStatus>
                      {item.failureCode ? <div className="table-meta">{item.failureCode}</div> : null}
                    </td>
                    <td>{formatDate(item.requestedAt, locale)}</td>
                    <td className="action-column">
                      <div className="device-live-actions">
                        {item.status === 'active' && item.launchUrl ? (
                          <INNOButton variant="primary" type="button" onClick={() => window.open(item.launchUrl!, '_blank', 'noopener,noreferrer')}>
                            {th ? 'เปิด Remote Desktop' : 'Open Remote Desktop'}
                          </INNOButton>
                        ) : null}
                        {item.status === 'active' ? (
                          <INNOButton
                            variant="danger"
                            type="button"
                            busy={disconnect.isPending && disconnect.variables === item.id}
                            onClick={() => disconnect.mutate(item.id)}
                          >
                            {th ? 'ตัดการเชื่อมต่อ' : 'Disconnect'}
                          </INNOButton>
                        ) : null}
                        {item.status === 'awaiting_consent' ? <span className="table-meta">{th ? 'Legacy session กำลังรอ Consent' : 'Legacy session awaiting consent'}</span> : null}
                      </div>
                    </td>
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
