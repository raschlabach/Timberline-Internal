import { SkidData } from '@/types/shared';

declare module '@/components/orders/filter-toggle' {
  import { FilterToggleProps } from '@/types/orders';
  export function FilterToggle(props: FilterToggleProps): JSX.Element;
}

declare module '@/components/orders/skids-vinyl-entry' {
  import { SkidsVinylEntryProps } from '@/types/orders';
  export function SkidsVinylEntry(props: SkidsVinylEntryProps): JSX.Element;
}

declare module '@/components/orders/footage-entry' {
  import { FootageEntryProps } from '@/types/orders';
  export function FootageEntry(props: FootageEntryProps): JSX.Element;
}

declare module '@/components/orders/date-picker' {
  import { DatePickerProps } from '@/types/orders';
  export function DatePicker(props: DatePickerProps): JSX.Element;
}

declare module '@/components/orders/status-flags' {
  import { StatusFlagsProps } from '@/types/orders';
  export function StatusFlags(props: StatusFlagsProps): JSX.Element;
}

declare module '@/components/orders/skid-entry-row' {
  import { SkidData, SkidEntryRowProps } from '@/types/orders';
  export function SkidEntryRow(props: SkidEntryRowProps): JSX.Element;
}

declare module '@/components/orders/order-links' {
  import { OrderLink } from '@/types/orders';
  interface OrderLinksProps {
    links: OrderLink[];
    onUpdate: (links: OrderLink[]) => void;
  }
  export function OrderLinks(props: OrderLinksProps): JSX.Element;
} 