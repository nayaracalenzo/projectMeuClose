const express = require("express");
const cors = require("cors");
const { logger } = require("./utils/logger");
const { errorHandler, notFoundHandler } = require("./middlewars/errorHandler");
const requestLogger = require("./middlewars/requestLogger");
const authRoute = require("./routes/authRoute");
const clientsRoute = require("./routes/clientsRoute.js");
const usersRoute = require("./routes/usersRoute");
const productsRoute = require("./routes/productsRoute");
const cashRoute = require("./routes/cashRoute");
const salesRoute = require("./routes/salesRoute");
const professionsRoute = require("./routes/professionsRoute");
const adminRoute = require("./routes/adminRoute");
const paymentTypesRoute = require("./routes/paymentTypesRoute");
const receivablesRoute = require("./routes/receivablesRoute");
const payablesRoute = require("./routes/payablesRoute");
require("dotenv").config();

const app = express();

const port = process.env.PORT;
const allowedOrigins = [process.env.ORIGIN_URL, process.env.PROD_URL].filter(Boolean);

app.use(requestLogger);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.use("/auth", authRoute);
app.use("/clients", clientsRoute);
app.use("/professions", professionsRoute);
app.use("/admin", adminRoute);
app.use("/sales", salesRoute);
app.use("/payment-types", paymentTypesRoute);
app.use("/receivables", receivablesRoute);
app.use("/payables", payablesRoute);
app.use("/products", productsRoute);
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use("/users", usersRoute);
// app.use("/customers", customersRoute);
// app.use("/cash", cashRoute);

app.get("/", (_req, res) => res.status(200).send("Online."));
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  logger.info("Backend server started", {
    port,
    environment: process.env.NODE_ENV || "development",
    allowedOriginsCount: allowedOrigins.length,
  });
});
