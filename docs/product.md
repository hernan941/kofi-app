# cuantovendi — visión de producto

## Qué es
Un **acompañante de negocio** para el pequeño emprendedor, en especial **artistas que venden su arte**. Funciona como una app de seguimiento periódico (al estilo de un seguidor del ciclo menstrual, pero aplicado al negocio): registrar con constancia, recibir recordatorios, ver el propio ritmo y aprender algo en el camino.

**Objetivo escondido**: que el usuario termine entendiendo su flujo de dinero (cuánto entra, cuánto le cuesta, cuánto le queda) sin que la app se lo exija ni se sienta como contabilidad.

## Para quién
Artistas y pequeños emprendedores, sin conocimientos de gestión ni interés en ellos. La app es simple, cálida y nunca intimidante.

## Principios de producto
- **Registrar tiene que ser rapidísimo**: pocos toques, todo lo opcional escondido hasta que se pida.
- **Nada obligatorio que no sea imprescindible.**
- **Tono positivo**: la app celebra y acompaña, nunca regaña ni culpa.
- **Divulgación progresiva**: los conceptos de negocio (costos, ganancia) aparecen de a poco, cuando el usuario ya tiene datos que les dan sentido.

## Tono y idioma
Cercano, **español neutro**, tuteo ("registra", "vendiste"). Sin regionalismos ni jerga contable.

## Moneda
Solo **pesos chilenos (CLP)**, sin decimales. Formato `$15.000`.

## Features

### 1. Productos
- Nombre (obligatorio), fotos (opcional, varias), descripción (opcional).
- **Versiones**: cada producto tiene al menos una versión. Una versión es el mismo producto en otra modalidad, no una combinación de atributos. Ejemplos para una lámina: "Print A4", "Print A3", "Personalizado (con nombre o dedicatoria)", "Enmarcado", "Original".
  - Cada versión tiene nombre y precio.
  - Una versión puede ser de **precio a convenir** (encargos y personalizados): el precio se ingresa al vender.
  - Si el producto tiene una sola versión, la UI no muestra el concepto de versión.
  - Sin matrices tamaño × color: si hace falta, se crean versiones con nombre.
- **Costo opcional por versión** ("¿cuánto te cuesta hacerlo?"), escondido detrás de "agregar costo". Nunca se pide al crear el producto.
- Los productos se **archivan**, no se borran, para no perder el historial de ventas.
- **Sin stock ni inventario** por ahora.

### 2. Registro de ventas
Un registro agrupa lo vendido en una misma ocasión (por ejemplo, una feria completa):
- **Fecha**: hoy por defecto, fácil de cambiar (el usuario suele registrar al final de la semana).
- **Ítems**: producto + versión, cantidad (1 por defecto) y precio (pre-cargado con el de la versión y editable, lo que cubre descuentos y precios especiales).
- **Dónde vendiste** (opcional): Feria, Redes sociales, Tienda o consignación, Encargo, Otro.
- **Nota** (opcional).
- Botón **"Esta semana no vendí"**: también es un registro válido (como en un seguidor, registrar "nada" es información y mantiene la racha).
- Al guardar se muestra un **consejo** (ver 5).

### 3. Seguimiento (estilo seguidor)
- **Inicio**: cuánto vendiste esta semana y este mes, comparación suave con el período anterior y últimas ventas.
- **Calendario**: días con ventas marcados por intensidad; tocar un día muestra su detalle.
- **Racha**: semanas seguidas registrando (ventas o "no vendí").
- **Resumen mensual**: total vendido, producto más vendido, dónde vendiste más.
- **Ganancia aproximada**: solo aparece cuando los ítems vendidos tienen costo cargado ("te quedaron aprox. $X"). Si solo una parte tiene costo, se calcula sobre esa parte y se aclara: "de lo que tiene costo cargado, te quedaron aprox. $X". Mientras no haya costos, se invita a cargarlos con un consejo, nunca con un campo obligatorio.

