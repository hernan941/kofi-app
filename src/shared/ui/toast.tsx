import { Toast, useToast, type ToastComponentProps } from 'heroui-native';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { View } from 'react-native';

import { announce } from './announce';
import { Icon } from './icon';

/** Kind of on-screen notice. */
type ToastKind = 'success' | 'error';

/** Minimum time a notice stays on screen, in milliseconds (design system 6.6). */
export const TOAST_DURATION_MS = 4000;

/** Functions that show the app notices. */
export interface AppToast {
  readonly showSuccess: (message: string) => void;
  readonly showError: (message: string) => void;
}

/** Props of {@link AppToastView}. */
interface AppToastViewProps extends ToastComponentProps {
  readonly kind: ToastKind;
  readonly message: string;
}

/**
 * Bruma look of a notice: overlay fill, sticker border and shadow, icon, text and close button.
 * It is hidden from the screen reader, measuring copy included, and has no live region:
 * `useAppToast` announces the message once with `announce`, so it is never read twice and no
 * invisible "Cerrar aviso" button is left in the focus order.
 */
function AppToastView({ kind, message, ...toastProps }: AppToastViewProps) {
  return (
    <Toast
      {...toastProps}
      placement="bottom"
      aria-live="off"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="mx-4 flex-row items-center gap-3 rounded-3xl border-2 border-border bg-overlay p-4 shadow-sticker"
    >
      {kind === 'success' ? (
        <Icon icon={CheckCircleIcon} weight="fill" color="accent" />
      ) : (
        <Icon icon={WarningCircleIcon} color="danger" />
      )}
      <View className="flex-1">
        <Toast.Title className="font-medium text-base text-foreground">{message}</Toast.Title>
      </View>
      <Toast.Close
        aria-label="Cerrar aviso"
        className="h-auto min-h-12 min-w-12 rounded-full bg-transparent p-3"
      >
        <Icon icon={XIcon} />
      </Toast.Close>
    </Toast>
  );
}

/**
 * Shows on-screen notices (design system 6.6) with the HeroUI toast: at the bottom, at
 * least four seconds, closable by touch and announced once to the screen reader. Success carries the
 * filled `CheckCircle`, errors the `WarningCircle` and a message that says what to do.
 * Never use it for something that needs an action: that goes in a dialog or the form.
 */
export function useAppToast(): AppToast {
  const { toast } = useToast();
  const show = (kind: ToastKind, message: string) => {
    toast.show({
      duration: TOAST_DURATION_MS,
      component: (props) => <AppToastView {...props} kind={kind} message={message} />,
    });
    announce(message);
  };
  return {
    showSuccess: (message) => {
      show('success', message);
    },
    showError: (message) => {
      show('error', message);
    },
  };
}
