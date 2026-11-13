# ADR-002: Estrategia de testing — TDD

- **Estado**: Aceptado
- **Fecha**: 2026-11-12

## Contexto
Se busca un producto mantenible y con cambios seguros. Los tests E2E son lentos y frágiles mientras la UI y la lógica de una feature todavía cambian.

## Decisión
- **TDD obligatorio**: rojo → verde → refactor. No se escribe lógica de producción sin un test que la exija.
- **Durante la feature**: solo tests unitarios y de integración livianos con **Jest (`jest-expo`) + React Native Testing Library**.
- **Al cierre de la feature**: tests **E2E y pesados con Maestro** (flujos completos en emulador/dispositivo), cuando la feature ya está estable.
- Los tests de componentes prueban el comportamiento visible para el usuario (roles, textos, interacciones), no detalles de implementación.
- Una feature no está terminada si fallan los tests o si `tsc --noEmit` reporta errores.

## Consecuencias
- El diseño del código debe ser testeable de forma aislada: lógica de negocio en funciones puras y acceso a datos detrás de interfaces mockeables.
- El ciclo de feedback durante el desarrollo es rápido; el costo de los E2E se paga una vez por feature.
- No hay un agente tester: los tests los escriben el `code-writer` (y el `designer` para componentes base) y los verifica el `reviewer`.
