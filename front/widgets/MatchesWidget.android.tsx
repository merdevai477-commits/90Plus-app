'use no memo';

import React from 'react';
import {
  FlexWidget,
  ListWidget,
  TextWidget,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import type { MatchesWidgetPayload, WidgetMatchRow } from '../src/widgets/types';

const BG = '#0d0a14';
const TEXT = '#FFFFFF';
const MUTED = '#9CA3AF';
const LIVE = '#EF4444';
const ACCENT = '#7C3AED';
const DIVIDER = '#1a1524';

function scoreText(match: WidgetMatchRow): string {
  if (match.status === 'upcoming') {
    return match.kickoff ?? '—';
  }
  return `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`;
}

function MatchRow({ match }: { match: WidgetMatchRow }) {
  const statusColor = match.status === 'live' ? LIVE : MUTED;

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 2,
      }}
    >
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget
          text={match.homeShort}
          style={{ fontSize: 13, fontWeight: '600', color: TEXT }}
          maxLines={1}
        />
        <TextWidget
          text={match.awayShort}
          style={{ fontSize: 13, fontWeight: '600', color: TEXT }}
          maxLines={1}
        />
      </FlexWidget>
      <FlexWidget style={{ alignItems: 'flex-end', paddingLeft: 8 }}>
        <TextWidget
          text={scoreText(match)}
          style={{ fontSize: 14, fontWeight: '700', color: TEXT }}
        />
        <TextWidget
          text={match.statusLabel}
          style={{
            fontSize: 10,
            fontWeight: match.status === 'live' ? '700' : '400',
            color: statusColor,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

function WidgetBody({ payload, maxRows }: { payload: MatchesWidgetPayload; maxRows: number }) {
  const matches = payload.matches.slice(0, maxRows);
  const header =
    payload.liveCount > 0 ? `${payload.liveCount} LIVE` : '90Plus Matches';

  if (matches.length === 0) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: BG,
          borderRadius: 16,
          padding: 14,
          justifyContent: 'center',
        }}
        accessibilityLabel="90Plus matches widget"
      >
        <TextWidget
          text="90Plus"
          style={{ fontSize: 16, fontWeight: '700', color: ACCENT }}
        />
        <TextWidget
          text="No matches today"
          style={{ fontSize: 12, color: MUTED, marginTop: 4 }}
        />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: BG,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'column',
      }}
      accessibilityLabel="90Plus live matches"
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <TextWidget
          text={header}
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: payload.liveCount > 0 ? LIVE : ACCENT,
          }}
        />
        <TextWidget text="90Plus" style={{ fontSize: 10, color: MUTED }} />
      </FlexWidget>

      <ListWidget
        style={{
          width: 'match_parent',
          height: 'wrap_content',
          backgroundColor: DIVIDER,
        }}
      >
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </ListWidget>
    </FlexWidget>
  );
}

export function renderMatchesAndroidWidget(
  payload: MatchesWidgetPayload,
  height?: number,
): WidgetRepresentation {
  const maxRows = height && height < 140 ? 2 : height && height < 200 ? 3 : 5;
  const tree = <WidgetBody payload={payload} maxRows={maxRows} />;

  return {
    light: tree,
    dark: tree,
  };
}
