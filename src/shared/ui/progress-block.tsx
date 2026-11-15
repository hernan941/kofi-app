import { useEffect, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Progress of a task with a known count. */
export interface ProgressCount {
  readonly done: number;
  readonly total: number;
}

/** Props of {@link ProgressBlock}. */
export interface ProgressBlockProps {
  readonly label: string;
  /** Without it the bar is indeterminate. */
  readonly progress?: ProgressCount;
  /** Spoken value of the bar; defaults to "{done} de {total}". */
  readonly valueText?: string;
}

/** Time the indeterminate segment takes to cross the track, in milliseconds. */
const SWEEP_DURATION_MS = 1200;

/** Share of the track the indeterminate segment covers. */
const SEGMENT_SHARE = 0.4;

const TRACK_CLASSES =
  'h-3 w-full overflow-hidden rounded-full border-2 border-field-border bg-background';

function fillPercentage({ done, total }: ProgressCount): number {
  return total <= 0 ? 0 : Math.min(100, Math.max(0, (done / total) * 100));
}

/**
 * Indeterminate bar: a segment that crosses the track in 1.2 s. When the system asks to reduce
 * motion, the segment stays still in the middle.
 */
function IndeterminateBar() {
  const isReducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (isReducedMotion) {
      return;
    }
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(sweep);
    };
  }, [isReducedMotion, sweep]);
  const segmentWidth = trackWidth * SEGMENT_SHARE;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: isReducedMotion
          ? (trackWidth - segmentWidth) / 2
          : -segmentWidth + sweep.value * (trackWidth + segmentWidth),
      },
    ],
  }));
  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };
  return (
    <View onLayout={onLayout} className={TRACK_CLASSES}>
      <Animated.View
        testID="progress-indeterminate"
        className="h-full rounded-full bg-accent"
        style={[{ width: segmentWidth }, animatedStyle]}
      />
    </View>
  );
}

/**
 * Progress of a task (design system, F8.1 6.2): the label on top and an 8 pt bar with a
 * `background` track, a 2 px `field-border` outline and an `accent` fill. It is a
 * `progressbar` named by the label. With `progress` it carries the accessible value and the
 * fill is proportional (an empty bar when the total is 0). Without it the bar is indeterminate
 * and `busy`. It never announces by itself: whoever uses it decides when.
 */
export function ProgressBlock({ label, progress, valueText }: ProgressBlockProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={progress === undefined ? { busy: true } : undefined}
      accessibilityValue={
        progress === undefined
          ? undefined
          : {
              min: 0,
              max: progress.total,
              now: progress.done,
              text: valueText ?? `${String(progress.done)} de ${String(progress.total)}`,
            }
      }
      className="gap-2"
    >
      <Text className="text-base text-foreground">{label}</Text>
      {progress === undefined ? (
        <IndeterminateBar />
      ) : (
        <View className={TRACK_CLASSES}>
          <View
            testID="progress-fill"
            className="h-full rounded-full bg-accent"
            style={{ width: `${String(fillPercentage(progress))}%` }}
          />
        </View>
      )}
    </View>
  );
}
