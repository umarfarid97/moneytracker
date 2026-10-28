import { Switch, type SwitchProps } from 'react-native';
import { useTheme } from './useTheme';

/** The platform switch, tinted with the accent: a lime track with a dark thumb when on. */
export function Toggle(props: SwitchProps) {
  const { c } = useTheme();
  return <Switch trackColor={{ true: c.accent, false: c.control }} thumbColor={props.value ? c.onAccent : c.text} {...props} />;
}
