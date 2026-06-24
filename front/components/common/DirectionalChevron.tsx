import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useLanguageStore } from '../../src/i18n/store';

type ChevronProps = React.ComponentProps<typeof ChevronRight>;

/** List-row chevron that points forward in the active layout direction. */
export function DirectionalChevron(props: ChevronProps) {
  const isRTL = useLanguageStore((state) => state.isRTL);
  const Icon = isRTL ? ChevronLeft : ChevronRight;
  return <Icon {...props} />;
}
