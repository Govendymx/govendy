'use client';

import { orderStatusBadgeClass, orderStatusBadgeShort } from '@/lib/orders/orderStatus';

type Props = {
  status: string | null | undefined;
  className?: string;
};

export function OrderStatusBadge({ status, className = '' }: Props) {
  return (
    <span className={`${orderStatusBadgeClass(status)} ${className}`.trim()}>
      {orderStatusBadgeShort(status)}
    </span>
  );
}
