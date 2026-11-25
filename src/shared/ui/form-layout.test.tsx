import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Keyboard, Platform, ScrollView, Text, View, type KeyboardEventName } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FormLayout, scrollTargetForField } from './form-layout';
import { QuantityStepper } from './quantity-stepper';
import { renderUi } from './testing/render-ui';
import { TextField } from './text-field';

jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () =>
  jest.requireActual<object>('./testing/exposed-keyboard-avoiding-view'),
);

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
}));

/** Waits for React to apply an event (in RNTL 14 `fireEvent` returns a promise). */
async function settle(pending: Promise<unknown>) {
  await pending;
}

type Listener = () => void;

const FIELD_VIEW = { x: 0, width: 300 } as const;

/** Simulates the keyboard: its visibility and the events the layout listens to. */
function mockKeyboard(isVisible: boolean) {
  const listeners = new Map<string, Listener>();
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(isVisible);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name: KeyboardEventName, listener) => {
    listeners.set(name, listener as Listener);
    return { remove: jest.fn() };
  });
  return listeners;
}

/** Makes every field measure at the given position inside the scroll content and returns `scrollTo`. */
function mockMeasurement(fieldTop: number, fieldHeight: number) {
  jest.spyOn(ScrollView.prototype, 'getInnerViewRef').mockReturnValue({});
  jest.spyOn(View.prototype, 'measureLayout').mockImplementation(((
    _: unknown,
    onSuccess: unknown,
  ) => {
    (onSuccess as (...args: number[]) => void)(
      FIELD_VIEW.x,
      fieldTop,
      FIELD_VIEW.width,
      fieldHeight,
    );
  }) as never);
  return jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
}

/** Emits the scroll view `layout` event with the given visible height. */
async function layoutScroll(height: number) {
  await settle(
    fireEvent(screen.getByTestId('form-layout-scroll'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
    }),
  );
}

/** Renders a form with one text field and optional footer content. */
function renderForm() {
  return renderUi(
    <FormLayout
      footer={<Text>Pie</Text>}
      overlays={<Text>Diálogo</Text>}
      contentContainerClassName="gap-4"
    >
      <TextField label="Precio" value="" onChangeText={jest.fn()} />
    </FormLayout>,
  );
}

describe('scrollTargetForField', () => {
  const base = { viewportHeight: 400, margin: 16 } as const;

  it('does not move when the whole field is already visible', () => {
    expect(
      scrollTargetForField({ ...base, fieldTop: 100, fieldHeight: 60, scrollY: 0 }),
    ).toBeNull();
  });

  it('scrolls just enough to show a field that goes out at the bottom', () => {
    expect(scrollTargetForField({ ...base, fieldTop: 380, fieldHeight: 60, scrollY: 0 })).toBe(56);
  });

  it('aligns a field that goes out at the top', () => {
    expect(scrollTargetForField({ ...base, fieldTop: 50, fieldHeight: 60, scrollY: 200 })).toBe(34);
  });

  it('aligns the start of a field taller than the visible area', () => {
    expect(scrollTargetForField({ ...base, fieldTop: 600, fieldHeight: 500, scrollY: 0 })).toBe(
      584,
    );
  });

  it('never returns a negative position', () => {
    expect(scrollTargetForField({ ...base, fieldTop: 8, fieldHeight: 32, scrollY: 100 })).toBe(0);
  });
});

