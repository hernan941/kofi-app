# ADR-004: Framework de UI — HeroUI Native + Uniwind

- **Estado**: Aceptado
- **Fecha**: 2026-11-12

## Contexto
Se necesita una base de componentes y un sistema de estilos para construir el sistema de diseño. Prioridades: identidad visual propia e igual en iOS y Android, buen rendimiento, mantenibilidad y personalización mediante tokens. El usuario no tiene formación en diseño, así que se valoran buenos valores por defecto.

## Opciones consideradas
- **React Native Paper**: Material Design 3, muy maduro y rápido (StyleSheet), pero con aspecto de Android en iOS y poco personalizable.
- **React Native Reusables (NativeWind)**: componentes copiados al proyecto, control total; NativeWind v4 agrega costo en tiempo de ejecución.
- **HeroUI Native (Uniwind)**: componentes pulidos, animaciones y modo oscuro incluidos; Uniwind procesa Tailwind casi todo al compilar y es más rápido que NativeWind.
- **gluestack-ui, Tamagui, RN UI Lib, @expo/ui, sistema propio (Unistyles/Restyle)**: descartadas por madurez, complejidad, aspecto distinto por plataforma, menor encaje con TDD o porque habría que construir y mantener todos los componentes.

## Decisión
- Usar **HeroUI Native** (`heroui-native`) como librería de componentes, sobre **Uniwind** (Tailwind CSS v4).
- **Solo la versión open source (Apache 2.0). No se usa HeroUI Native Pro** ni ningún componente o plantilla de pago.
- Los componentes que falten los construye el `designer` sobre los mismos tokens del sistema de diseño.

## Consecuencias
- Los estilos se escriben con clases de Tailwind (`className`); los colores y espaciados salen de los tokens del tema, nunca valores a mano.
- Dependemos de las versiones de `heroui-native` y de Uniwind: las actualizaciones se revisan con cada cambio de SDK de Expo.
- Uniwind no es compatible con React Native Boost; no usar esa librería.
- La licencia Apache 2.0 exige conservar el aviso de licencia (pantalla de licencias de terceros cuando se publique).
- Queda pendiente el sistema de diseño (paleta, tipografía, tokens), que define el `designer` en `docs/design-system.md`.
