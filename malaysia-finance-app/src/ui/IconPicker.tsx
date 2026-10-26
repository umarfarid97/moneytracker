import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { t } from '@/i18n/t';
import { Sheet } from './Sheet';
import { CATEGORY_ICONS, radius, type IconName } from './theme';
import { useTheme } from './useTheme';

type Props = {
  visible: boolean;
  /** The icon shown as chosen, if any. */
  selected?: string;
  onPick: (icon: IconName) => void;
  onClose: () => void;
};

/** "fast-food-outline" -> "fast food", for screen readers. */
const spoken = (icon: string) => icon.replace(/-outline$/, '').replace(/-/g, ' ');

/** Bottom sheet with a grid of line icons to choose from. Picking one closes it. */
export function IconPicker({ visible, selected, onPick, onClose }: Props) {
  const { c } = useTheme();
  return (
    <Sheet visible={visible} title={t('categories.icon')} onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CATEGORY_ICONS.map((icon) => {
          const on = icon === selected;
          return (
            <View key={icon} style={{ width: '16.66%', aspectRatio: 1, padding: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('categories.iconOption', { name: spoken(icon) })}
                accessibilityState={{ selected: on }}
                onPress={() => onPick(icon)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.control,
                  backgroundColor: on ? c.accentSoft : c.ground,
                  borderWidth: on ? 1.5 : 0,
                  borderColor: c.accent,
                }}
              >
                <Ionicons name={icon} size={24} color={on ? c.accent : c.text} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}
