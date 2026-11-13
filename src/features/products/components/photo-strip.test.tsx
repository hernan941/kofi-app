import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Linking } from 'react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { usePhotoImports } from '../hooks/use-photo-imports';
import { testPhotoId } from '../testing/in-memory-photo-storage';
import { PhotoStrip } from './photo-strip';
import type { PhotoFormValue } from './product-form-schema';

const user = userEvent.setup();

const photo = (n: number, isNew = false): PhotoFormValue => ({
  photoId: testPhotoId(n),
  width: 100,
  height: 50,
  byteSize: 10,
  sha256: 'd'.repeat(64),
  isNew,
});

function Harness({
  initial,
  onPhotos,
}: {
  readonly initial: readonly PhotoFormValue[];
  readonly onPhotos?: (photos: readonly PhotoFormValue[]) => void;
}) {
  const [photos, setPhotos] = useState<readonly PhotoFormValue[]>(initial);
  const imports = usePhotoImports({
    photoCount: photos.length,
    onImported: (added) => {
      const next = [
        ...photos,
        ...added.map(({ id, ...rest }) => ({ ...rest, photoId: id, isNew: true })),
      ];
      setPhotos(next);
      onPhotos?.(next);
      return next.length;
    },
  });
  return (
    <PhotoStrip
      photos={photos}
      productName="Lámina"
      imports={imports}
      onChange={(next) => {
        setPhotos(next);
        onPhotos?.(next);
      }}
      onRemove={(removed) => {
        const next = photos.filter((item) => item.photoId !== removed.photoId);
        setPhotos(next);
        onPhotos?.(next);
      }}
    />
  );
}

const some = (count: number) => Array.from({ length: count }, (_, index) => photo(index + 1));