describe('FormLayout', () => {
  beforeEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it.each(['android', 'ios'] as const)('avoids the keyboard with padding on %s', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    mockKeyboard(false);

    await renderForm();

    expect(screen.getByTestId('form-layout')).toHaveProp('behavior', 'padding');
  });

  it('keeps taps working while the keyboard is open', async () => {
    mockKeyboard(false);

    await renderForm();

    expect(screen.getByTestId('form-layout-scroll')).toHaveProp(
      'keyboardShouldPersistTaps',
      'handled',
    );
  });

  it('drops the bottom safe area of the footer while the keyboard is open', async () => {
    const listeners = mockKeyboard(false);
    jest.replaceProperty(Platform, 'OS', 'android');
    await renderForm();
    expect(screen.getByTestId('form-layout-footer')).toHaveProp(
      'edges',
      expect.objectContaining({ bottom: 'additive' }),
    );

    await act(() => {
      listeners.get('keyboardDidShow')?.();
    });
    expect(screen.getByTestId('form-layout-footer')).toHaveProp(
      'edges',
      expect.objectContaining({ bottom: 'off' }),
    );

    await act(() => {
      listeners.get('keyboardDidHide')?.();
    });
    expect(screen.getByTestId('form-layout-footer')).toHaveProp(
      'edges',
      expect.objectContaining({ bottom: 'additive' }),
    );
  });

  it('draws the footer and the overlays outside the scroll area', async () => {
    mockKeyboard(false);

    await renderForm();

    const scroll = screen.getByTestId('form-layout-scroll');
    expect(within(scroll).getByLabelText('Precio')).toBeOnTheScreen();
    expect(within(scroll).queryByText('Pie')).not.toBeOnTheScreen();
    expect(within(scroll).queryByText('Diálogo')).not.toBeOnTheScreen();
    expect(within(screen.getByTestId('form-layout-footer')).getByText('Pie')).toBeOnTheScreen();
    expect(screen.getByText('Diálogo')).toBeOnTheScreen();
  });

  it('scrolls to a field that receives focus when the keyboard is already open', async () => {
    mockKeyboard(true);
    const scrollTo = mockMeasurement(380, 60);
    await renderForm();
    await layoutScroll(400);

    await settle(fireEvent(screen.getByLabelText('Precio'), 'focus'));

    expect(scrollTo).toHaveBeenCalledWith({ y: 56, animated: true });
  });

  it('does not scroll on focus while the keyboard is closed, but does when the area shrinks after it opens', async () => {
    const listeners = mockKeyboard(false);
    jest.replaceProperty(Platform, 'OS', 'android');
    const scrollTo = mockMeasurement(380, 60);
    await renderForm();
    await layoutScroll(400);

    await settle(fireEvent(screen.getByLabelText('Precio'), 'focus'));
    expect(scrollTo).not.toHaveBeenCalled();

    await act(() => {
      listeners.get('keyboardDidShow')?.();
    });
    await layoutScroll(300);
    expect(scrollTo).toHaveBeenCalledWith({ y: 156, animated: true });
  });

  it('does not scroll when the area shrinks while the keyboard is closed', async () => {
    mockKeyboard(false);
    const scrollTo = mockMeasurement(380, 60);
    await renderForm();
    await layoutScroll(400);
    await settle(fireEvent(screen.getByLabelText('Precio'), 'focus'));

    await layoutScroll(300);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('forgets a focused field that is removed from the form', async () => {
    mockKeyboard(true);
    const scrollTo = mockMeasurement(380, 60);
    const { rerender } = await renderForm();
    await layoutScroll(400);
    await settle(fireEvent(screen.getByLabelText('Precio'), 'focus'));
    scrollTo.mockClear();

    await rerender(<FormLayout footer={null}>{null}</FormLayout>);
    await layoutScroll(300);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll when the focused field is already visible', async () => {
    mockKeyboard(true);
    const scrollTo = mockMeasurement(100, 60);
    await renderForm();
    await layoutScroll(400);

    await settle(fireEvent(screen.getByLabelText('Precio'), 'focus'));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops following the field after it loses focus', async () => {
    mockKeyboard(false);
    const scrollTo = mockMeasurement(380, 60);
    await renderForm();
    await layoutScroll(400);
    await settle(fireEvent(screen.getByLabelText('Precio'), 'focus'));
    await settle(fireEvent(screen.getByLabelText('Precio'), 'blur'));

    await layoutScroll(300);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls without animation when the system asks to reduce motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    mockKeyboard(true);
    const scrollTo = mockMeasurement(380, 60);
    await renderForm();
    await layoutScroll(400);

    await settle(fireEvent(screen.getByLabelText('Precio'), 'focus'));

    expect(scrollTo).toHaveBeenCalledWith({ y: 56, animated: false });
  });

  it('also reveals a quantity stepper that receives focus', async () => {
    mockKeyboard(true);
    const scrollTo = mockMeasurement(380, 60);
    await renderUi(
      <FormLayout footer={null}>
        <QuantityStepper label="Cantidad" value={2} onChange={jest.fn()} />
      </FormLayout>,
    );
    await layoutScroll(400);

    await settle(fireEvent(screen.getByLabelText('Cantidad'), 'focus'));

    expect(scrollTo).toHaveBeenCalledWith({ y: 56, animated: true });
  });
});
