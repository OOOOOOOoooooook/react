/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as React from 'react';
import {Fragment, useContext} from 'react';
import {ProfilerContext} from './ProfilerContext';
import {dround} from './utils';
import {StoreContext} from '../context';

import styles from './SidebarSummaryInfo.css';

export type Props = {};

export default function SidebarSummaryInfo(_: Props): React.Node {
  const {rootID} = useContext(ProfilerContext);
  const {profilerStore} = useContext(StoreContext);

  if (rootID === null) {
    return <div className={styles.NothingSelected}>Nothing selected</div>;
  }

  const summaryTotal = {
    renderCount: 0,
    renderNodeCount: 0,
    renderTimeTop: 0,
    renderTimeClean: 0,
    profileStart: 0,
    profileEnd: 0,
    profileDuration: 0,
  };

  const dataForRoot = profilerStore.getDataForRoot(((rootID: any): number));

  dataForRoot.commitData.forEach(commit => {
    summaryTotal.renderCount++;
    summaryTotal.renderTimeTop += commit.duration;
    summaryTotal.profileStart = Math.min(summaryTotal.profileStart, commit.timestamp);
    summaryTotal.profileEnd = Math.max(summaryTotal.profileEnd, commit.timestamp + commit.duration);

    commit.fiberSelfDurations.forEach((time, id) => {
      summaryTotal.renderNodeCount++;
      summaryTotal.renderTimeClean += time
    });
  });

  summaryTotal.profileDuration = summaryTotal.profileEnd - summaryTotal.profileStart;

  return (
    <Fragment>
      <div className={styles.Toolbar}>Summary information</div>
      <div className={styles.Content}>
        <ul className={styles.List}>
          <li className={styles.ListItem}>
            <label className={styles.Label}>Profile duration</label>:{' '}
            <span className={styles.Value}>{dround(summaryTotal.profileDuration)}ms</span>
          </li>
          <li className={styles.ListItem}>
            <label className={styles.Label}>React render time</label>:{' '}
            <span className={styles.Value}>{dround(summaryTotal.renderTimeTop)}ms</span>
          </li>
          <li className={styles.ListItem}>
            <label className={styles.Label}>Component render time</label>:{' '}
            <span className={styles.Value}>{dround(summaryTotal.renderTimeClean)}ms</span>
          </li>
          <li className={styles.ListItem}>
            <label className={styles.Label}>Load</label>:{' '}
            <span className={styles.Value}>{dround(summaryTotal.renderTimeTop / summaryTotal.profileDuration * 100)}%</span>
          </li>
          <li className={styles.ListItem}>
            <label className={styles.Label}>React renders</label>:{' '}
            <span className={styles.Value}>{summaryTotal.renderCount}</span>
          </li>
          <li className={styles.ListItem}>
            <label className={styles.Label}>Component renders</label>:{' '}
            <span className={styles.Value}>{summaryTotal.renderNodeCount}</span>
          </li>
        </ul>
      </div>
    </Fragment>
  );
}
