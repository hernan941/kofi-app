import { fireEvent, screen } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { testPhotoId } from '../testing/in-memory-photo-storage';
import { ProductPhoto } from './product-photo';

const missingFileEvent = () => ({ nativeEvent: { error: 'missing' } });

function setup() {
  const dependencies = createTestDependencies();
  const element = <ProductPhoto photoId={testPhotoId(1)} label="Foto 1 de 3" className="size-20" />;
  return { dependencies, element };
}

describe('ProductPhoto', () => {
  it('draws the stored file with an accessible label and a recycling key', async () => {
    const { dependencies, element } = setup();
    await renderWithProviders(element, { dependencies });

    const image = screen.getByLabelText('Foto 1 de 3');

    expect(image.props.source).toEqual([{ uri: dependencies.photos.uriFor(testPhotoId(1)) }]);
    expect(image.props.recyclingKey).toBe(testPhotoId(1));
    expect(image.props.cachePolicy).toBe('memory');
  });

  it('shows a neutral placeholder when the file is missing and logs it once per photo', async () => {
    const { dependencies, element } = setup();
    const view = await renderWithProviders(element, { dependencies });

    void fireEvent(screen.getByLabelText('Foto 1 de 3'), 'error', missingFileEvent());

    expect(await screen.findByLabelText('Foto 1 de 3, no se puede mostrar')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Foto 1 de 3')).not.toBeOnTheScreen();
    expect(dependencies.logger.entriesAt('warn')).toEqual([
      expect.objectContaining({
        event: 'photo_file_missing',
        context: { id: testPhotoId(1) },
      }),
    ]);

    await view.unmount();
    await renderWithProviders(element, { dependencies });
    void fireEvent(screen.getByLabelText('Foto 1 de 3'), 'error', missingFileEvent());

    await screen.findByLabelText('Foto 1 de 3, no se puede mostrar');
    expect(dependencies.logger.entriesAt('warn')).toHaveLength(1);
  });

  it('hides a decorative photo with the three attributes', async () => {
    const { dependencies } = setup();
    await renderWithProviders(
      <ProductPhoto
        photoId={testPhotoId(1)}
        label="Foto 1 de 3"
        isDecorative
        testID="deco"
        className="size-20"
      />,
      { dependencies },
    );

    const image = screen.getByTestId('deco', { includeHiddenElements: true });

    expect(image).toHaveProp('accessible', false);
    expect(image).toHaveProp('accessibilityElementsHidden', true);
    expect(image).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });
});
