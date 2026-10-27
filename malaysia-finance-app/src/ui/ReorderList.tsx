import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { elevation, radius } from './theme';
import { useTheme } from './useTheme';

export type ReorderItem = {
  key: string;
  title: string;
  subtitle?: string;
  /** Shown in front of the title (a category icon, say). */
  leading?: ReactNode;
  visible: boolean;
};

type Props = {
  items: ReorderItem[];
  /** Called with the item's index it moved from and the index it moved to. */
  onMove: (from: number, to: number) => void;
  onToggle: (key: string) => void;
};

const ROW_HEIGHT = 72;
const GAP = 8;
const STRIDE = ROW_HEIGHT + GAP;
const clampIndex = (i: number, count: number) => Math.max(0, Math.min(count - 1, i));

/**
 * A list where each row can be dragged by its handle, moved with the up and down buttons (which also work
 * with a keyboard or a screen reader) and switched on or off with the eye. Rows have a fixed height, so a
 * drag maps straight to a new position and the rows in between slide out of the way.
 */
export function ReorderList({ items, onMove, onToggle }: Props) {
  // Which row is being dragged (-1 for none), where it would land, and how far the finger has moved it.
  const from = useSharedValue(-1);
  const to = useSharedValue(-1);
  const dy = useSharedValue(0);
  return (
    <View style={{ gap: GAP }}>
      {items.map((item, index) => (
        <Row
          key={item.key}
          item={item}
          index={index}
          count={items.length}
          from={from}
          to={to}
          dy={dy}
          onMove={onMove}
          onToggle={onToggle}
        />
      ))}
    </View>
  );
}

type Shared = { value: number };

type RowProps = {
  item: ReorderItem;
  index: number;
  count: number;
  from: Shared;
  to: Shared;
  dy: Shared;
  onMove: Props['onMove'];
  onToggle: Props['onToggle'];
};

function Row({ item, index, count, from, to, dy, onMove, onToggle }: RowProps) {
  const { c, scheme } = useTheme();

  const drag = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onBegin(() => {
      from.value = index;
      to.value = index;
      dy.value = 0;
    })
    .onUpdate((e) => {
      dy.value = e.translationY;
      to.value = clampIndex(index + Math.round(e.translationY / STRIDE), count);
    })
    .onFinalize(() => {
      const target = to.value;
      from.value = -1;
      to.value = -1;
      dy.value = withTiming(0, { duration: 120 });
      if (target !== index && target >= 0) runOnJS(onMove)(index, target);
    });

  // The dragged row follows the finger; rows between it and its landing spot make room.
  const style = useAnimatedStyle(() => {
    if (from.value < 0) return { transform: [{ translateY: 0 }], zIndex: 0 };
    if (from.value === index) return { transform: [{ translateY: dy.value }], zIndex: 2 };
    let shift = 0;
    if (from.value < index && index <= to.value) shift = -STRIDE;
    else if (to.value <= index && index < from.value) shift = STRIDE;
    return { transform: [{ translateY: withTiming(shift, { duration: 120 }) }], zIndex: 0 };
  });

  const name = item.title;
  const web = Platform.OS === 'web';
  const button = (label: string, icon: 'chevron-up' | 'chevron-down', disabled: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ padding: 4, opacity: disabled ? 0.25 : 1 }}
    >
      <Ionicons name={icon} size={20} color={c.muted} />
    </Pressable>
  );

  return (
    <Animated.View
      style={[
        {
          height: ROW_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          backgroundColor: c.surface,
          borderRadius: radius.control,
          opacity: item.visible ? 1 : 0.6,
        },
        scheme === 'dark' ? { borderWidth: 1, borderColor: c.border } : elevation(scheme),
        style,
      ]}
    >
      <GestureDetector gesture={drag}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={t('customize.drag', { name })}
          style={[{ padding: 6 }, web ? ({ touchAction: 'none', cursor: 'grab' } as object) : null]}
        >
          <Ionicons name="reorder-three-outline" size={24} color={c.muted} />
        </View>
      </GestureDetector>
      {item.leading}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        {item.subtitle ? (
          <AppText variant="small" tone="muted" numberOfLines={2} style={{ fontSize: 13, lineHeight: 17 }}>
            {item.subtitle}
          </AppText>
        ) : null}
      </View>
      {button(t('customize.up', { name }), 'chevron-up', index === 0, () => onMove(index, index - 1))}
      {button(t('customize.down', { name }), 'chevron-down', index === count - 1, () => onMove(index, index + 1))}
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={t(item.visible ? 'customize.hide' : 'customize.show', { name })}
        accessibilityState={{ checked: item.visible }}
        onPress={() => onToggle(item.key)}
        hitSlop={8}
        style={{ padding: 4 }}
      >
        <Ionicons name={item.visible ? 'eye-outline' : 'eye-off-outline'} size={24} color={item.visible ? c.accent : c.muted} />
      </Pressable>
    </Animated.View>
  );
}
