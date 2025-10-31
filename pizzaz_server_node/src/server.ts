import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type PizzazWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  responseText: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ASSETS_DIR = path.resolve(ROOT_DIR, "assets");

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Widget assets not found. Expected directory ${ASSETS_DIR}. Run "pnpm run build" before starting the server.`
    );
  }

  const directPath = path.join(ASSETS_DIR, `${componentName}.html`);
  let htmlContents: string | null = null;

  if (fs.existsSync(directPath)) {
    htmlContents = fs.readFileSync(directPath, "utf8");
  } else {
    const candidates = fs
      .readdirSync(ASSETS_DIR)
      .filter(
        (file) => file.startsWith(`${componentName}-`) && file.endsWith(".html")
      )
      .sort();
    const fallback = candidates[candidates.length - 1];
    if (fallback) {
      htmlContents = fs.readFileSync(path.join(ASSETS_DIR, fallback), "utf8");
    }
  }

  if (!htmlContents) {
    throw new Error(
      `Widget HTML for "${componentName}" not found in ${ASSETS_DIR}. Run "pnpm run build" to generate the assets.`
    );
  }

  return htmlContents;
}

function widgetMeta(widget: PizzazWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

function generateMockProducts(query: string): Array<{
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  rating: number;
}> {
  const allProducts = [
    {
      id: "1",
      name: "Wireless Headphones",
      price: 79.99,
      description: "Premium noise-cancelling wireless headphones with 30-hour battery life",
      image: "https://via.placeholder.com/200x200?text=Headphones",
      rating: 4.5,
    },
    {
      id: "2",
      name: "Smart Watch",
      price: 249.99,
      description: "Fitness tracker with heart rate monitor and GPS",
      image: "https://via.placeholder.com/200x200?text=Smart+Watch",
      rating: 4.7,
    },
    {
      id: "3",
      name: "Laptop Stand",
      price: 39.99,
      description: "Adjustable aluminum laptop stand for ergonomic workspace",
      image: "https://via.placeholder.com/200x200?text=Laptop+Stand",
      rating: 4.3,
    },
    {
      id: "4",
      name: "Mechanical Keyboard",
      price: 129.99,
      description: "RGB backlit mechanical keyboard with cherry MX switches",
      image: "https://via.placeholder.com/200x200?text=Keyboard",
      rating: 4.6,
    },
    {
      id: "5",
      name: "USB-C Hub",
      price: 49.99,
      description: "Multi-port USB-C hub with HDMI, USB 3.0, and SD card reader",
      image: "https://via.placeholder.com/200x200?text=USB+Hub",
      rating: 4.4,
    },
    {
      id: "6",
      name: "Wireless Mouse",
      price: 29.99,
      description: "Ergonomic wireless mouse with precision tracking",
      image: "https://via.placeholder.com/200x200?text=Mouse",
      rating: 4.2,
    },
  ];

  const lowerQuery = query.toLowerCase();
  const filtered = allProducts.filter(
    (product) =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery)
  );

  return filtered.length > 0 ? filtered : allProducts.slice(0, 3);
}

const widgets: PizzazWidget[] = [
  {
    id: "search-products",
    title: "Search Products",
    templateUri: "ui://widget/product-search.html",
    invoking: "Searching for products",
    invoked: "Found products",
    html: readWidgetHtml("product-search"),
    responseText: "Rendered product search results!",
  },
];

const widgetsById = new Map<string, PizzazWidget>();
const widgetsByUri = new Map<string, PizzazWidget>();

widgets.forEach((widget) => {
  widgetsById.set(widget.id, widget);
  widgetsByUri.set(widget.templateUri, widget);
});

const toolInputSchema = {
  type: "object",
  properties: {
    pizzaTopping: {
      type: "string",
      description: "Topping to mention when rendering the widget.",
    },
  },
  required: ["pizzaTopping"],
  additionalProperties: false,
} as const;

const productSearchInputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Product search query string",
    },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

const toolInputParser = z.object({
  pizzaTopping: z.string(),
});

const productSearchInputParser = z.object({
  query: z.string(),
});

const tools: Tool[] = widgets.map((widget) => ({
  name: widget.id,
  description: widget.title,
  inputSchema: widget.id === "search-products" ? productSearchInputSchema : toolInputSchema,
  title: widget.title,
  _meta: widgetMeta(widget),
  // To disable the approval prompt for the widgets
  annotations: {
    destructiveHint: false,
    openWorldHint: false,
    readOnlyHint: true,
  },
}));

const resources: Resource[] = widgets.map((widget) => ({
  uri: widget.templateUri,
  name: widget.title,
  description: `${widget.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

const resourceTemplates: ResourceTemplate[] = widgets.map((widget) => ({
  uriTemplate: widget.templateUri,
  name: widget.title,
  description: `${widget.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

function createPizzazServer(): Server {
  const server = new Server(
    {
      name: "pizzaz-node",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (request: ListResourcesRequest) => {
      console.log(`[MCP Request] ListResources`);
      const response = {
        resources,
      };
      console.log(`[MCP Response] ListResources - returning ${resources.length} resources`);
      return response;
    }
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      console.log(`[MCP Request] ReadResource - uri: ${request.params.uri}`);
      const widget = widgetsByUri.get(request.params.uri);

      if (!widget) {
        console.error(`[MCP Response] ReadResource - error: Unknown resource: ${request.params.uri}`);
        throw new Error(`Unknown resource: ${request.params.uri}`);
      }

      const response = {
        contents: [
          {
            uri: widget.templateUri,
            mimeType: "text/html+skybridge",
            text: widget.html,
            _meta: widgetMeta(widget),
          },
        ],
      };
      console.log(`[MCP Response] ReadResource - returning resource for widget: ${widget.id}`);
      return response;
    }
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (request: ListResourceTemplatesRequest) => {
      console.log(`[MCP Request] ListResourceTemplates`);
      const response = {
        resourceTemplates,
      };
      console.log(`[MCP Response] ListResourceTemplates - returning ${resourceTemplates.length} templates`);
      return response;
    }
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (request: ListToolsRequest) => {
      console.log(`[MCP Request] ListTools`);
      const response = {
        tools,
      };
      console.log(`[MCP Response] ListTools - returning ${tools.length} tools`);
      return response;
    }
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      console.log(`[MCP Request] CallTool - tool: ${request.params.name}, arguments:`, JSON.stringify(request.params.arguments));
      const widget = widgetsById.get(request.params.name);

      if (!widget) {
        console.error(`[MCP Response] CallTool - error: Unknown tool: ${request.params.name}`);
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      let structuredContent: Record<string, unknown>;
      
      if (widget.id === "search-products") {
        const args = productSearchInputParser.parse(request.params.arguments ?? {});
        const products = generateMockProducts(args.query);
        structuredContent = {
          query: args.query,
          products: products,
        };
        console.log(`[MCP Response] CallTool - tool: ${request.params.name}, query: ${args.query}, products: ${products.length}`);
      } else {
        const args = toolInputParser.parse(request.params.arguments ?? {});
        structuredContent = {
          pizzaTopping: args.pizzaTopping,
        };
        console.log(`[MCP Response] CallTool - tool: ${request.params.name}, pizzaTopping: ${args.pizzaTopping}`);
      }

      const response = {
        content: [
          {
            type: "text",
            text: widget.responseText,
          },
        ],
        structuredContent,
        _meta: widgetMeta(widget),
      };
      return response;
    }
  );

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";

async function handleSseRequest(res: ServerResponse) {
  console.log(`[HTTP Request] GET ${ssePath} - establishing SSE connection`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createPizzazServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  console.log(`[SSE] Session created - sessionId: ${sessionId}`);
  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    console.log(`[SSE] Session closed - sessionId: ${sessionId}`);
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error(`[SSE] Transport error - sessionId: ${sessionId}`, error);
  };

  try {
    await server.connect(transport);
    console.log(`[HTTP Response] GET ${ssePath} - SSE connection established - sessionId: ${sessionId}`);
  } catch (error) {
    sessions.delete(sessionId);
    console.error(`[HTTP Response] GET ${ssePath} - Failed to start SSE session - sessionId: ${sessionId}`, error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  const sessionId = url.searchParams.get("sessionId");
  console.log(`[HTTP Request] POST ${postPath} - sessionId: ${sessionId || "missing"}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (!sessionId) {
    console.log(`[HTTP Response] POST ${postPath} - 400 Bad Request: Missing sessionId query parameter`);
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    console.log(`[HTTP Response] POST ${postPath} - 404 Not Found: Unknown session - sessionId: ${sessionId}`);
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
    console.log(`[HTTP Response] POST ${postPath} - message processed successfully - sessionId: ${sessionId}`);
  } catch (error) {
    console.error(`[HTTP Response] POST ${postPath} - 500 Internal Server Error: Failed to process message - sessionId: ${sessionId}`, error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    const startTime = Date.now();
    
    if (!req.url) {
      console.log(`[HTTP Request] ${req.method || "UNKNOWN"} - Missing URL`);
      console.log(`[HTTP Response] ${req.method || "UNKNOWN"} - 400 Bad Request: Missing URL`);
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    console.log(`[HTTP Request] ${req.method || "UNKNOWN"} ${url.pathname}${url.search || ""} - ${req.headers["user-agent"] || "unknown client"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      console.log(`[HTTP Response] OPTIONS ${url.pathname} - 204 No Content (CORS preflight)`);
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === ssePath) {
      await handleSseRequest(res);
      return;
    }

    if (req.method === "POST" && url.pathname === postPath) {
      await handlePostMessage(req, res, url);
      return;
    }

    const duration = Date.now() - startTime;
    console.log(`[HTTP Response] ${req.method || "UNKNOWN"} ${url.pathname} - 404 Not Found (${duration}ms)`);
    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket) => {
  console.error("[HTTP] Client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
  console.log(`Pizzaz MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
  console.log(
    `  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`
  );
});