describe('PhotoStrip', () => {
  it('shows 0 de 6, the help for no photos and both buttons when empty', async () => {
    await renderWithProviders(<Harness initial={[]} />);

    expect(screen.getByText('0 de 6')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Una buena foto te ayuda a reconocer el producto al registrar ventas. La primera es la portada.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Galería' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cámara' })).toBeOnTheScreen();
  });

  it('replaces both buttons with an explanation at 6 photos', async () => {
    await renderWithProviders(<Harness initial={some(6)} />);

    expect(screen.getByText('6 de 6')).toBeOnTheScreen();
    expect(
      screen.getByText('Ya tienes 6 fotos, el máximo. Para agregar otra, quita una.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Galería' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cámara' })).not.toBeOnTheScreen();
  });

  it('asks the library picker for the room that is left and adds the photos', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a', 'b']);
    await renderWithProviders(<Harness initial={some(3)} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Galería' }));

    expect(dependencies.photoPicker.libraryCalls).toEqual([3]);
    expect(await screen.findByText('5 de 6')).toBeOnTheScreen();
  });

  it('shows no message when the library is cancelled', async () => {
    const dependencies = createTestDependencies();
    await renderWithProviders(<Harness initial={some(1)} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Galería' }));

    await waitFor(() => {
      expect(dependencies.photoPicker.libraryCalls).toEqual([5]);
    });
    expect(screen.getByText('1 de 6')).toBeOnTheScreen();
    expect(screen.queryByText(/No pudimos/)).not.toBeOnTheScreen();
  });

  it('opens the camera and imports the photo taken', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willTake({ kind: 'taken', uri: 'camera' });
    await renderWithProviders(<Harness initial={[]} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Cámara' }));

    expect(await screen.findByText('1 de 6')).toBeOnTheScreen();
    expect(dependencies.photoPicker.cameraCalls).toBe(1);
  });

  it('offers to open the settings when the camera permission is denied', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willTake({ kind: 'permission_denied', canAskAgain: false });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderWithProviders(<Harness initial={[]} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Cámara' }));

    expect(await screen.findByText('La cámara no tiene permiso')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Abrir ajustes' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('closes the permission message with "Ahora no" without opening the settings', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willTake({ kind: 'permission_denied', canAskAgain: true });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderWithProviders(<Harness initial={[]} />, { dependencies });
    await user.press(screen.getByRole('button', { name: 'Cámara' }));
    await screen.findByText('La cámara no tiene permiso');

    await user.press(screen.getByRole('button', { name: 'Ahora no' }));

    await waitFor(() => {
      expect(screen.queryByText('La cámara no tiene permiso')).not.toBeOnTheScreen();
    });
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('says which photo could not be added and keeps the others', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a', 'b', 'c']);
    dependencies.photos.failImportOf('b', 'unreadable');
    await renderWithProviders(<Harness initial={[]} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Galería' }));

    expect(await screen.findByText('2 de 6')).toBeOnTheScreen();
    expect(screen.getByText('No pudimos abrir esta imagen. Prueba con otra.')).toBeOnTheScreen();
  });

  it('uses the plural message when several photos fail', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a', 'b', 'c']);
    dependencies.photos.failImportOf('a', 'unreadable');
    dependencies.photos.failImportOf('b', 'write_failed');
    await renderWithProviders(<Harness initial={[]} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Galería' }));

    expect(
      await screen.findByText(
        'No pudimos agregar 2 de las fotos. Prueba con otras o inténtalo de nuevo.',
      ),
    ).toBeOnTheScreen();
  });

  it('tells when the library cannot be opened', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(new Error('boom'));
    await renderWithProviders(<Harness initial={[]} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'Galería' }));

    expect(
      (await screen.findAllByText('No se pudo abrir la galería. Inténtalo de nuevo.')).length,
    ).toBeGreaterThan(0);
  });

  it('labels each photo with its position and marks the cover', async () => {
    await renderWithProviders(<Harness initial={some(3)} />);

    expect(screen.getByRole('button', { name: 'Foto 1 de 3, portada' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Foto 2 de 3' })).toBeOnTheScreen();
    expect(screen.getByText('Portada')).toBeOnTheScreen();
  });

  it('keeps the inner image out of the accessibility tree so each photo is one button', async () => {
    await renderWithProviders(<Harness initial={some(2)} />);

    expect(screen.queryAllByRole('image')).toHaveLength(0);
    expect(screen.getByTestId(`photo-${testPhotoId(1)}`).props.accessible).toBe(false);
  });

  it('adds "no se puede mostrar" to the button label when the file is missing', async () => {
    await renderWithProviders(<Harness initial={some(2)} />);

    void fireEvent(screen.getByTestId(`photo-${testPhotoId(2)}`), 'error', {
      nativeEvent: { error: 'missing' },
    });

    expect(
      await screen.findByRole('button', { name: 'Foto 2 de 2, no se puede mostrar' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Foto 1 de 2, portada' })).toBeOnTheScreen();
  });

  it('makes a photo the cover from its sheet', async () => {
    const onPhotos = jest.fn((_photos: readonly PhotoFormValue[]) => undefined);
    await renderWithProviders(<Harness initial={some(3)} onPhotos={onPhotos} />);

    await user.press(screen.getByRole('button', { name: 'Foto 3 de 3' }));
    expect(screen.getByRole('header', { name: 'Foto 3 de 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mover después' })).toBeDisabled();
    await user.press(screen.getByRole('button', { name: 'Usar como portada' }));

    expect(onPhotos.mock.lastCall?.[0].map((item) => item.photoId)).toEqual([
      testPhotoId(3),
      testPhotoId(1),
      testPhotoId(2),
    ]);
    expect(screen.getByRole('header', { name: 'Foto 1 de 3' })).toBeOnTheScreen();
  });

  it('moves a photo one place earlier', async () => {
    const onPhotos = jest.fn((_photos: readonly PhotoFormValue[]) => undefined);
    await renderWithProviders(<Harness initial={some(3)} onPhotos={onPhotos} />);

    await user.press(screen.getByRole('button', { name: 'Foto 2 de 3' }));
    await user.press(screen.getByRole('button', { name: 'Mover antes' }));

    expect(onPhotos.mock.lastCall?.[0].map((item) => item.photoId)).toEqual([
      testPhotoId(2),
      testPhotoId(1),
      testPhotoId(3),
    ]);
  });

  it('asks before removing, keeps everything on cancel and removes on confirm', async () => {
    const onPhotos = jest.fn((_photos: readonly PhotoFormValue[]) => undefined);
    await renderWithProviders(<Harness initial={some(3)} onPhotos={onPhotos} />);

    await user.press(screen.getByRole('button', { name: 'Foto 2 de 3' }));
    await user.press(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(await screen.findByText('¿Quitar esta foto?')).toBeOnTheScreen();
    expect(screen.getByText('Se quita del producto cuando guardes los cambios.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onPhotos).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Quitar foto' }));
    await user.press(await screen.findByRole('button', { name: 'Quitar foto', hidden: false }));

    await waitFor(() => {
      expect(screen.getByText('2 de 6')).toBeOnTheScreen();
    });
  });

  it('uses the other description for a photo added in this session', async () => {
    await renderWithProviders(<Harness initial={[photo(1, true)]} />);

    await user.press(screen.getByRole('button', { name: 'Foto 1 de 1, portada' }));
    await user.press(screen.getByRole('button', { name: 'Quitar foto' }));

    expect(
      await screen.findByText(
        'Se quita de este producto. Si la quieres de nuevo, vuelve a elegirla.',
      ),
    ).toBeOnTheScreen();
  });

  describe('cells being prepared', () => {
    function holdImports(dependencies: ReturnType<typeof createTestDependencies>) {
      const original = dependencies.photos.importFromPicker.bind(dependencies.photos);
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      jest.spyOn(dependencies.photos, 'importFromPicker').mockImplementation(async (uri, id) => {
        await gate;
        return original(uri, id);
      });
      return release;
    }

    it('groups them under one label with the count and takes the room they use', async () => {
      const dependencies = createTestDependencies();
      dependencies.photoPicker.willPick(['a', 'b']);
      const release = holdImports(dependencies);
      await renderWithProviders(<Harness initial={some(1)} />, { dependencies });

      await user.press(screen.getByRole('button', { name: 'Galería' }));

      expect(await screen.findByLabelText('Preparando 2 fotos')).toBeOnTheScreen();
      expect(screen.getByText('3 de 6')).toBeOnTheScreen();
      release();
      expect(await screen.findByText('3 de 6')).toBeOnTheScreen();
      await waitFor(() => {
        expect(screen.queryByLabelText('Preparando 2 fotos')).not.toBeOnTheScreen();
      });
    });

    it('uses the singular for a single photo', async () => {
      const dependencies = createTestDependencies();
      dependencies.photoPicker.willTake({ kind: 'taken', uri: 'camera' });
      const release = holdImports(dependencies);
      await renderWithProviders(<Harness initial={[]} />, { dependencies });

      await user.press(screen.getByRole('button', { name: 'Cámara' }));

      expect(await screen.findByLabelText('Preparando 1 foto')).toBeOnTheScreen();
      release();
      await screen.findByText('1 de 6');
    });
  });

  describe('announcements', () => {
    let announce: jest.SpyInstance;

    beforeEach(() => {
      announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
    });

    it('announces the photos added, in singular and plural', async () => {
      const dependencies = createTestDependencies();
      dependencies.photoPicker.willPick(['a', 'b']);
      dependencies.photoPicker.willTake({ kind: 'taken', uri: 'camera' });
      await renderWithProviders(<Harness initial={[]} />, { dependencies });

      await user.press(screen.getByRole('button', { name: 'Galería' }));
      await screen.findByText('2 de 6');
      await user.press(screen.getByRole('button', { name: 'Cámara' }));
      await screen.findByText('3 de 6');

      expect(announce).toHaveBeenCalledWith('Agregaste 2 fotos. Tienes 2 de 6.');
      expect(announce).toHaveBeenCalledWith('Agregaste la foto. Tienes 3 de 6.');
    });

    it('announces the new cover and the new place after moving', async () => {
      await renderWithProviders(<Harness initial={some(3)} />);

      await user.press(screen.getByRole('button', { name: 'Foto 3 de 3' }));
      await user.press(screen.getByRole('button', { name: 'Usar como portada' }));
      expect(announce).toHaveBeenCalledWith('Ahora es la portada.');

      await user.press(screen.getByRole('button', { name: 'Mover después' }));
      expect(announce).toHaveBeenCalledWith('Ahora es la foto 2 de 3.');
    });

    it('announces the removal with what is left', async () => {
      await renderWithProviders(<Harness initial={some(3)} />);

      await user.press(screen.getByRole('button', { name: 'Foto 2 de 3' }));
      await user.press(screen.getByRole('button', { name: 'Quitar foto' }));
      await user.press(await screen.findByRole('button', { name: 'Quitar foto', hidden: false }));

      await waitFor(() => {
        expect(announce).toHaveBeenCalledWith('Quitaste la foto. Tienes 2 de 6.');
      });
    });
  });

  describe('selection trimmed by the picker', () => {
    it('says how many were added and announces it, and clears it on the next try', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
      const dependencies = createTestDependencies();
      dependencies.photoPicker.willPick(['a', 'b', 'c']);
      await renderWithProviders(<Harness initial={some(4)} />, { dependencies });

      await user.press(screen.getByRole('button', { name: 'Galería' }));

      expect(
        await screen.findByText('Agregamos 2: es el espacio que te quedaba.'),
      ).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith('Agregamos 2: es el espacio que te quedaba.');
    });

    it('shows nothing when the selection fits', async () => {
      const dependencies = createTestDependencies();
      dependencies.photoPicker.willPick(['a', 'b']);
      await renderWithProviders(<Harness initial={[]} />, { dependencies });

      await user.press(screen.getByRole('button', { name: 'Galería' }));

      await screen.findByText('2 de 6');
      expect(screen.queryByText(/espacio que te quedaba/)).not.toBeOnTheScreen();
    });
  });

  describe('screen reader focus', () => {
    it('moves the focus to the sheet title after "Usar como portada"', async () => {
      const setFocus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
      await renderWithProviders(<Harness initial={some(3)} />);
      await user.press(screen.getByRole('button', { name: 'Foto 3 de 3' }));
      setFocus.mockClear();

      await user.press(screen.getByRole('button', { name: 'Usar como portada' }));

      await waitFor(() => {
        expect(setFocus).toHaveBeenCalledWith(expect.anything(), 'focus');
      });
    });

    it('moves the focus to the first thumbnail after removing a photo', async () => {
      const setFocus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
      await renderWithProviders(<Harness initial={some(3)} />);
      await user.press(screen.getByRole('button', { name: 'Foto 2 de 3' }));
      await user.press(screen.getByRole('button', { name: 'Quitar foto' }));
      expect(setFocus).not.toHaveBeenCalled();

      await user.press(await screen.findByRole('button', { name: 'Quitar foto', hidden: false }));

      await waitFor(() => {
        expect(setFocus).toHaveBeenCalledTimes(1);
      });
    });

    it('moves the focus to the "Galería" button when no photo is left', async () => {
      const setFocus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
      await renderWithProviders(<Harness initial={some(1)} />);
      await user.press(screen.getByRole('button', { name: 'Foto 1 de 1, portada' }));
      await user.press(screen.getByRole('button', { name: 'Quitar foto' }));

      await user.press(await screen.findByRole('button', { name: 'Quitar foto', hidden: false }));

      await waitFor(() => {
        expect(setFocus).toHaveBeenCalledTimes(1);
      });
      expect(setFocus.mock.calls[0]?.[0]).toBeTruthy();
    });
  });
});
