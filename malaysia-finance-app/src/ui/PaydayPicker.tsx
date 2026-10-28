import { type ComponentRef, useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { fontFamily, radius } from './theme';
import { useTheme } from './useTheme';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const ITEM = 40;
const VISIBLE = 3;

/**
 * Scroll wheel for the salary day, 1 to 31 (31 reads "Last day"). The salary day and the budget start day
 * are one setting (`profile.budgetStartDay`), so the profile and budget screens both use this picker.
 * It saves as it scrolls: whatever day sits in the middle row is the value.
 */
export function PaydayPicker({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  const { c } = useTheme();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    scroll.current?.scrollTo({ y: (value - 1) * ITEM, animated: false });
    return () => clearTimeout(settle.current);
  }, [value]);

  function pickAt(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const day = Math.min(31, Math.max(1, Math.round(e.nativeEvent.contentOffset.y / ITEM) + 1));
    if (day !== value) onChange(day);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    // Web has no momentum-end event, so treat a pause in scrolling as the wheel settling.
    const y = e.nativeEvent.contentOffset.y;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => pickAt({ nativeEvent: { contentOffset: { y } } } as NativeSyntheticEvent<NativeScrollEvent>), 120);
  }

  return (
    <View style={{ height: ITEM * VISIBLE, borderRadius: radius.control, backgroundColor: c.surface, borderWidth: 1, borderColor: c.control, overflow: 'hidden' }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: ITEM, height: ITEM, backgroundColor: c.accent, opacity: 0.1 }}
      />
      <ScrollView
        ref={scroll}
        testID="payday-wheel"
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScroll={onScroll}
        onMomentumScrollEnd={pickAt}
        onScrollEndDrag={pickAt}
        contentContainerStyle={{ paddingVertical: ITEM }}
      >
        {DAYS.map((day) => (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`Budget starts ${day === 31 ? 'on the last day' : `on day ${day}`}`}
            onPress={() => onChange(day)}
            style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText
              variant={day === value ? 'bodyStrong' : 'body'}
              style={{ fontFamily: day === value ? fontFamily.semibold : fontFamily.medium, color: day === value ? c.accent : c.muted }}
            >
              {day === 31 ? t('budget.startDay.last') : String(day)}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
