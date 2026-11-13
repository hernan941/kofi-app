import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { announce, useAnnounceWhen } from './announce';

/** Props of the probe component that announces a message. */
interface ProbeProps {
  readonly message: string | undefined;
}

function Probe({ message }: ProbeProps) {
  useAnnounceWhen(message);
  return null;
}

describe('announce', () => {
  it('sends the message to the screen reader', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    announce('Venta guardada');

    expect(spy).toHaveBeenCalledWith('Venta guardada');
  });
});

describe('useAnnounceWhen', () => {
  it('announces each new message once and ignores empty ones', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { rerender } = await render(<Probe message={undefined} />);

    await rerender(<Probe message="Escribe un precio" />);
    await rerender(<Probe message="Escribe un precio" />);
    await rerender(<Probe message={undefined} />);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Escribe un precio');
  });
});