### 4. Notificaciones (locales)
- **Recordatorio semanal**: por defecto **domingo 20:00** (cierre de la semana, después de las ferias de fin de semana). El usuario puede cambiar el día y la hora o desactivarlo.
  - El texto se adapta: si ya registró esa semana, invita a revisar si falta algo; si no, invita a registrar o marcar "no vendí".
- **Resumen del mes**: el día 1, "tu resumen de <mes> está listo". Se puede desactivar.
- Nunca mensajes de culpa ("llevas 3 semanas sin…").
- Si la persona deja de abrir la app, el recordatorio semanal **sigue llegando** con un texto neutro y amable (sin datos de la semana). Siempre se puede desactivar desde Ajustes.

### 5. Consejos
- Contenido breve sobre cómo llevar el negocio (para qué sirve registrar, por qué conocer tus costos, cómo poner precio, etc.). Se investiga y redacta como parte de la feature.
- **Se muestran después de registrar una venta**, no en las notificaciones ni en la pantalla de inicio. Uno por vez, se puede cerrar.
- Pueden ser **contextuales** (por ejemplo, si no hay costos cargados, el consejo sobre costos tiene prioridad).
- **Sección "Consejos"** para leerlos todos, con los ya vistos marcados.
- Vienen incluidos en la app; con servidor, se podrán actualizar sin publicar una versión nueva.

### 6. Respaldo y exportación
- **Exportar a CSV** (ventas y productos) para abrir en una planilla.
- **Respaldo completo** (datos e imágenes) a un archivo, que el usuario guarda donde quiera (Drive, iCloud, correo) mediante el menú de compartir del sistema, y **restaurar** desde ese archivo.

## Restricciones
- **Local primero**: al principio todos los datos viven en el teléfono, sin servidor ni cuentas.
- **Preparada para servidor**: la arquitectura debe permitir agregar sincronización con un backend sin reescribir la app.
- Plataformas: **iOS y Android**.

## Decisiones de producto

