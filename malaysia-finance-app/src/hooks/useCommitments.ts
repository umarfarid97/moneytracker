import { useData } from './DataProvider';

export function useCommitments() {
  const { commitments, commitmentOps } = useData();
  return { data: commitments, ...commitmentOps };
}
