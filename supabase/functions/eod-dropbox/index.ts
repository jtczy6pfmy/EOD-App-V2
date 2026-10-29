import { createHandler } from './handler.mjs';
// Own OAuth + owner allowlist and opaque session authentication; no public DB access.
Deno.serve(createHandler({env:(name:string)=>Deno.env.get(name)}));
