import {Button, Dialog, Colors} from '@blueprintjs/core';
import {IconNames} from '@blueprintjs/icons';
import * as React from 'react';
import styled from 'styled-components/macro';

import {useQueryPersistedState} from '../hooks/useQueryPersistedState';
import {useQueryPersistedRunFilters} from '../runs/RunsFilter';
import {CursorHistoryControls} from '../ui/CursorControls';
import {Spinner} from '../ui/Spinner';
import {RepoAddress} from '../workspace/types';

import {PartitionGraphSet} from './PartitionGraphSet';
import {PartitionPageSizeSelector} from './PartitionPageSizeSelector';
import {PartitionRunMatrix} from './PartitionRunMatrix';
import {PartitionSetSelector} from './PartitionSetSelector';
import {PartitionsBackfillPartitionSelector} from './PartitionsBackfill';
import {RunTagsSupportedTokens} from './RunTagsTokenizingField';
import {PipelinePartitionsRootQuery_partitionSetsOrError_PartitionSets_results} from './types/PipelinePartitionsRootQuery';
import {useChunkedPartitionsQuery} from './useChunkedPartitionsQuery';

type PartitionSet = PipelinePartitionsRootQuery_partitionSetsOrError_PartitionSets_results;

interface PartitionViewProps {
  pipelineName: string;
  partitionSet: PartitionSet;
  partitionSets: PartitionSet[];
  onChangePartitionSet: (set: PartitionSet) => void;
  repoAddress: RepoAddress;
}

export const PartitionView: React.FunctionComponent<PartitionViewProps> = ({
  pipelineName,
  partitionSet,
  partitionSets,
  onChangePartitionSet,
  repoAddress,
}) => {
  const [runTags, setRunTags] = useQueryPersistedRunFilters(RunTagsSupportedTokens);
  const [stepQuery = '', setStepQuery] = useQueryPersistedState<string>({queryKey: 'stepQuery'});
  const [pageSize, setPageSize] = useQueryPersistedState<number | 'all'>({
    encode: (val) => ({pageSize: val}),
    decode: (qs) => (qs.pageSize === 'all' ? 'all' : Number(qs.pageSize || 30)),
  });
  const [showBackfillSetup, setShowBackfillSetup] = React.useState(false);
  const [blockDialog, setBlockDialog] = React.useState(false);
  const {loading, loadingPercent, partitions, paginationProps} = useChunkedPartitionsQuery(
    partitionSet.name,
    pageSize,
    runTags,
    repoAddress,
  );

  const onSubmit = React.useCallback(() => setBlockDialog(true), []);

  const allStepKeys = {};
  partitions.forEach((partition) => {
    partition.runs?.forEach((run) => {
      if (!run) {
        return;
      }
      run.stepStats.forEach((stat) => {
        allStepKeys[stat.stepKey] = true;
      });
    });
  });

  return (
    <div>
      <Dialog
        canEscapeKeyClose={!blockDialog}
        canOutsideClickClose={!blockDialog}
        onClose={() => setShowBackfillSetup(false)}
        style={{width: 800, background: Colors.WHITE}}
        title={`Launch ${partitionSet.name} backfill`}
        isOpen={showBackfillSetup}
      >
        {showBackfillSetup && (
          <PartitionsBackfillPartitionSelector
            partitionSetName={partitionSet.name}
            pipelineName={pipelineName}
            onLaunch={(backfillId, stepQuery) => {
              setStepQuery(stepQuery);
              setRunTags([{token: 'tag', value: `dagster/backfill=${backfillId}`}]);
              setShowBackfillSetup(false);
            }}
            onSubmit={onSubmit}
            repoAddress={repoAddress}
          />
        )}
      </Dialog>
      <PartitionPagerContainer>
        <PartitionSetSelector
          selected={partitionSet}
          partitionSets={partitionSets}
          onSelect={onChangePartitionSet}
        />
        <div style={{width: 10}} />
        <Button
          onClick={() => setShowBackfillSetup(!showBackfillSetup)}
          icon={IconNames.ADD}
          active={showBackfillSetup}
        >
          Launch backfill
        </Button>
        {loading && (
          <div style={{marginLeft: 15, display: 'flex', alignItems: 'center'}}>
            <Spinner purpose="body-text" value={loadingPercent} />
            <div style={{width: 5}} />
            Loading partitions…
          </div>
        )}
        <div style={{flex: 1}} />
        <PartitionPageSizeSelector
          value={paginationProps.hasPrevCursor ? undefined : pageSize}
          onChange={(value) => {
            setPageSize(value);
            paginationProps.reset();
          }}
        />
        <div style={{width: 10}} />
        <CursorHistoryControls {...paginationProps} />
      </PartitionPagerContainer>
      <div style={{position: 'relative'}}>
        <PartitionRunMatrix
          partitions={partitions}
          pipelineName={pipelineName}
          repoAddress={repoAddress}
          runTags={runTags}
          setRunTags={setRunTags}
          stepQuery={stepQuery}
          setStepQuery={setStepQuery}
        />
        <PartitionGraphSet partitions={partitions} allStepKeys={Object.keys(allStepKeys)} />
      </div>
    </div>
  );
};

const PartitionPagerContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;
