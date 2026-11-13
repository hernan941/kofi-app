import { describePhotoStorageContract } from '../adapters/photo-storage.contract';
import { InMemoryPhotoStorage } from './in-memory-photo-storage';

describePhotoStorageContract('InMemory', () => {
  const storage = new InMemoryPhotoStorage();
  return {
    storage,
    newSource: () => 'file:///test/cache/ImagePicker/source.jpg',
    sourceExists: (uri) => !storage.deletedSources.includes(uri),
  };
});
