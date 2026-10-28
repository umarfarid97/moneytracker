import { Switch, type SwitchProps } from 'react-native';
import { useTheme } from './useTheme';

/** The platform switch, tinted with the theme's accent. Classic keeps the platform's own colours. */
export function Toggle(props: SwitchProps) {
  const { c, theme } = useTheme();
  if (theme === 'classic') return <Switch {...props} />;
  return <Switch trackColor={{ true: c.accent, false: c.control }} thumbColor={props.value ? c.onAccent : c.surface} {...props} />;
}
