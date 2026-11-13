/**
 * Lets TypeScript accept side-effect imports of stylesheets (`import "./global.css"`),
 * which Metro + Uniwind process at build time.
 */
declare module '*.css';
