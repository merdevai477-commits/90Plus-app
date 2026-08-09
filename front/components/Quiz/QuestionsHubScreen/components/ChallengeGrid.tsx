/**
 * =============================================================================
 * QUESTIONS HUB — CHALLENGE GRID
 * =============================================================================
 *
 * Lays the challenge cards out in rows. Column count comes from
 * ../data.ts → getGridColumns() (2 on phones, 3 on large phones/small tablets,
 * 4 on wide tablets).
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   VERTICAL SPACE BETWEEN ROWS ... ROW_BOTTOM_MARGIN below
 *   HORIZONTAL GAP + GUTTERS ...... ../styles.ts → hub.modeRow
 *   COLUMN COUNT BREAKPOINTS ...... ../data.ts → getGridColumns()
 * =============================================================================
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import type { Challenge } from '../data';
import { useQuestionsHubStyles } from '../styles';
import ChallengeCard from './ChallengeCard';

/**
 * Row-to-row spacing, in RAW FIGMA UNITS, indexed by row.
 * Figma node 1:2 does not use a uniform gap — the rows sit at
 * y = 441, 567, 733, 896, and the last row is followed by the stats strip.
 *   row 0 → 17   row 1 → 16   row 2 → 14   row 3 → 41 (space before stats)
 * Rows beyond the fourth fall back to DEFAULT_ROW_MARGIN.
 */
const ROW_BOTTOM_MARGIN = [17, 16, 14, 41] as const;
const DEFAULT_ROW_MARGIN = 16;

function ChallengeRow({
  row,
  rowIndex,
  columns,
}: {
  row: Challenge[];
  rowIndex: number;
  columns: number;
}) {
  const { hub, metrics } = useQuestionsHubStyles();
  const marginBottom = metrics.s(ROW_BOTTOM_MARGIN[rowIndex] ?? DEFAULT_ROW_MARGIN);

  // Pad short rows with invisible flex cells so the last card doesn't stretch
  // across the full width.
  const fillerCount = columns - row.length;
  const fillerCells: React.ReactNode[] = [];
  for (let i = 0; i < fillerCount; i += 1) {
    fillerCells.push(<View key={`filler-${rowIndex}-${i}`} style={hub.emptyColumn} />);
  }

  return (
    <View style={[hub.modeRow, { marginBottom }]}>
      {row.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} />
      ))}
      {fillerCells}
    </View>
  );
}

function ChallengeGrid({ rows, columns }: { rows: Challenge[][]; columns: number }) {
  return (
    <>
      {rows.map((row, rowIndex) => (
        <ChallengeRow key={`row-${rowIndex}`} row={row} rowIndex={rowIndex} columns={columns} />
      ))}
    </>
  );
}

export default memo(ChallengeGrid);
