# ADR-001: Expo (React Native) + TypeScript

- **Estado**: Aceptado
- **Fecha**: 2026-11-12

## Contexto
cuantovendi es una app móvil para iOS y Android. El desarrollo se hace desde Linux, por lo que no es posible compilar iOS localmente.

## Opciones consideradas
- React Native con Expo.
- React Native "bare" (sin Expo).
- Flutter / nativo por plataforma.

## Decisión
- **Expo** sobre React Native, que es el camino recomendado hoy por la propia documentación de React Native.
- **Expo Router** para la navegación.
- **TypeScript en modo `strict`**; `any` solo con justificación documentada.
- Dependencias nativas/Expo siempre con `npx expo install` para respetar las versiones compatibles con el SDK.
- Builds y publicación con **EAS** (permite compilar iOS en la nube desde Linux).

## Consecuencias
- Acceso a los módulos `expo-*`, a las actualizaciones OTA y a EAS Build/Submit.
- Las librerías nativas fuera del ecosistema Expo requieren un development build (no funcionan en Expo Go).
- El tooling del agente se apoya en el plugin oficial de Expo (skills + MCP) y en `typescript-lsp`.
