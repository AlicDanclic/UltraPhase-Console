/**
 * @module server/standalone
 * @description HTTP API 服务器独立运行入口。
 * @author EternoPax
 * @version 1.0.0
 */

import { SimpleProtocolClient } from "../protocol/index.js";
import { setProtocolClient } from "./routes.js";
import { startApiServer } from "./index.js";

const standaloneClient = new SimpleProtocolClient();
standaloneClient.setLogger((message, level) => {
  if (level === "error") console.error(`[LOG] ${message}`);
  else console.log(`[LOG] ${message}`);
});

setProtocolClient(standaloneClient);
startApiServer();
