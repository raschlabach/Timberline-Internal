// app/api/truckloads/[id]/route.ts
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return new Response(JSON.stringify({ ok: true, id: params.id }), {
    headers: { 'content-type': 'application/json' }
  })
}

// Add POST/PUT/DELETE later if needed.
// IMPORTANT: Do not export any helper functions from this file.