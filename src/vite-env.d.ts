declare module '*.css';
declare module 'react' { export function useState<T>(initial:T|(()=>T)): [T,(value:T|((prev:T)=>T))=>void]; export function useMemo<T>(factory:()=>T,deps:unknown[]):T; const React: { StrictMode: (props:{children?: unknown})=>unknown }; export default React; }
declare module 'react-dom/client' { export function createRoot(el: Element): { render(node: unknown): void }; }
declare module 'react/jsx-runtime' { export const jsx: unknown; export const jsxs: unknown; export const Fragment: unknown; }
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }
