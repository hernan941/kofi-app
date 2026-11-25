import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  type HostInstance,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { StyledSafeAreaView } from './styled-safe-area-view';
import { useIsKeyboardVisible } from './use-is-keyboard-visible';

const FIELD_MARGIN = 16;
const SCROLL_EVENT_THROTTLE_MS = 16;
const FOOTER_EDGES_WITH_KEYBOARD_CLOSED = ['bottom'] as const;
const FOOTER_EDGES_WITH_KEYBOARD_OPEN = [] as const;

/** Geometry that {@link scrollTargetForField} needs, all in the same unit (dp). */
export interface FieldScrollGeometry {
  /** Top of the field measured from the start of the scroll content. */
  readonly fieldTop: number;
  readonly fieldHeight: number;
  readonly scrollY: number;
  /** Height of the visible part of the scroll area. */
  readonly viewportHeight: number;
  /** Space kept free above and below the field. */
  readonly margin: number;
}

/**
 * Scroll position that makes a field fully visible, or `null` when it already is. A field
 * that goes out at the bottom ends just above the footer; one that goes out at the top, or
 * that is taller than the visible area, is aligned by its start (where its label is).
 */
export function scrollTargetForField({
  fieldTop,
  fieldHeight,
  scrollY,
  viewportHeight,
  margin,
}: FieldScrollGeometry): number | null {
  const fieldBottom = fieldTop + fieldHeight;
  const isAbove = fieldTop - margin < scrollY;
  const isBelow = fieldBottom + margin > scrollY + viewportHeight;
  if (!isAbove && !isBelow) return null;
  if (isAbove || fieldHeight + 2 * margin > viewportHeight) {
    return Math.max(fieldTop - margin, 0);
  }
  return fieldBottom + margin - viewportHeight;
}

/** What a text field tells the {@link FormLayout} that contains it. */
interface FocusedFieldContextValue {
  readonly onFieldFocus: (target: HostInstance) => void;
  readonly onFieldBlur: (target: HostInstance) => void;
}

/** Context through which the fields of a {@link FormLayout} report focus and blur. */
export const FocusedFieldContext = createContext<FocusedFieldContextValue | null>(null);

/**
 * Wiring of a field with the surrounding {@link FormLayout}: attach `ref` to the `View` that
 * wraps the whole field (label, box, error and help) and call `notifyFocus` and `notifyBlur`
 * from the input. Outside a `FormLayout` the calls do nothing. When the field unmounts while
 * focused, the layout is told it lost focus.
 */
export function useFieldFocusReporting(): {
  readonly ref: RefObject<HostInstance | null>;
  readonly notifyFocus: () => void;
  readonly notifyBlur: () => void;
} {
  const context = useContext(FocusedFieldContext);
  const ref = useRef<HostInstance>(null);
  const focused = useRef<HostInstance | null>(null);
  useEffect(
    () => () => {
      if (focused.current !== null) context?.onFieldBlur(focused.current);
    },
    [context],
  );
  const notifyFocus = () => {
    focused.current = ref.current;
    if (ref.current !== null) context?.onFieldFocus(ref.current);
  };
  const notifyBlur = () => {
    if (ref.current !== null) context?.onFieldBlur(ref.current);
    focused.current = null;
  };
  return { ref, notifyFocus, notifyBlur };
}

/** Props of {@link FormLayout}. */
export interface FormLayoutProps {
  /** Content that scrolls. */
  readonly children: ReactNode;
  /** Content fixed at the bottom, for example the total and the main button. */
  readonly footer: ReactNode;
  readonly contentContainerClassName?: string;
  /** Dialogs and sheets: they go outside the scroll area. */
  readonly overlays?: ReactNode;
}

/**
 * Structure of every screen with text fields (design system 6.10): a scroll area, a fixed
 * footer and the overlays. It avoids the keyboard with `padding` on both platforms, because
 * with edge-to-edge Android no longer resizes the window, and it brings the field that has
 * focus into view: when it receives focus with the keyboard open, and when the scroll area
 * shrinks because the keyboard opened. The footer gives up the bottom safe area while the
 * keyboard covers it. It must start at the top of the window (the native header is hidden
 * in this app); under a native header it would need `keyboardVerticalOffset`.
 */
export function FormLayout({
  children,
  footer,
  contentContainerClassName,
  overlays,
}: FormLayoutProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const focusedField = useRef<HostInstance | null>(null);
  const isReducedMotion = useReducedMotion();
  const isKeyboardVisible = useIsKeyboardVisible();
  const isKeyboardVisibleRef = useRef(isKeyboardVisible);
  useEffect(() => {
    isKeyboardVisibleRef.current = isKeyboardVisible;
  }, [isKeyboardVisible]);

  const ensureVisible = useCallback(
    (target: HostInstance) => {
      const scroll = scrollRef.current;
      const content = scroll?.getInnerViewRef();
      if (!scroll || !content) return;
      target.measureLayout(
        content,
        (_left, fieldTop, _width, fieldHeight) => {
          const y = scrollTargetForField({
            fieldTop,
            fieldHeight,
            scrollY: scrollY.current,
            viewportHeight: viewportHeight.current,
            margin: FIELD_MARGIN,
          });
          if (y !== null) scroll.scrollTo({ y, animated: !isReducedMotion });
        },
        () => undefined,
      );
    },
    [isReducedMotion],
  );

  const focusContext = useMemo<FocusedFieldContextValue>(
    () => ({
      onFieldFocus: (target) => {
        focusedField.current = target;
        if (Keyboard.isVisible()) ensureVisible(target);
      },
      onFieldBlur: (target) => {
        if (focusedField.current === target) focusedField.current = null;
      },
    }),
    [ensureVisible],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    const shrank = height < viewportHeight.current;
    viewportHeight.current = height;
    if (shrank && isKeyboardVisibleRef.current && focusedField.current !== null)
      ensureVisible(focusedField.current);
  };
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  };

  return (
    <KeyboardAvoidingView testID="form-layout" behavior="padding" className="flex-1">
      <ScrollView
        ref={scrollRef}
        testID="form-layout-scroll"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
        onLayout={handleLayout}
        onScroll={handleScroll}
        contentContainerClassName={contentContainerClassName}
      >
        <FocusedFieldContext.Provider value={focusContext}>{children}</FocusedFieldContext.Provider>
      </ScrollView>
      <StyledSafeAreaView
        testID="form-layout-footer"
        edges={
          isKeyboardVisible ? FOOTER_EDGES_WITH_KEYBOARD_OPEN : FOOTER_EDGES_WITH_KEYBOARD_CLOSED
        }
        className="px-4 pt-2 pb-4"
      >
        {footer}
      </StyledSafeAreaView>
      {overlays}
    </KeyboardAvoidingView>
  );
}
