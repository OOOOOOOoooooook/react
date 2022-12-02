/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as React from 'react';
import {useCallback, useContext, useMemo, useState} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeGrid} from 'react-window';
import {ProfilerContext} from './ProfilerContext';
import NoCommitData from './NoCommitData';
import CommitRankedListItem from './CommitRankedListItem';
import HoveredFiberInfo from './HoveredFiberInfo';
import {scale, formatLabelNoDuration, dround} from './utils';
import {StoreContext} from '../context';
import {SettingsContext} from '../Settings/SettingsContext';
import {useHighlightNativeElement} from '../hooks';
import Tooltip from './Tooltip';

import styles from './CommitSummary.css';

import type {TooltipFiberData} from './HoveredFiberInfo';
import type {ChartData} from './RankedChartBuilder';
import type {CommitTree} from './types';

export type ItemData = {
  chartData: ChartData,
  onElementMouseEnter: (fiberData: TooltipFiberData) => void,
  onElementMouseLeave: () => void,
  scaleX: (value: number, fallbackValue: number) => number,
  selectedFiberID: number | null,
  selectedFiberIndex: number,
  selectFiber: (id: number | null, name: string | null) => void,
  width: number,
};

export default function CommitSummaryAutoSizer(_: {}): React.Node {
  const {profilerStore} = useContext(StoreContext);
  const {rootID, selectedCommitIndex, selectFiber} = useContext(
    ProfilerContext,
  );
  const {profilingCache} = profilerStore;
  const {lineHeight} = useContext(SettingsContext);
  const [sortColumn, setSortColumn] = useState(2);

  const deselectCurrentFiber = useCallback(
    event => {
      event.stopPropagation();
      selectFiber(null, null);
    },
    [selectFiber],
  );

  const {
    highlightNativeElement,
    clearHighlightNativeElement,
  } = useHighlightNativeElement();



  const dataForRoot = profilerStore.getDataForRoot(((rootID: any): number));

  const summaryTotal = {
    renderCount: 0,
    renderNodeCount: 0,
    renderTimeTop: 0,
    renderTimeClean: 0,
  };

  const missingNodes = new Set;
  const summaryData = new Map;
  const summaryLabels = new Map;
  dataForRoot.snapshots.forEach((node, id) => {
    summaryData.set(id, {
      id,
      renderCount: 0,
      renderTime: 0,
      displayName: node.displayName,
    });
    if (!summaryLabels.has(node.displayName)) {
      summaryLabels.set(node.displayName, id);
    }
  });

  dataForRoot.commitData.forEach(commit => {
    summaryTotal.renderCount++;
    summaryTotal.renderTimeTop += commit.duration;

    commit.fiberSelfDurations.forEach((time, id) => {
      summaryTotal.renderNodeCount++;
      summaryTotal.renderTimeClean += time

      const data = summaryData.get(id);
      if (data) {
        data.renderCount++;
        data.renderTime += time;
      }
    });
  });

  if (missingNodes.size) {
    console.warn("missing node: in snapshots", [...missingNodes]);
  }

  const chartData = [...summaryData.values()];


  for (let i = chartData.length - 1; i >= 0; i--) {
    const data = chartData[i];
    const node = dataForRoot.snapshots.get(data.id);
    const ref = summaryLabels.get(node.displayName);
    const refNode = dataForRoot.snapshots.get(ref);

    if (data.id !== ref && node && refNode) {
      refNode.renderCount += node.renderCount;
      refNode.renderTime += node.renderTime;

      chartData.splice(i, 1);

    } else if (data.renderCount === 0 || data.renderTime === 0) {
      chartData.splice(i, 1);
    }
  }

  chartData.sort((a, b) => (
    sortColumn === 0 ? b.displayName < a.displayName ? 1 : b.displayName > a.displayName ? -1 : 0 :
    sortColumn === 1 ? b.renderCount - a.renderCount :
    sortColumn === 2 ? b.renderTime - a.renderTime :
    sortColumn === 3 ? b.renderTime / b.renderCount - a.renderTime / a.renderCount :
    0
  ));

  if (chartData != null && chartData.length > 0) {
    return (
      <div className={styles.Container} onClick={deselectCurrentFiber}>
        <AutoSizer>
          {({height, width}) => {
            const columnNames = ["Component", "Render count", "Render time", "Avg time"];
            const columnWidth = [55, 15, 15, 15];
            const getColumnWidth = index => Math.floor(columnWidth[index] / 100 * (width - 15))
            const columns = columnNames.length;
            // const columnWidth = Math.floor(width / columns) - 15;
            return (
              <>
                <VariableSizeGrid
                  columnCount={columns}
                  columnWidth={getColumnWidth}
                  rowCount={1}
                  rowHeight={() => lineHeight}
                  estimatedRowHeight={lineHeight}
                  width={width}
                  height={lineHeight}
                >
                  {({ columnIndex, style }) => (
                    <div style={style} onClick={() => setSortColumn(columnIndex)}>
                      {columnNames[columnIndex]}
                      {sortColumn === columnIndex && "▼"}
                    </div>
                  )}
                </VariableSizeGrid>
                <VariableSizeGrid
                  columnCount={columns}
                  columnWidth={getColumnWidth}
                  rowCount={chartData.length}
                  rowHeight={() => lineHeight}
                  estimatedRowHeight={lineHeight}
                  width={width}
                  height={height - lineHeight}
                >
                  {({ columnIndex, rowIndex, style }) => {
                    const data = chartData[rowIndex];
                    const node = dataForRoot.snapshots.get(data.id);

                    return (
                      <div
                        style={style}
                        onMouseEnter={() => highlightNativeElement(data.id)}
                        onMouseLeave={() => clearHighlightNativeElement()}
                      >
                        {
                          columnIndex === 0 ? formatLabelNoDuration(node.displayName, node.type) :
                          columnIndex === 1 ? data.renderCount :
                          columnIndex === 2 ? dround(data.renderTime) :
                          columnIndex === 3 ? dround(data.renderTime / data.renderCount) :
                          null
                        }
                      </div>
                    );
                  }}
                </VariableSizeGrid>
              </>
            );
          }}
        </AutoSizer>
      </div>
    );
  } else {
    return <NoCommitData />;
  }
}

