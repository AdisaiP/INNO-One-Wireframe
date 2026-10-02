import { INNORowActions } from '@inno/ui';
import { useNavigate } from 'react-router-dom';

export function RouterRowAction({
  to,
  label = 'Open',
  ariaLabel,
}: {
  to: string;
  label?: string;
  ariaLabel?: string;
}) {
  const navigate = useNavigate();

  return (
    <INNORowActions
      ariaLabel={ariaLabel ?? label}
      items={[{
        id: label.toLowerCase().replace(/\s+/g, '-'),
        label,
        onSelect: () => navigate(to),
      }]}
    />
  );
}
