# React Native / Expo rules

Adaptado de [affaan-m/ECC `rules/react-native`](https://github.com/affaan-m/ECC/tree/main/rules/react-native) (commit `d2ef268`, 2026-11-06), licencia MIT, Copyright (c) 2026 Affaan Mustafa.

Cambios respecto del original:
- Se quitaron todas las dependencias de `rules/common/` y `rules/typescript/`, y las referencias a herramientas de ECC (agentes `tdd-guide`, AgentShield, variables `ECC_*`).
- Testing alineado con ADR-002 (TDD, Maestro al cierre de la feature, sin objetivo de cobertura heredado).
- Ejemplos de código sin comentarios inline (ADR-003).
- Estilos alineados con ADR-004 (HeroUI Native + Uniwind).
- Se agregó una sección de fugas de memoria y se reemplazó `InteractionManager` (deprecado).

Si una regla de esta carpeta contradice un ADR de `docs/architecture/`, manda el ADR.