type Props = {
  chartData: ChartData,
  commitTree: CommitTree,
  height: number,
  width: number,
};

function CommitSummary({chartData, commitTree, height, width}: Props) {
  const [
    hoveredFiberData,
    setHoveredFiberData,
  ] = useState<TooltipFiberData | null>(null);
  const {lineHeight} = useContext(SettingsContext);
  const {selectedFiberID, selectFiber} = useContext(ProfilerContext);
  const {
    highlightNativeElement,
    clearHighlightNativeElement,
  } = useHighlightNativeElement();

  const selectedFiberIndex = useMemo(
    // () => getNodeIndex(chartData, selectedFiberID),
    () => chartData.findIndex((item) => item.id === selectedFiberID),
    [chartData, selectedFiberID],
  );

  const handleElementMouseEnter = useCallback(
    ({id, name}) => {
      highlightNativeElement(id); // Highlight last hovered element.
      setHoveredFiberData({id, name}); // Set hovered fiber data for tooltip
    },
    [highlightNativeElement],
  );

  const handleElementMouseLeave = useCallback(() => {
    clearHighlightNativeElement(); // clear highlighting of element on mouse leave
    setHoveredFiberData(null); // clear hovered fiber data for tooltip
  }, [clearHighlightNativeElement]);

  const itemData = useMemo<ItemData>(
    () => ({
      chartData,
      onElementMouseEnter: handleElementMouseEnter,
      onElementMouseLeave: handleElementMouseLeave,
      scaleX: scale(0, chartData.nodes[selectedFiberIndex].value, 0, width),
      selectedFiberID,
      selectedFiberIndex,
      selectFiber,
      width,
    }),
    [
      chartData,
      handleElementMouseEnter,
      handleElementMouseLeave,
      selectedFiberID,
      selectedFiberIndex,
      selectFiber,
      width,
    ],
  );

  // Tooltip used to show summary of fiber info on hover
  const tooltipLabel = useMemo(
    () =>
      hoveredFiberData !== null ? (
        <HoveredFiberInfo fiberData={hoveredFiberData} />
      ) : null,
    [hoveredFiberData],
  );

  return (
    <Tooltip label={tooltipLabel}>
      <FixedSizeGrid
        height={height}
        innerElementType="svg"
        itemCount={chartData.nodes.length}
        itemData={itemData}
        itemSize={lineHeight}
        width={width}>
        {CommitRankedListItem}
      </FixedSizeGrid>
    </Tooltip>
  );
}

const getNodeIndex = (chartData: ChartData, id: number | null): number => {
  if (id === null) {
    return 0;
  }
  const {nodes} = chartData;
  for (let index = 0; index < nodes.length; index++) {
    if (nodes[index].id === id) {
      return index;
    }
  }
  return 0;
};
