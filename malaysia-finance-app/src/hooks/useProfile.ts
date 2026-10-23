import { useData } from './DataProvider';

export function useProfile() {
  const { profile, saveProfile } = useData();
  return { data: profile, save: saveProfile };
}
