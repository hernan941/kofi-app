# Fixtures del ZIP

- `standard-tool-stored.zip`: ZIP STORED escrito por una herramienta estándar, no por el escritor propio. Tiene `manifest.json`, `data.json` y una foto cuyos datos contienen las firmas `PK\x03\x04`, `PK\x07\x08`, `PK\x01\x02` y `PK\x05\x06`.

Receta (el entorno de desarrollo no tenía `zip`; se usó el módulo `zipfile` de Python, que produce lo mismo que `zip -0 -X -D`: método 0, sin extras, sin comentario ni descriptores de datos, y atributos externos de Unix que el lector ignora):

```python
import zipfile
photo = b'JPEGDATA' + b'PK\x03\x04' + b'PK\x07\x08' + b'PK\x01\x02' + b'PK\x05\x06' + bytes(range(256)) + b'END'
entries = [
    ('manifest.json', b'{"format":"cuantovendi-backup"}\n'),
    ('data.json', b'{"products":[]}\n'),
    ('photos/00000000-0000-7000-8000-000000000001.jpg', photo),
]
with zipfile.ZipFile('standard-tool-stored.zip', 'w', zipfile.ZIP_STORED) as z:
    for name, data in entries:
        info = zipfile.ZipInfo(name, date_time=(2026, 11, 13, 12, 0, 0))
        info.compress_type = zipfile.ZIP_STORED
        info.external_attr = 0o644 << 16
        info.create_system = 3
        z.writestr(info, data)
```

Los casos adversariales no se guardan: los genera `testing/zip-fixture-builder.ts` dentro de `archive.test.ts`.
