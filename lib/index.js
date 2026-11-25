/**
 * dsh-model-deck — host half.
 *
 * Two jobs:
 * 1. the loader entry exists at all (the UI lives in the browser half,
 *    declared through `dsh.client` and served from `exports["./client"]`);
 * 2. serve the model **capability** table the browser menu renders as pills
 *    ("text" / "vision") on the right of each row.
 *
 * The browser catalog (`session/modelCatalog`) deliberately drops the LLM
 * registry's `inputModalities`, and Host plugins cannot add Remote methods
 * without a generated descriptor. A same-origin read-only route is the
 * narrowest seam that gets the browser the real data: it asks the live
 * `ctx.llm` registry for every mounted provider and answers with
 * `{ provider: { model: ["text", "image"] } }`. Requests pass the same
 * browser-trust fence the shipped custom routes use; the response carries no
 * credentials or provider configuration.
 */

/** Route the client half reads once per page. */
export const CAPABILITIES_PATH = '/model-deck/capabilities'

/**
 * Build provider → model → declared input modalities from the live registry.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host context.
 * @returns {Promise<Record<string, Record<string, string[]>>>} capability table.
 */
async function capabilities(ctx) {
  const table = {}
  for (const provider of ctx.llm.listProviders()) {
    try {
      const models = await ctx.llm.listModels(provider.id)
      const entries = {}
      for (const model of models) {
        const info = await ctx.llm.resolveModelInfo(provider.id, model.id)
        if (Array.isArray(info?.inputModalities) && info.inputModalities.length > 0) {
          entries[model.id] = [...info.inputModalities]
        }
      }
      table[provider.id] = entries
    } catch {
      // A provider whose catalog is unavailable simply has no capability rows.
    }
  }
  return table
}

/**
 * Answer one HTTP request with JSON.
 * @param {import('node:http').ServerResponse} res - response owner.
 * @param {number} code - status code.
 * @param {unknown} payload - JSON body.
 */
function sendJson(res, code, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(body.length),
  })
  res.end(body)
}

/**
 * Host plugin body: register the read-only capability route.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host context.
 */
export function apply(ctx) {
  ctx.logger?.info?.('dsh-model-deck：宿主半侧已加载')
  // Optional router: a host without the HTTP carrier (Desktop IPC) simply has
  // no capability route; the browser half then renders model names without
  // pills instead of failing.
  ctx.inject(['webServer'], (scope) => {
    const webServer = typeof scope.get === 'function' ? scope.get('webServer') : scope.webServer
    if (webServer === undefined || typeof webServer.register !== 'function') return
    scope.effect(() => webServer.register({
      kind: 'exact',
      path: CAPABILITIES_PATH,
      handler: async (req, res) => {
        try {
          const connection = typeof ctx.get === 'function' ? ctx.get('connection') : ctx.connection
          const rejection = connection?.requestRejection?.(req)
          if (rejection !== undefined && rejection !== null && rejection !== false) {
            res.statusCode = typeof rejection === 'number' ? rejection : 403
            res.end()
            return
          }
        } catch {
          // The fence is best-effort here; the payload is non-secret registry data.
        }
        try {
          sendJson(res, 200, await capabilities(ctx))
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'model-deck: capability route')
  })
}
