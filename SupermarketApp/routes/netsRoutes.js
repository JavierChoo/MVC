const NetsController = require("../controllers/netsController");

function registerNetsRoutes(app, safeHandler, checkAuthenticated) {
  app.post(
    "/api/nets/generate-qr",
    checkAuthenticated,
    safeHandler(NetsController, "generateQr")
  );
  app.post(
    "/api/nets/request",
    checkAuthenticated,
    safeHandler(NetsController, "generateQr")
  );
  app.post(
    "/api/nets/query-qr",
    checkAuthenticated,
    safeHandler(NetsController, "queryQrStatus")
  );
  app.post(
    "/api/nets/query",
    checkAuthenticated,
    safeHandler(NetsController, "queryQrStatus")
  );
  app.get(
    "/api/nets/stream/:txn_retrieval_ref",
    checkAuthenticated,
    NetsController.streamStatus
  );
}

module.exports = registerNetsRoutes;
