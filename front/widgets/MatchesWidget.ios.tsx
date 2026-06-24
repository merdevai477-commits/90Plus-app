import { Text, VStack, HStack, Spacer } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
  background,
  cornerRadius,
} from '@expo/ui/swift-ui/modifiers';
import ExpoWidgetsModule from 'expo-widgets/build/ExpoWidgets';
import type { WidgetEnvironment } from 'expo-widgets';

import { WIDGET_NAME } from '../src/widgets/constants';
import type { MatchesWidgetPayload, WidgetMatchRow } from '../src/widgets/types';
import { toNativeWidgetProps } from '../src/widgets/toNativeWidgetProps';

const matchesWidgetLayout = (
  props: MatchesWidgetPayload,
  environment: WidgetEnvironment,
) => {
  'widget';

  // @ts-expect-error provided by ExpoWidgets.bundle at render time
  const _jsx = globalThis.jsx;
  // @ts-expect-error provided by ExpoWidgets.bundle at render time
  const _jsxs = globalThis.jsxs;

  // Must live inside the widget function — Babel stringifies only this body for the extension.
  const BG = '#0d0a14';
  const TEXT = '#FFFFFF';
  const MUTED = '#9CA3AF';
  const LIVE = '#EF4444';
  const ACCENT = '#7C3AED';

  function scoreLine(match: WidgetMatchRow): string {
    if (match.status === 'upcoming') {
      return match.kickoff ?? '-';
    }
    const h = match.homeScore ?? 0;
    const a = match.awayScore ?? 0;
    return `${h} - ${a}`;
  }

  function MatchRowView({
    match,
    compact,
  }: {
    match: WidgetMatchRow;
    compact?: boolean;
  }) {
    const statusColor = match.status === 'live' ? LIVE : MUTED;
    const homeSize = compact ? 12 : 13;
    const awaySize = compact ? 12 : 13;

    return (
      <HStack modifiers={[padding({ vertical: compact ? 2 : 4 })]}>
        <VStack>
          <Text
            modifiers={[
              font({ size: homeSize, weight: 'semibold' }),
              foregroundStyle(TEXT),
            ]}
          >
            {match.homeShort}
          </Text>
          <Text
            modifiers={[
              font({ size: awaySize, weight: 'semibold' }),
              foregroundStyle(TEXT),
            ]}
          >
            {match.awayShort}
          </Text>
        </VStack>
        <Spacer />
        <VStack>
          <Text
            modifiers={[
              font({ size: compact ? 13 : 15, weight: 'bold' }),
              foregroundStyle(TEXT),
            ]}
          >
            {scoreLine(match)}
          </Text>
          <Text
            modifiers={[
              font({ size: 10, weight: match.status === 'live' ? 'bold' : 'regular' }),
              foregroundStyle(statusColor),
            ]}
          >
            {match.statusLabel}
          </Text>
        </VStack>
      </HStack>
    );
  }

  function Header() {
    const liveLabel =
      props.liveCount > 0 ? `${props.liveCount} LIVE` : '90Plus';

    return (
      <HStack modifiers={[padding({ bottom: 6 })]}>
        <Text
          modifiers={[
            font({ size: 13, weight: 'bold' }),
            foregroundStyle(props.liveCount > 0 ? LIVE : ACCENT),
          ]}
        >
          {liveLabel}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>Matches</Text>
      </HStack>
    );
  }

  function EmptyState() {
    return (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(TEXT)]}>
          90Plus
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(MUTED)]}>
          No matches today
        </Text>
      </VStack>
    );
  }

  const family = String(environment.widgetFamily ?? 'systemMedium');
  const matches = props.matches ?? [];

  if (matches.length === 0) {
    return (
      <VStack modifiers={[padding({ all: 12 }), background(BG)]}>
        <EmptyState />
      </VStack>
    );
  }

  if (family === 'systemSmall') {
    const m = matches[0];
    return (
      <VStack
        modifiers={[
          padding({ all: 12 }),
          background(BG),
          cornerRadius(16),
        ]}
      >
        <Header />
        <MatchRowView match={m} compact />
        <Spacer />
        <Text modifiers={[font({ size: 9 }), foregroundStyle(MUTED)]}>{m.league}</Text>
      </VStack>
    );
  }

  const limit = family === 'systemMedium' ? 2 : 5;
  const slice = matches.slice(0, limit);

  return (
    <VStack
      modifiers={[
        padding({ all: 12 }),
        background(BG),
        cornerRadius(16),
      ]}
    >
      <Header />
      {slice.map((m) => (
        <MatchRowView key={m.id} match={m} compact={family === 'systemMedium'} />
      ))}
    </VStack>
  );
};

type NativeWidgetHandle = {
  updateTimeline: (entries: { timestamp: number; props: Record<string, unknown> }[]) => void;
  reload: () => void;
};

function ensureNativeWidget(): NativeWidgetHandle {
  const layout = matchesWidgetLayout as unknown;
  if (typeof layout !== 'string') {
    throw new Error(
      '[MatchesWidget] Layout not stringified — run: npm run start:clear',
    );
  }
  // Re-register layout each call so JS layout changes reach the extension (App Group storage).
  return new ExpoWidgetsModule.Widget(WIDGET_NAME, layout) as NativeWidgetHandle;
}

const MatchesWidget = {
  updateSnapshot(payload: MatchesWidgetPayload) {
    ensureNativeWidget().updateTimeline([
      {
        // Swift Record expects Int — Date.now() is a JS double.
        timestamp: Math.trunc(Date.now()),
        props: toNativeWidgetProps(payload),
      },
    ]);
  },
  reload() {
    ensureNativeWidget().reload();
  },
};

export default MatchesWidget;