| Id | Decisión |
|---|---|
| D-01 | La semana va de lunes a domingo (ISO 8601), en la zona horaria del dispositivo. |
| D-02 | Registrar una venta en una semana marcada como "no vendí" quita la marca, en la misma transacción. |
| D-03 | No se permiten ventas con fecha futura. |
| D-04 | Las ventas son editables y borrables, con confirmación al borrar. |
| D-05 | Máximo 6 fotos por producto, desde galería y cámara. |
| D-06 | El permiso de notificaciones se pide después de la primera venta, con una pantalla que explica el beneficio. |
| D-07 | El resumen mensual llega el día 1 a las 10:00. |
| D-08 | Restaurar reemplaza todo, con un respaldo de seguridad automático previo. |
| D-09 | El respaldo va sin contraseña. |
| D-10 | Dos CSV separados: ventas y productos. |
| D-11 | El consejo no aparece en Inicio: solo después de registrar una venta y en la sección "Consejos". |
| D-12 | Tema claro y oscuro según `docs/design-system.md`. |
| D-13 | Si la persona deja de abrir la app, el recordatorio semanal sigue llegando con texto neutro; nunca dos recordatorios en la misma semana. |
| D-14 | Los E2E corren localmente con Maestro en Android al cierre de cada feature. iOS queda para un release futuro. |
| D-15 | Ganancia parcial: "de lo que tiene costo cargado, te quedaron aprox. $X". |
| D-16 | La primera versión de un producto se llama "Estándar" cuando se agrega la segunda (editable). |
| D-17 | La primera foto es la portada; las fotos se pueden reordenar. |
| D-18 | "No vendí" se puede marcar en la semana actual y la anterior. |
| D-19 | Las comparaciones son contra el mismo tramo transcurrido del período anterior. |
| D-20 | "Producto más vendido" y "dónde vendiste más" se miden por monto. |
| D-21 | Los consejos no tratan temas tributarios ni de formalización. |
| D-22 | Se conserva solo el último respaldo de seguridad previo a restaurar. |
| D-31 | Productos: lista ordenada alfabéticamente sin distinguir mayúsculas ni tildes; "ñ" no equivale a "n". |
| D-32 | Nombres de versión únicos solo entre versiones activas; nombres de producto repetidos permitidos. |
| D-33 | "Quitar" una versión decide sola: con ventas activas se archiva, sin ventas se borra lógicamente. Las versiones archivadas no se reactivan en v1. |
| D-34 | Precio fijo de $0 permitido. Si la segunda versión se llama "Estándar", la primera pasa a "Estándar 2". |
| D-35 | Fotos: se reordenan con "Usar como portada" y "Mover antes/después" (sin arrastrar); quitar pide confirmación; sin pantalla previa al permiso de cámara (si se niega, mensaje con "Abrir ajustes"); al salir sin guardar las fotos nuevas se descartan; la foto se ve en grande sin zoom. |
| D-36 | Primera venta = primer registro en la historia del dispositivo (incluye borrados). La edición de una venta no celebra: aviso y vuelta al detalle. |
| D-37 | "No vendí": botón secundario en el registro de venta; tras marcar, aviso y se sigue en el registro; se puede desmarcar en la semana actual y la anterior. El id es UUIDv5 de la cadena `YYYY-MM-DD` del lunes. |
| D-38 | Ventas: sin fecha mínima; hasta 100 ítems por registro; se permiten ítems repetidos de la misma versión; al editar, un ítem de producto archivado se conserva. |
| D-39 | Inicio: ganancia aproximada solo del mes; 5 últimas ventas; la comparación muestra el monto de diferencia y es "igual" solo con montos idénticos. El resumen mensual navega hasta el primer mes con ventas. |
| D-40 | "Más vendido": empates juntos, por nombre; con máximo $0 no se muestra. Ventas sin canal no compiten; si ninguna tiene canal, la sección no aparece. |
| D-41 | Calendario: intensidad relativa al día de más monto del mes, en 3 niveles; "N ventas" cuenta registros; "no vendí" por semana (actual y anterior); la racha se ve en Calendario e Inicio; al cambiar de mes con la app abierta, se queda en el mes visto. |
| D-42 | Consejos: contexto "racha" desde 3 semanas; prioridad sin-costos > primera-venta > venta-feria > racha > sin-canal; un consejo cuenta como visto al mostrarse; un consejo en cada venta nueva (rotando); sin fuentes en la app; "no vendí" y editar no muestran consejo. |
| D-23 | Todo es local: sin publicación, cuentas de tiendas, EAS, reporte de errores externo ni servicios en la nube. No se asume iPhone ni cuenta de EAS; iOS se verifica en el futuro. |
| D-24 | Sin ganchos de git (husky o lint-staged). |
| D-25 | En una semana que ya tiene ventas no se ofrece "no vendí"; un texto amable explica por qué. |
| D-26 | Costo efectivo de un ítem: el costo copiado al vender y, si no había, el costo actual de la versión. |
| D-27 | Límites de longitud: nombre de producto y de versión 80, descripción 1000 y nota 500 caracteres. |
| D-28 | Las preferencias de notificación no viajan en el respaldo: son del dispositivo y se mantienen al restaurar. |
| D-29 | En iOS no se usa la autorización provisional de notificaciones: se pide el permiso normal con la pantalla explicativa. |
| D-30 | El resumen mensual se puede ver para cualquier mes con datos, navegando hacia atrás. |

## Alcance de la v1
La v1 es una app funcional que corre en el entorno de desarrollo local. **No se publica** en tiendas ni usa servicios externos (EAS, reporte de errores en la nube, cuentas de desarrollador). La publicación queda para una versión futura.

## Fuera de alcance por ahora
Stock e inventario, registro de gastos generales (materiales, puesto en la feria), medios de pago, clientes, multimoneda, cuentas de usuario.
Candidato natural para una fase siguiente: **gastos simples**, para completar el flujo de dinero.
